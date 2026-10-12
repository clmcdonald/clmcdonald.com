import { describe, expect, it } from 'vitest';
import { createInitialState, reduce } from '../domain/engine/reducer';
import { playFullGame, playOutHand, step } from '../domain/engine/simulate';
import { createSeededRng, findTwoOfClubs } from '../domain/deck';
import { legalPlays, playOptionsFor } from '../domain/rules/validate';
import { ALL_POINTS, isShootingMoon } from '../domain/rules/scoring';
import { applyPass, passReceiver } from '../domain/rules/passing';
import { trickWinner } from '../domain/rules/tricks';
import { cardEquals } from '../domain/rules/cards';
import type {
  Card,
  Difficulty,
  GameState,
  PlayerId,
  Rank,
  Suit,
  TrickEntry,
} from '../domain/types';

const SEEDS = Array.from({ length: 20 }, (_, index) => 1000 + index * 7);
const key = (card: Card) => `${card.suit}-${card.rank}`;
const keys = (cards: Card[]) => cards.map(key).sort();

function freshGame(seed: number, difficulties: Difficulty[]): GameState {
  return reduce(createInitialState(), {
    type: 'START_GAME',
    playerName: 'Tester',
    difficulties,
    seed,
  });
}

/**
 * Replay a full game, recording every card as it is played together with the
 * state it was played from — enough to re-derive the legal set at that moment.
 */
function playedWithContext(): {
  before: GameState;
  playerId: PlayerId;
  card: Card;
}[] {
  const played: { before: GameState; playerId: PlayerId; card: Card }[] = [];
  let state = freshGame(1, ['normal', 'normal', 'normal', 'normal']);
  const rng = createSeededRng(999);
  let steps = 0;

  while (state.phase !== 'gameOver' && steps++ < 2000) {
    if (state.phase === 'playing') {
      const before = state;
      const playerId = before.turn;
      const handBefore = before.hands[playerId];
      const next = step(before, rng);
      const handAfter = next.hands[playerId];
      const card = handBefore.find(
        (held) => !handAfter.some((remaining) => cardEquals(remaining, held))
      );
      if (card) played.push({ before, playerId, card });
      state = next;
    } else {
      state = step(state, rng);
    }
  }
  return played;
}

