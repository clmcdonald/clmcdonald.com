import { choosePass } from '../ai/strategy';
import {
  createDeck,
  createSeededRng,
  deal,
  findTwoOfClubs,
  shuffle,
} from '../deck';
import { cardEquals } from '../rules/cards';
import { applyPass, passDirectionForHand } from '../rules/passing';
import {
  ALL_POINTS,
  addToTotals,
  applyMoon,
  isGameOver,
  isShootingMoon,
  isQueenOfSpades,
  scoreHand,
  trickPoints,
  winners,
} from '../rules/scoring';
import { trickWinner } from '../rules/tricks';
import { legalPlays, playOptionsFor } from '../rules/validate';
import type {
  Card,
  Difficulty,
  GameState,
  HandScores,
  HeartsAction,
  LogEntry,
  Player,
  PlayerId,
  Suit,
} from '../types';
import { PLAYER_IDS } from '../types';

const AI_NAMES = ['West', 'North', 'East'] as const;
const MAX_LOG = 200;
const HAND_COUNT = 13;

const SUIT_INDEX: Record<Suit, number> = {
  hearts: 0,
  diamonds: 1,
  clubs: 2,
  spades: 3,
};

/** The state before a game has been started (`players` is empty). */
export function createInitialState(): GameState {
  return {
    phase: 'passing',
    players: [],
    hands: [[], [], [], []],
    trick: [],
    trickWinnerId: null,
    trickLeader: 0,
    turn: 0,
    completedTricks: [],
    passDirection: 'hold',
    passSelections: [[], [], [], []],
    handNumber: 0,
    seed: 0,
    handPoints: {},
    isFirstTrick: true,
    heartsBroken: false,
    scores: [],
    totals: [0, 0, 0, 0],
    winner: null,
    log: [],
  };
}

export function isGameStarted(state: GameState): boolean {
  return state.players.length > 0;
}

function nextSeat(playerId: PlayerId): PlayerId {
  return ((playerId + 1) % PLAYER_IDS.length) as PlayerId;
}

function pushLog(state: GameState, entry: LogEntry): LogEntry[] {
  const log = [...state.log, entry];
  return log.length > MAX_LOG ? log.slice(log.length - MAX_LOG) : log;
}

function defaultSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return buffer[0];
  }
  return Date.now() >>> 0;
}

/**
 * Deterministic fingerprint of the current hands. Used to derive AI
 * randomness inside the reducer without storing an RNG or breaking purity.
 */
