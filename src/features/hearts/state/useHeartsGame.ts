import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { choosePlay } from '../domain/ai/strategy';
import { createSeededRng } from '../domain/deck';
import {
  clearTrick as clearTrickAction,
  confirmPass as confirmPassAction,
  createInitialState,
  isGameStarted,
  nextHand as nextHandAction,
  playAgain as playAgainAction,
  playCard as playCardAction,
  reduce,
  selectPassCard as selectPassCardAction,
  startGame as startGameAction,
} from '../domain/engine';
import { cardEquals } from '../domain/rules/cards';
import { applyPass, PASS_COUNT } from '../domain/rules/passing';
import { legalPlays, playOptionsFor } from '../domain/rules/validate';
import type { Card, Difficulty, GameState } from '../domain/types';
import { HUMAN_SEAT } from '../domain/types';

/** How long an AI "thinks" before playing, so its turns are followable. */
const AI_DELAY_MS = 700;

/**
 * How long a completed trick stays on the table before it is collected.
 *
 * Must cover the whole of the collect animation in `styled.ts`: a 600ms pause
 * so the cards can be read and the winner's highlight registers, then 660ms of
 * cards travelling = 1260ms. The remainder is margin so the cards finish moving
 * before they are removed rather than blinking out mid-flight. Lengthening the
 * delay in `styled.ts` without lengthening this will clip the flight.
 */
const TRICK_HOLD_MS = 1400;

/**
 * How long the three cards just received in a pass stay lifted out of the hand
 * so the player can see what actually arrived — otherwise they land in a sorted
 * 13-card fan and are impossible to pick out. Shorter than this and they are
 * gone before the eye finds them.
 */
const RECEIVED_HIGHLIGHT_MS = 1500;

export { HUMAN_SEAT };

export interface HeartsGameApi {
  state: GameState;
  started: boolean;
  /** Cards the human may legally play; null when it is not their turn. */
  humanLegalPlays: Card[] | null;
  /** The human's pending pass selection. */
  passSelection: Card[];
  /** The three cards received from the last pass. */
  receivedCards: Card[];
  /** True while an AI is deciding (or waiting to play). */
  aiThinking: boolean;
  startGame: (playerName: string, difficulties: Difficulty[]) => void;
  selectPassCard: (card: Card) => void;
  confirmPass: () => void;
  playCard: (card: Card) => void;
  nextHand: () => void;
  playAgain: () => void;
}

export interface HeartsGameOptions {
  /**
   * Called exactly once per finished game, when the state first reaches
   * `gameOver`. Used to record the result; never called during a re-render.
   */
  onGameOver?: (finalState: GameState) => void;
  /**
   * When false the AI stops taking turns, so a game the player has navigated
   * away from does not keep playing in the background. Defaults to true.
   */
  active?: boolean;
}

function randomSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return buffer[0];
  }
  return Date.now() >>> 0;
}

/**
 * The production game hook: owns the reducer, drives AI turns on a timer, and
 * exposes the small set of actions the UI needs.
 */