describe('game start', () => {
  it('starts with a dealt hand and the 2♣ holder on lead', () => {
    const state = freshGame(42, ['normal', 'normal', 'normal', 'normal']);
    expect(state.phase).toBe('passing');
    expect(state.players.map((p) => p.name)).toEqual([
      'Tester',
      'West',
      'North',
      'East',
    ]);
    expect(state.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(state.passDirection).toBe('left');
    expect(state.totals).toEqual([0, 0, 0, 0]);

    const twoOfClubsHolder = state.hands.findIndex((hand) =>
      hand.some((card) => card.suit === 'clubs' && card.rank === 2)
    );
    expect(state.trickLeader).toBe(twoOfClubsHolder);
    expect(state.turn).toBe(twoOfClubsHolder);
  });

  it('deals identically for the same seed and differently across seeds', () => {
    const a = freshGame(7, ['normal', 'normal', 'normal', 'normal']);
    const b = freshGame(7, ['normal', 'normal', 'normal', 'normal']);
    const c = freshGame(8, ['normal', 'normal', 'normal', 'normal']);
    expect(a.hands).toEqual(b.hands);
    expect(a.hands).not.toEqual(c.hands);
  });

  it('pre-selects three pass cards for every AI seat', () => {
    const state = freshGame(11, ['normal', 'normal', 'normal', 'normal']);
    for (const playerId of [1, 2, 3] as const) {
      expect(state.passSelections[playerId]).toHaveLength(3);
    }
    expect(state.passSelections[0]).toHaveLength(0);
  });

  it('ignores illegal actions instead of corrupting state', () => {
    const state = freshGame(3, ['normal', 'normal', 'normal', 'normal']);
    // Not the human's turn to pass, wrong phase, and a card they don't hold.
    expect(
      reduce(state, {
        type: 'PLAY_CARD',
        playerId: 0,
        card: { suit: 'hearts', rank: 5 },
      })
    ).toBe(state);
    expect(
      reduce(state, {
        type: 'SELECT_PASS_CARD',
        playerId: 1,
        card: state.hands[1][0],
      })
    ).toBe(state);
    expect(reduce(state, { type: 'NEXT_HAND' })).toBe(state);
    expect(reduce(state, { type: 'PLAY_AGAIN' })).toBe(state);
    // A card held by someone else can never enter the human's selection.
    expect(
      reduce(state, {
        type: 'SELECT_PASS_CARD',
        playerId: 0,
        card: state.hands[1][0],
      })
    ).toBe(state);
  });

  it('caps a human pass selection at three cards', () => {
    const state = freshGame(5, ['normal', 'normal', 'normal', 'normal']);
    let next = state;
    for (const card of state.hands[0].slice(0, 4)) {
      next = reduce(next, { type: 'SELECT_PASS_CARD', playerId: 0, card });
    }
    expect(next.passSelections[0]).toHaveLength(3);

    // Toggling a selected card removes it again.
    next = reduce(next, {
      type: 'SELECT_PASS_CARD',
      playerId: 0,
      card: state.hands[0][0],
    });
    expect(next.passSelections[0]).toHaveLength(2);
  });

  it('moves to playing once the human confirms the pass', () => {
    const state = freshGame(9, ['normal', 'normal', 'normal', 'normal']);
    let next = state;
    for (const card of state.hands[0].slice(0, 3)) {
      next = reduce(next, { type: 'SELECT_PASS_CARD', playerId: 0, card });
    }
    next = reduce(next, { type: 'CONFIRM_PASS', playerId: 0 });

    expect(next.phase).toBe('playing');
    expect(next.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(next.turn).toBe(next.trickLeader);
    expect(keys(next.hands.flat())).toEqual(keys(state.hands.flat()));
    // Exactly the three cards sent left the human's hand.
    for (const card of state.hands[0].slice(0, 3)) {
      expect(next.hands[0].some((held) => cardEquals(held, card))).toBe(false);
    }
  });

  it('skips passing entirely on the hold hand', () => {
    let state = freshGame(21, ['normal', 'normal', 'normal', 'normal']);
    // Reach hand 4 (index 3), whose direction is 'hold'.
    const rng = createSeededRng(4);
    let steps = 0;
    while (state.handNumber < 3 && steps++ < 2000) {
      state = step(state, rng);
    }
    expect(state.handNumber).toBe(3);
    expect(state.passDirection).toBe('hold');
    expect(state.phase).toBe('playing');
    expect(state.passSelections.every((s) => s.length === 0)).toBe(true);
  });
});

describe('full-game simulation', () => {
  it('terminates for every seed with a valid winner', () => {
    for (const seed of SEEDS) {
      const final = playFullGame(seed, [
        'normal',
        'normal',
        'normal',
        'normal',
      ]);
      expect(final.phase).toBe('gameOver');
      expect(final.winner).not.toBeNull();
      expect(final.winner?.length).toBeGreaterThan(0);

      const lowest = Math.min(...final.totals);
      for (const winner of final.winner ?? []) {
        expect(final.totals[winner]).toBe(lowest);
      }
      expect(Math.max(...final.totals)).toBeGreaterThanOrEqual(100);
      expect(final.hands.every((hand) => hand.length === 0)).toBe(true);
      expect(final.scores).toHaveLength(final.handNumber + 1);
    }
  });

  it('plays 13 tricks per hand and empties every hand', () => {
    const final = playFullGame(2024, ['normal', 'normal', 'normal', 'normal']);
    expect(final.hands.every((hand) => hand.length === 0)).toBe(true);
    expect(final.scores).toHaveLength(final.handNumber + 1);
    for (const hand of final.scores) {
      expect(hand).toHaveLength(4);
    }
  });

  it('conserves points every hand, accounting for moons', () => {
    let state = freshGame(77, ['hard', 'normal', 'easy', 'normal']);
    const rng = createSeededRng(1234);
    let steps = 0;
    let previousHands = 0;

    while (state.phase !== 'gameOver' && steps++ < 2000) {
      const before = state;
      state = step(state, rng);
      if (state.scores.length > previousHands) {
        previousHands = state.scores.length;
        const handPoints = state.scores[state.scores.length - 1];
        const total = handPoints.reduce((a, b) => a + b, 0);
        const moon = handPoints.some((value) => value === ALL_POINTS);
        // A normal hand distributes exactly 26; a moon pays 26 × 3.
        expect(total).toBe(moon ? 78 : ALL_POINTS);
        if (moon) expect(handPoints.filter((p) => p === 0)).toHaveLength(1);
      }
      expect(state).not.toBe(before);
    }
    expect(state.phase).toBe('gameOver');
  });

  it('never lets a player score above 26 in a single hand', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const final = playFullGame(seed, [
        'normal',
        'normal',
        'normal',
        'normal',
      ]);
      for (const hand of final.scores) {
        for (const points of hand) {
          expect(points).toBeLessThanOrEqual(ALL_POINTS);
        }
      }
    }
  });

  it('keeps the first trick free of hearts and the Q♠, with 2♣ led on hand 1', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      // Stop at the end of the first hand, before completedTricks is reset.
      const handOne = playOutHand(
        freshGame(seed, ['normal', 'normal', 'normal', 'normal']),
        seed
      );
      expect(handOne.phase).toBe('handOver');
      expect(handOne.completedTricks).toHaveLength(13);

      const firstTrick = handOne.completedTricks[0];
      expect(firstTrick).toHaveLength(4);
      expect(firstTrick[0].card.suit).toBe('clubs');
      expect(firstTrick[0].card.rank).toBe(2);
      for (const played of firstTrick) {
        expect(played.card.suit).not.toBe('hearts');
        expect(played.card.suit === 'spades' && played.card.rank === 12).toBe(
          false
        );
      }
    }
  });

  it('only ever plays legal cards (rules fuzzing)', () => {
    const played = playedWithContext();
    expect(played.length).toBeGreaterThan(0);

    for (const { before, playerId, card } of played) {
      const hand = before.hands[playerId];
      const options = legalPlays(hand, before.trick, playOptionsFor(before));
      const legal = options.some((option) => cardEquals(option, card));
      expect(
        legal,
        `illegal play ${key(card)} by player ${playerId} in phase ${before.phase}`
      ).toBe(true);
      expect(hand.some((held) => cardEquals(held, card))).toBe(true);
    }
  });

  it('never leads an unbroken heart', () => {
    let state = freshGame(313, ['normal', 'normal', 'normal', 'normal']);
    const rng = createSeededRng(515);
    let steps = 0;
    while (state.phase !== 'gameOver' && steps++ < 2000) {
      const before = state;
      state = step(state, rng);
      if (
        before.phase === 'playing' &&
        before.trick.length === 0 &&
        !before.heartsBroken &&
        state.completedTricks.length + state.trick.length >
          before.completedTricks.length + before.trick.length
      ) {
        const led = state.trick[0] ?? state.completedTricks.at(-1)?.[0];
        if (led) expect(led.card.suit).not.toBe('hearts');
      }
    }
  });

  it('keeps the card multiset a bijection across a pass', () => {
    const state = freshGame(55, ['normal', 'normal', 'normal', 'normal']);
    const selections = state.hands.map((hand, playerId) =>
      playerId === 0 ? hand.slice(0, 3) : state.passSelections[playerId]
    );
    const after = applyPass(state.hands, selections, state.passDirection);
    expect(after.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(keys(after.flat())).toEqual(keys(state.hands.flat()));
  });

  it('is deterministic: the same seed replays the same game', () => {
    const a = playFullGame(4242, ['normal', 'normal', 'normal', 'normal']);
    const b = playFullGame(4242, ['normal', 'normal', 'normal', 'normal']);
    expect(a.scores).toEqual(b.scores);
    expect(a.totals).toEqual(b.totals);
    expect(a.winner).toEqual(b.winner);
  });

  it('produces observably different play across difficulties', () => {
    const seeds = SEEDS.slice(0, 12);
    const easy = seeds.map((seed) =>
      playFullGame(seed, ['easy', 'easy', 'easy', 'easy']).scores.flat()
    );
    const hard = seeds.map((seed) =>
      playFullGame(seed, ['hard', 'hard', 'hard', 'hard']).scores.flat()
    );
    expect(easy).not.toEqual(hard);
  });
});