function handsFingerprint(hands: Card[][]): number {
  let hash = 2166136261;
  for (let playerId = 0; playerId < hands.length; playerId++) {
    for (const card of hands[playerId]) {
      hash ^= (playerId + 1) * 131 + SUIT_INDEX[card.suit] * 17 + card.rank;
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

function rngFor(seed: number, playerId: PlayerId): () => number {
  return createSeededRng((seed ^ Math.imul(playerId + 1, 0x9e3779b9)) >>> 0);
}

/**
 * The deal seed for hand `handNumber` of a game seeded with `gameSeed`.
 *
 * Every hand must be a fresh shuffle, but the reducer has no RNG to advance,
 * so each hand's seed is derived from the game seed and the hand number. Using
 * anything derived from the *current* hands would not work here: by the time
 * `nextHand` runs, all 52 cards have been played and the hands are empty.
 */
function handSeed(gameSeed: number, handNumber: number): number {
  let hash = (gameSeed ^ Math.imul(handNumber + 1, 0x9e3779b9)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function difficultyFor(
  difficulties: Difficulty[],
  playerId: PlayerId
): Difficulty {
  if (difficulties.length === 4) return difficulties[playerId] ?? 'normal';
  if (playerId === 0) return 'normal';
  return difficulties[playerId - 1] ?? 'normal';
}

function mergeHandPoints(current: HandScores, add: HandScores): HandScores {
  const next: HandScores = { ...current };
  for (const key of Object.keys(add)) {
    const playerId = Number(key);
    const previous = next[playerId] ?? {
      hearts: 0,
      queenOfSpades: false,
      points: 0,
    };
    const delta = add[playerId];
    next[playerId] = {
      hearts: previous.hearts + delta.hearts,
      queenOfSpades: previous.queenOfSpades || delta.queenOfSpades,
      points: previous.points + delta.points,
    };
  }
  return next;
}

/** Fill in the AI seats' pass choices as soon as a hand enters 'passing'. */
function withAiPassSelections(state: GameState): GameState {
  if (state.phase !== 'passing' || state.passDirection === 'hold') return state;
  const fingerprint = handsFingerprint(state.hands) ^ state.handNumber;
  const passSelections = state.passSelections.map((selection, index) => {
    const playerId = index as PlayerId;
    const player = state.players[playerId];
    if (!player || player.isHuman) return selection;
    const rng = rngFor(fingerprint, playerId);
    return choosePass(state.hands[playerId], player.difficulty, rng);
  });
  return { ...state, passSelections };
}

function startGame(
  playerName: string,
  difficulties: Difficulty[],
  seed: number
): GameState {
  const rng = createSeededRng(seed);
  const hands = deal(shuffle(createDeck(), rng));
  const leader = findTwoOfClubs(hands);

  const players: Player[] = PLAYER_IDS.map((id) => ({
    id,
    name: id === 0 ? playerName : AI_NAMES[id - 1],
    isHuman: id === 0,
    difficulty: id === 0 ? 'normal' : difficultyFor(difficulties, id),
  }));

  return withAiPassSelections({
    phase: 'passing',
    players,
    hands,
    trick: [],
    trickWinnerId: null,
    trickLeader: leader,
    turn: leader,
    completedTricks: [],
    passDirection: passDirectionForHand(0),
    passSelections: [[], [], [], []],
    handNumber: 0,
    seed,
    handPoints: {},
    isFirstTrick: true,
    heartsBroken: false,
    scores: [],
    totals: [0, 0, 0, 0],
    winner: null,
    log: [
      {
        kind: 'deal',
        // Who leads is settled after the pass, which can move the 2♣.
        message: `Hand 1 dealt — passing ${passDirectionForHand(0)}`,
        playerId: leader,
      },
    ],
  });
}

function selectPassCard(
  state: GameState,
  playerId: PlayerId,
  card: Card
): GameState {
  if (state.phase !== 'passing' || state.passDirection === 'hold') return state;
  const player = state.players[playerId];
  if (!player?.isHuman) return state;
  if (!state.hands[playerId].some((held) => cardEquals(held, card))) {
    return state;
  }

  const current = state.passSelections[playerId];
  const already = current.some((selected) => cardEquals(selected, card));
  let next: Card[];
  if (already) {
    next = current.filter((selected) => !cardEquals(selected, card));
  } else if (current.length < 3) {
    next = [...current, card];
  } else {
    return state;
  }

  return {
    ...state,
    passSelections: state.passSelections.map((selection, index) =>
      index === playerId ? next : selection
    ),
  };
}

function confirmPass(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== 'passing' || state.passDirection === 'hold') return state;
  const player = state.players[playerId];
  if (!player?.isHuman) return state;
  if (state.passSelections[playerId].length !== 3) return state;

  const hands = applyPass(
    state.hands,
    state.passSelections,
    state.passDirection
  );
  // The pass moves cards, so the 2♣ holder must be re-found: every hand is
  // opened by whoever holds the 2♣ after the pass, including hands where it
  // was passed away from the player who was dealt it.
  const leader = findTwoOfClubs(hands);

  return {
    ...state,
    phase: 'playing',
    hands,
    passSelections: [[], [], [], []],
    trick: [],
    trickLeader: leader,
    turn: leader,
    isFirstTrick: true,
    log: pushLog(state, {
      kind: 'pass',
      message: `${state.players[leader].name} holds the 2♣ and leads`,
      playerId,
    }),
  };
}

function toHandScores(
  points: number[],
  hearts: number[],
  queensOfSpades: PlayerId[]
): HandScores {
  const scores: HandScores = {};
  for (const playerId of PLAYER_IDS) {
    scores[playerId] = {
      hearts: hearts[playerId],
      queenOfSpades: queensOfSpades.includes(playerId),
      points: points[playerId],
    };
  }
  return scores;
}

function finalizeHand(state: GameState): GameState {
  const result = scoreHand(state.completedTricks);
  let points = result.points;
  let mooner: PlayerId | null = null;

  if (isShootingMoon(points)) {
    mooner = points.indexOf(ALL_POINTS) as PlayerId;
    points = applyMoon(points, mooner);
  }

  const scores = [...state.scores, points];
  const totals = addToTotals(state.totals, points);
  const gameOver = isGameOver(totals);

  const log = pushLog(state, {
    kind: 'handOver',
    message: `Hand ${state.handNumber + 1} complete — ${points
      .map((value, id) => `${state.players[id].name} ${value}`)
      .join(', ')}`,
  });

  return {
    ...state,
    phase: gameOver ? 'gameOver' : 'handOver',
    scores,
    totals,
    winner: gameOver ? winners(totals) : null,
    handPoints: toHandScores(points, result.hearts, result.queensOfSpades),
    log:
      mooner === null
        ? log
        : [
            ...log,
            {
              kind: 'shotMoon',
              message: `${state.players[mooner].name} shot the moon!`,
              playerId: mooner,
            },
          ],
  };
}

function playCard(state: GameState, playerId: PlayerId, card: Card): GameState {
  if (state.phase !== 'playing') return state;
  // A completed trick is on the table waiting to be collected; the lead has
  // not started yet, so nothing may be played into it.
  if (state.trickWinnerId !== null) return state;
  if (playerId !== state.turn) return state;

  const hand = state.hands[playerId];
  if (!hand.some((held) => cardEquals(held, card))) return state;

  const legal = legalPlays(hand, state.trick, playOptionsFor(state));
  if (!legal.some((option) => cardEquals(option, card))) return state;

  const hands = state.hands.map((current, index) =>
    index === playerId
      ? current.filter((held) => !cardEquals(held, card))
      : current
  );
  const trick = [...state.trick, { playerId, card }];
  const heartsBroken =
    state.heartsBroken || card.suit === 'hearts' || isQueenOfSpades(card);

  if (trick.length < PLAYER_IDS.length) {
    return {
      ...state,
      hands,
      trick,
      heartsBroken,
      turn: nextSeat(playerId),
    };
  }

  // The fourth card completes the trick, but the scoring and the move to the
  // next trick are deferred to `clearTrick`: the trick stays on the table so
  // the UI can fly it to whoever took it. The lead already passes to the
  // winner, who is the only seat that acts once the trick is cleared.
  const winner = trickWinner(trick);
  return {
    ...state,
    hands,
    trick,
    trickWinnerId: winner,
    heartsBroken,
    trickLeader: winner,
    turn: winner,
  };
}

/**
 * Bank the completed trick and start the next one.
 *
 * Split out of `playCard` purely so the finished trick can remain visible for
 * a beat. A no-op unless a trick is actually waiting to be collected, so a
 * stray action can never double-count a trick.
 */
function clearTrick(state: GameState): GameState {
  const winner = state.trickWinnerId;
  if (state.phase !== 'playing' || winner === null) return state;

  const trick = state.trick;
  const completedTricks = [...state.completedTricks, trick];
  const handPoints = mergeHandPoints(state.handPoints, trickPoints(trick));

  const resolved: GameState = {
    ...state,
    trick: [],
    trickWinnerId: null,
    completedTricks,
    handPoints,
    isFirstTrick: false,
    log: pushLog(state, {
      kind: 'trick',
      message: `${state.players[winner].name} takes the trick`,
      playerId: winner,
    }),
  };

  if (completedTricks.length === HAND_COUNT) return finalizeHand(resolved);

  return resolved;
}

function nextHand(state: GameState): GameState {
  if (state.phase !== 'handOver') return state;

  const handNumber = state.handNumber + 1;
  const rng = createSeededRng(handSeed(state.seed, handNumber));
  const hands = deal(shuffle(createDeck(), rng));
  const passDirection = passDirectionForHand(handNumber);
  // The 2♣ holder opens every hand. If this hand passes, `confirmPass` finds
  // them again from the post-pass hands, since the pass can move the 2♣; on a
  // hold hand nothing moves, so this stands.
  const leader = findTwoOfClubs(hands);

  return withAiPassSelections({
    ...state,
    phase: passDirection === 'hold' ? 'playing' : 'passing',
    hands,
    trick: [],
    trickWinnerId: null,
    trickLeader: leader,
    turn: leader,
    completedTricks: [],
    passDirection,
    passSelections: [[], [], [], []],
    handNumber,
    handPoints: {},
    isFirstTrick: true,
    heartsBroken: false,
    winner: null,
    log: pushLog(state, {
      kind: 'deal',
      message:
        passDirection === 'hold'
          ? `Hand ${handNumber + 1} dealt — no passing this hand`
          : `Hand ${handNumber + 1} dealt — passing ${passDirection}`,
    }),
  });
}

function playAgain(state: GameState): GameState {
  if (state.phase !== 'gameOver' || state.players.length === 0) return state;
  return startGame(
    state.players[0].name,
    state.players.map((player) => player.difficulty),
    defaultSeed()
  );
}

/** The single source of truth for game flow. Pure. */
export function reduce(state: GameState, action: HeartsAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(
        action.playerName,
        action.difficulties,
        action.seed ?? defaultSeed()
      );
    case 'SELECT_PASS_CARD':
      return selectPassCard(state, action.playerId, action.card);
    case 'CONFIRM_PASS':
      return confirmPass(state, action.playerId);
    case 'PLAY_CARD':
      return playCard(state, action.playerId, action.card);
    case 'CLEAR_TRICK':
      return clearTrick(state);
    case 'NEXT_HAND':
      return nextHand(state);
    case 'PLAY_AGAIN':
      return playAgain(state);
    default:
      return state;
  }
}