export function useHeartsGame(options: HeartsGameOptions = {}): HeartsGameApi {
  const { active = true, onGameOver } = options;
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    createInitialState()
  );
  const rngRef = useRef<() => number>(createSeededRng(1));
  const [receivedCards, setReceivedCards] = useState<Card[]>([]);

  // True while a completed trick is on the table showing who took it. Nothing
  // may be played during this window: the lead of the next trick has not
  // started, so the turn belongs to nobody.
  const collectingTrick =
    state.phase === 'playing' && state.trickWinnerId !== null;

  // Record the result exactly once per finished game. `finishedRef` holds the
  // state object that was already reported, so re-runs caused by a changed
  // callback identity — or by StrictMode's double-invoked effects — are no-ops.
  // A new game produces a new state object, which re-arms the guard.
  const finishedRef = useRef<GameState | null>(null);
  useEffect(() => {
    if (state.phase !== 'gameOver') return;
    if (finishedRef.current === state) return;
    finishedRef.current = state;
    onGameOver?.(state);
  }, [state, onGameOver]);

  const startGame = useCallback(
    (playerName: string, difficulties: Difficulty[]) => {
      rngRef.current = createSeededRng(randomSeed());
      setReceivedCards([]);
      dispatch(startGameAction(playerName, difficulties));
    },
    []
  );

  const playAgain = useCallback(() => {
    rngRef.current = createSeededRng(randomSeed());
    setReceivedCards([]);
    dispatch(playAgainAction());
  }, []);

  // Collect the finished trick after a beat, which is what turns "the cards
  // vanished" into "the cards went to West". Same timer-plus-cleanup shape as
  // the AI turns below, so StrictMode's double-invoked effect cannot collect
  // the same trick twice.
  useEffect(() => {
    if (!active) return;
    if (state.phase !== 'playing' || state.trickWinnerId === null) return;
    const timer = setTimeout(() => dispatch(clearTrickAction()), TRICK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [state, active]);

  // Drop the "these just arrived" lift after a moment. Keyed on the cards
  // themselves, so a second pass re-arms it; playing a card also clears them
  // early, since the highlight has done its job by then.
  useEffect(() => {
    if (receivedCards.length === 0) return;
    const timer = setTimeout(() => setReceivedCards([]), RECEIVED_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [receivedCards]);

  // AI turns: schedule exactly one play per turn. The effect re-runs whenever
  // the state changes, which naturally chains the AIs one after another.
  useEffect(() => {
    if (!active) return;
    if (state.phase !== 'playing' || state.turn === HUMAN_SEAT) return;
    // The trick just ended: let it be collected before anyone leads again.
    if (state.trickWinnerId !== null) return;
    const seat = state.turn;
    const timer = setTimeout(() => {
      dispatch(playCardAction(seat, choosePlay(state, seat, rngRef.current)));
    }, AI_DELAY_MS);
    // Cleanup also covers StrictMode's double-invocation: the first timer is
    // cleared before it can fire, so a seat can never play twice.
    return () => clearTimeout(timer);
  }, [state, active]);

  const selectPassCard = useCallback((card: Card) => {
    dispatch(selectPassCardAction(HUMAN_SEAT, card));
  }, []);

  const confirmPass = useCallback(() => {
    // The reducer no-ops on a short selection, but `applyPass` throws on one,
    // and it is called here first to work out what the human receives.
    if (state.passSelections[HUMAN_SEAT]?.length !== PASS_COUNT) return;

    // Compute what the human receives up front — the pass is deterministic
    // given the four selections, which are all known by this point.
    const after = applyPass(
      state.hands,
      state.passSelections,
      state.passDirection
    );
    setReceivedCards(
      after[HUMAN_SEAT].filter(
        (card) =>
          !state.hands[HUMAN_SEAT].some((held) => cardEquals(held, card))
      )
    );
    dispatch(confirmPassAction(HUMAN_SEAT));
  }, [state.hands, state.passDirection, state.passSelections]);

  const playCard = useCallback((card: Card) => {
    setReceivedCards([]);
    dispatch(playCardAction(HUMAN_SEAT, card));
  }, []);

  const nextHand = useCallback(() => {
    setReceivedCards([]);
    dispatch(nextHandAction());
  }, []);

  const humanLegalPlays = useMemo(() => {
    if (state.phase !== 'playing' || state.turn !== HUMAN_SEAT) return null;
    if (state.trickWinnerId !== null) return null;
    return legalPlays(
      state.hands[HUMAN_SEAT] ?? [],
      state.trick,
      playOptionsFor(state)
    );
  }, [state]);

  return {
    state,
    started: isGameStarted(state),
    humanLegalPlays,
    passSelection: state.passSelections[HUMAN_SEAT] ?? [],
    receivedCards,
    aiThinking:
      state.phase === 'playing' &&
      state.turn !== HUMAN_SEAT &&
      !collectingTrick,
    startGame,
    selectPassCard,
    confirmPass,
    playCard,
    nextHand,
    playAgain,
  };
}