describe('moon handling', () => {
  const card = (suit: Suit, rank: number): Card => ({
    suit,
    rank: rank as Rank,
  });

  /**
   * A hand rigged so player 2 wins all 13 tricks and takes every point: the
   * first 12 tricks hold 12 hearts plus the Q♠ (25 points), and the 13th trick
   * is the last heart. Playing that final trick must trigger the moon payout.
   */
  function riggedMoonState(): GameState {
    const completedTricks: TrickEntry[][] = [];
    // Ranks chosen so the Q♠ appears exactly once (index 11).
    const spadeRanks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 12];
    for (let index = 0; index < 12; index++) {
      completedTricks.push([
        { playerId: 2, card: card('hearts', index + 2) },
        { playerId: 3, card: card('clubs', index + 2) },
        { playerId: 0, card: card('diamonds', index + 2) },
        { playerId: 1, card: card('spades', spadeRanks[index]) },
      ]);
    }

    return {
      phase: 'playing',
      players: [
        { id: 0, name: 'You', isHuman: true, difficulty: 'normal' },
        { id: 1, name: 'West', isHuman: false, difficulty: 'normal' },
        { id: 2, name: 'North', isHuman: false, difficulty: 'normal' },
        { id: 3, name: 'East', isHuman: false, difficulty: 'normal' },
      ],
      hands: [
        [card('diamonds', 14)],
        [card('spades', 14)],
        [card('hearts', 14)],
        [card('clubs', 14)],
      ],
      trick: [],
      trickWinnerId: null,
      trickLeader: 2,
      turn: 2,
      completedTricks,
      passDirection: 'hold',
      passSelections: [[], [], [], []],
      handNumber: 0,
      seed: 1,
      handPoints: {},
      isFirstTrick: false,
      heartsBroken: true,
      scores: [],
      totals: [0, 0, 0, 0],
      winner: null,
      log: [],
    };
  }

  it('pays a moon as 0 for the shooter and 26 for everyone else', () => {
    let state = riggedMoonState();
    // Player 2 leads the last heart; everyone else is void and discards.
    state = reduce(state, {
      type: 'PLAY_CARD',
      playerId: 2,
      card: card('hearts', 14),
    });
    for (const playerId of [3, 0, 1] as PlayerId[]) {
      state = reduce(state, {
        type: 'PLAY_CARD',
        playerId,
        card: state.hands[playerId][0],
      });
    }

    // The last trick rests on the table, resolved but uncollected, until it is
    // cleared — the hand is not scored a moment before that.
    expect(state.phase).toBe('playing');
    expect(state.trickWinnerId).toBe(2);
    state = reduce(state, { type: 'CLEAR_TRICK' });

    expect(state.phase).toBe('handOver');
    expect(state.scores).toEqual([[26, 26, 0, 26]]);
    expect(state.totals).toEqual([26, 26, 0, 26]);
    expect(state.log.some((entry) => entry.kind === 'shotMoon')).toBe(true);
    expect(state.handPoints[2].points).toBe(0);
  });

  it('accumulates hand points as each trick is collected', () => {
    const base = riggedMoonState();
    const partial: GameState = {
      ...base,
      completedTricks: [
        [
          { playerId: 2, card: card('hearts', 5) },
          { playerId: 3, card: card('clubs', 3) },
          { playerId: 0, card: card('diamonds', 3) },
          { playerId: 1, card: card('spades', 3) },
        ],
      ],
      hands: [
        [card('diamonds', 4)],
        [card('spades', 4)],
        [card('hearts', 6)],
        [card('clubs', 4)],
      ],
      trickLeader: 2,
      turn: 2,
    };

    let state = reduce(partial, {
      type: 'PLAY_CARD',
      playerId: 2,
      card: card('hearts', 6),
    });
    for (const playerId of [3, 0, 1] as PlayerId[]) {
      state = reduce(state, {
        type: 'PLAY_CARD',
        playerId,
        card: state.hands[playerId][0],
      });
    }
    // The heart is on the table but not yet credited to anyone.
    expect(state.handPoints[2]?.points ?? 0).toBe(0);

    state = reduce(state, { type: 'CLEAR_TRICK' });
    // Player 2 took the trick, and with it the heart.
    expect(state.handPoints[2].hearts).toBe(1);
    expect(state.handPoints[2].points).toBe(1);

    expect(isShootingMoon([0, 0, 26, 0])).toBe(true);
    expect(ALL_POINTS).toBe(26);
  });
});

