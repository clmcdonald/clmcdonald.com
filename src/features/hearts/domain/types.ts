/**
 * Shared domain contract for the Hearts game.
 *
 * Everything in `domain/` is pure TypeScript: no React, no DOM, no
 * `localStorage`, no `Date`, no ambient randomness. All randomness is
 * injected via a seeded RNG so games are reproducible in tests.
 */

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

/** 11=J 12=Q 13=K 14=A. Higher number = higher card. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** 0=South (human) 1=West 2=North 3=East, clockwise. */
export const PLAYER_IDS = [0, 1, 2, 3] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];

/** Seat 0 is always the human; seats 1-3 are the AI opponents. */
export const HUMAN_SEAT: PlayerId = 0;

export type PassDirection = 'left' | 'right' | 'across' | 'hold';

export type Phase = 'passing' | 'playing' | 'handOver' | 'gameOver';

export interface TrickEntry {
  playerId: PlayerId;
  card: Card;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Ordered easiest → hardest, for rendering difficulty pickers. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface Player {
  id: PlayerId;
  name: string;
  isHuman: boolean;
  difficulty: Difficulty;
}

export interface HandScores {
  [playerId: number]: {
    hearts: number;
    queenOfSpades: boolean;
    points: number;
  };
}

export type LogKind =
  'deal' | 'pass' | 'play' | 'trick' | 'handOver' | 'shotMoon' | 'gameOver';

export interface LogEntry {
  kind: LogKind;
  message: string;
  playerId?: PlayerId;
  card?: Card;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  /** hands[playerId] */
  hands: Card[][];
  /** Cards played so far this trick, in seat order starting from the leader. */
  trick: TrickEntry[];
  /**
   * The winner of a completed trick, while that trick is still on the table.
   *
   * Once the fourth card lands the trick is over, but it stays in `trick` and
   * `turn` moves to `trickWinnerId` until a `CLEAR_TRICK` banks it. That pause
   * is what lets the UI show the four cards travelling to whoever took them —
   * clearing here instead would make the trick vanish the moment it ended, so
   * the winner would never be visible. `null` while a trick is still in play.
   */
  trickWinnerId: PlayerId | null;
  /** Who led the current trick. */
  trickLeader: PlayerId;
  /** Who must act next. */
  turn: PlayerId;
  completedTricks: TrickEntry[][];
  /** Current hand's pass direction ('hold' => skip passing). */
  passDirection: PassDirection;
  /** Each player's 3 pending pass cards. */
  passSelections: Card[][];
  /** 0-based; drives passDirection = PASS_ROTATION[handNumber % 4]. */
  handNumber: number;
  /**
   * The game's deal seed. Every hand's shuffle is derived from it, so a game
   * is reproducible from its seed and two games never share a deal.
   */
  seed: number;
  /** Points taken so far THIS hand (for the moon indicator). */
  handPoints: HandScores;
  /** True on trick 1 of the hand (first-trick restriction active). */
  isFirstTrick: boolean;
  heartsBroken: boolean;
  /** scores[handNumber][playerId] = points that hand. */
  scores: number[][];
  /** Running totals[playerId]. */
  totals: number[];
  /** Set when phase === 'gameOver' (may be a tie, 2+ entries). */
  winner: PlayerId[] | null;
  log: LogEntry[];
}

export type HeartsAction =
  | {
      type: 'START_GAME';
      playerName: string;
      difficulties: Difficulty[];
      /** Injected seed keeps deals reproducible in tests. */
      seed?: number;
    }
  | { type: 'SELECT_PASS_CARD'; playerId: PlayerId; card: Card }
  | { type: 'CONFIRM_PASS'; playerId: PlayerId }
  | { type: 'PLAY_CARD'; playerId: PlayerId; card: Card }
  /** Bank a completed trick and hand the lead to its winner. */
  | { type: 'CLEAR_TRICK' }
  | { type: 'NEXT_HAND' }
  | { type: 'PLAY_AGAIN' };
