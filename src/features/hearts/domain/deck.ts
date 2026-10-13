import type { Card, PlayerId, Rank } from './types';
import { PLAYER_IDS, SUITS } from './types';

const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** A full, ordered 52-card deck (4 suits × 13 ranks). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * mulberry32 — small, fast, deterministic PRNG.
 * Returns a function producing values in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle. Non-mutating: returns a new array. */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Deal a deck into 4 hands of 13, round-robin in seat order 0..3. */
export function deal(deck: Card[]): Card[][] {
  const hands: Card[][] = [[], [], [], []];
  deck.forEach((card, index) => {
    hands[index % PLAYER_IDS.length].push(card);
  });
  return hands;
}

/** Which hand holds the 2♣ (who must lead the first trick of the hand). */
export function findTwoOfClubs(hands: Card[][]): PlayerId {
  for (const playerId of PLAYER_IDS) {
    const holds = hands[playerId].some(
      (card) => card.suit === 'clubs' && card.rank === 2
    );
    if (holds) return playerId;
  }
  throw new Error('Deck is missing the two of clubs');
}