/**
 * A completed trick is resolved but not banked: it stays in `trick` with a
 * `trickWinnerId` until `CLEAR_TRICK` collects it. That pause is what the UI
 * animates, and it is the only moment the winner is observable.
 */
describe('trick collection', () => {
  const DIFFS: Difficulty[] = ['normal', 'normal', 'normal', 'normal'];

  /** Advance a fresh game up to the first trick that has just been decided. */
  function untilResolved(seed: number): GameState {
    const rng = createSeededRng(seed);
    let state = freshGame(seed, DIFFS);
    for (let steps = 0; steps < 500; steps += 1) {
      const next = step(state, rng);
      if (next.trickWinnerId !== null) return next;
      if (next === state) break;
      state = next;
    }
    throw new Error('no trick was ever resolved');
  }

  it('leaves the decided trick on the table, unscored', () => {
    const resolved = untilResolved(11);
    const banked = resolved.completedTricks.length;

    expect(resolved.trick).toHaveLength(4);
    expect(resolved.trickWinnerId).toBe(trickWinner(resolved.trick));
    // The winner is on lead for the next trick, but nothing has been banked.
    expect(resolved.turn).toBe(resolved.trickWinnerId);
    expect(resolved.trickLeader).toBe(resolved.trickWinnerId);
    expect(resolved.completedTricks).toHaveLength(banked);
  });

  it('banks the trick and empties the table on CLEAR_TRICK', () => {
    const resolved = untilResolved(11);
    const banked = resolved.completedTricks.length;
    const winner = resolved.trickWinnerId;

    const cleared = reduce(resolved, { type: 'CLEAR_TRICK' });
    expect(cleared.completedTricks).toHaveLength(banked + 1);
    expect(cleared.completedTricks[banked]).toEqual(resolved.trick);
    expect(cleared.trick).toEqual([]);
    expect(cleared.trickWinnerId).toBeNull();
    expect(cleared.turn).toBe(winner);
    expect(cleared.log.at(-1)?.kind).toBe('trick');
  });

  it('refuses every play while a trick is waiting to be collected', () => {
    const resolved = untilResolved(11);
    const winner = resolved.trickWinnerId as PlayerId;

    // Even the winner, who is nominally next to act, cannot lead yet.
    expect(
      reduce(resolved, {
        type: 'PLAY_CARD',
        playerId: winner,
        card: resolved.hands[winner][0],
      })
    ).toBe(resolved);
  });

  it('ignores CLEAR_TRICK when no trick is resolved, and never banks twice', () => {
    const fresh = freshGame(11, DIFFS);
    expect(reduce(fresh, { type: 'CLEAR_TRICK' })).toBe(fresh);

    // Clearing an already-cleared trick must not award the points again.
    const cleared = reduce(untilResolved(11), { type: 'CLEAR_TRICK' });
    expect(reduce(cleared, { type: 'CLEAR_TRICK' })).toBe(cleared);
  });
});

/**
 * Regressions for bugs found in review. Every case here passed before its fix,
 * so these exist to stop the behaviour coming back.
 */
describe('deal and first-trick regressions', () => {
  const DIFFS: Difficulty[] = ['normal', 'normal', 'normal', 'normal'];
  const card = (suit: Suit, rank: number): Card => ({
    suit,
    rank: rank as Rank,
  });
  const FIRST_TRICK = {
    isFirstTrick: true,
    heartsBroken: false,
  };

  /** The hand-2 deal of a game seeded with `seed`, as a comparable string. */
  function hand2Deal(seed: number): string {
    const afterHand1 = playOutHand(freshGame(seed, DIFFS), seed);
    const hand2 = reduce(afterHand1, { type: 'NEXT_HAND' });
    expect(hand2.handNumber).toBe(1);
    return hand2.hands.map((hand) => keys(hand).join(',')).join('|');
  }

  it('deals a different hand 2 for every game seed', () => {
    // The next-hand shuffle used to be derived from the current hands, which
    // are empty by the time a hand ends — so hand 2 was identical in every
    // game, whatever the seed. Several seeds catch any return to a constant.
    const deals = [1, 2, 3, 4, 5].map(hand2Deal);
    expect(new Set(deals).size).toBe(deals.length);
  });

  it('is still reproducible from the seed', () => {
    expect(hand2Deal(7)).toBe(hand2Deal(7));
  });

  it('deals a complete 52-card hand 2', () => {
    const afterHand1 = playOutHand(freshGame(3, DIFFS), 3);
    const hand2 = reduce(afterHand1, { type: 'NEXT_HAND' });
    expect(hand2.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(keys(hand2.hands.flat())).size).toBe(52);
  });

  it('re-finds the 2♣ holder after the first pass, so the 2♣ still leads', () => {
    // Find a seed where the human is dealt the 2♣, then pass it away.
    let seed = 0;
    for (let candidate = 1; candidate < 500; candidate += 1) {
      if (findTwoOfClubs(freshGame(candidate, DIFFS).hands) === 0) {
        seed = candidate;
        break;
      }
    }
    expect(seed).toBeGreaterThan(0);

    const start = freshGame(seed, DIFFS);
    expect(findTwoOfClubs(start.hands)).toBe(0);

    let state = reduce(start, {
      type: 'SELECT_PASS_CARD',
      playerId: 0,
      card: card('clubs', 2),
    });
    for (const held of start.hands[0]) {
      if (state.passSelections[0].length === 3) break;
      if (key(held) === 'clubs-2') continue;
      state = reduce(state, {
        type: 'SELECT_PASS_CARD',
        playerId: 0,
        card: held,
      });
    }
    expect(state.passSelections[0]).toHaveLength(3);
    state = reduce(state, { type: 'CONFIRM_PASS', playerId: 0 });

    // The 2♣ moved, so the receiver must be the one on lead — not the player
    // who was originally dealt it.
    const leader = passReceiver(0, 'left');
    expect(leader).not.toBe(0);
    expect(findTwoOfClubs(state.hands)).toBe(leader);
    expect(state.turn).toBe(leader);
    expect(state.trickLeader).toBe(leader);
    // And their only legal move is the 2♣ itself.
    expect(
      legalPlays(state.hands[leader], state.trick, playOptionsFor(state)).map(
        key
      )
    ).toEqual(['clubs-2']);
  });

  it('opens every hand with the 2♣, all the way to the end of the game', () => {
    // The bug this guards: the 2♣ rule was applied to the game's first hand
    // only, so from hand 2 on the previous hand's last-trick winner led and
    // was free to open with, say, the 2♠.
    for (const seed of SEEDS.slice(0, 4)) {
      let state = freshGame(seed, DIFFS);
      let handsPlayed = 0;

      for (;;) {
        const played = playOutHand(state, seed + handsPlayed);
        const openingTrick = played.completedTricks[0];
        expect(openingTrick).toHaveLength(4);
        // The opening lead of every hand, not just the game's first.
        expect(openingTrick[0].card).toEqual(card('clubs', 2));
        // And the first trick of every hand is free of ♥ and the Q♠.
        for (const play of openingTrick) {
          expect(play.card.suit).not.toBe('hearts');
          expect(play.card).not.toEqual(card('spades', 12));
        }
        handsPlayed += 1;

        if (played.phase === 'gameOver') break;
        state = reduce(played, { type: 'NEXT_HAND' });
        // The 2♣ holder is on lead before the pass is even confirmed, which is
        // what makes the opening lead legal on a hold hand too.
        expect(state.turn).toBe(findTwoOfClubs(state.hands));
      }

      // Guards the fixture: a one-hand game would prove nothing about hand 2.
      expect(handsPlayed).toBeGreaterThan(1);
    }
  });

  it('follows the rules of Hearts, judged independently of legalPlays', () => {
    // The fuzzing test above asks "was this play in legalPlays?" and takes
    // legalPlays as its oracle, so it cannot catch a rule encoded wrongly
    // *inside* it — which is exactly how the 2♣ opening lead went wrong for
    // every hand after the first. Every assertion here is re-derived from the
    // rules text instead: the led suit, the highest card, the winner and who
    // leads next are all worked out from the played cards.
    let ledSuit: Suit = 'clubs';
    let bestRank = 0;
    let winnerThisTrick: PlayerId = 0;
    let previousTrickWinner: PlayerId | null = null;
    let heartsOrQueenDown = false;
    let handsSeen = 0;
    let tricksSeen = 0;

    for (const { before, playerId, card: played } of playedWithContext()) {
      const isVoid = !before.hands[playerId].some(
        (held) => held.suit === before.trick[0]?.card.suit
      );

      if (before.trick.length === 0) {
        tricksSeen += 1;
        ledSuit = played.suit;
        bestRank = played.rank;
        winnerThisTrick = playerId;

        // Rule: hearts may not be led until a heart or the Q♠ is down.
        if (!heartsOrQueenDown) expect(played.suit).not.toBe('hearts');

        if (before.isFirstTrick) {
          handsSeen += 1;
          heartsOrQueenDown = false;
          // Rule: the 2♣ holder makes the opening lead — of every hand.
          expect(played).toEqual(card('clubs', 2));
        } else {
          // Rule: the winner of a trick leads the next one.
          expect(playerId).toBe(previousTrickWinner);
        }
      } else {
        // Rule: follow the led suit whenever you hold it.
        if (!isVoid) expect(played.suit).toBe(ledSuit);

        if (before.isFirstTrick && isVoid) {
          // Rule: on the first trick a player holding no clubs may discard
          // anything except a ♥ or the Q♠. Only the club-void are bound by it —
          // those who can follow have already been held to clubs above.
          expect(played.suit).not.toBe('hearts');
          expect(played).not.toEqual(card('spades', 12));
        }

        // Rule: the highest card of the led suit takes the trick.
        if (played.suit === ledSuit && played.rank > bestRank) {
          bestRank = played.rank;
          winnerThisTrick = playerId;
        }
      }

      if (
        played.suit === 'hearts' ||
        (played.suit === 'spades' && played.rank === 12)
      ) {
        heartsOrQueenDown = true;
      }

      // The trick is decided by its fourth card; that winner leads next.
      if (before.trick.length === 3) previousTrickWinner = winnerThisTrick;
    }

    // Guards the audit: one trick, or one hand, would prove almost nothing.
    expect(handsSeen).toBeGreaterThan(1);
    expect(tricksSeen).toBeGreaterThan(13);
  });

  it('pins the opening lead of a hand to the 2♣, never to the Q♠', () => {
    const hand: Card[] = [
      card('clubs', 2),
      card('spades', 12),
      card('spades', 5),
      card('hearts', 3),
    ];
    // The Q♠ is leadable in general, but not by the player who must open with
    // the 2♣.
    expect(legalPlays(hand, [], FIRST_TRICK).map(key)).toEqual(['clubs-2']);
  });

  it('forbids a heart or the Q♠ when void in clubs on the first trick', () => {
    const hand: Card[] = [
      card('spades', 12),
      card('hearts', 7),
      card('diamonds', 4),
      card('diamonds', 9),
    ];
    const legal = legalPlays(
      hand,
      [{ playerId: 0, card: card('clubs', 3) }],
      FIRST_TRICK
    );
    expect(legal.map(key).sort()).toEqual(['diamonds-4', 'diamonds-9']);
  });
});
