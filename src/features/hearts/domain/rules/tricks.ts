import type { Card, PlayerId, Rank, Suit, TrickEntry } from '../types';
import { isQueenOfSpades } from './cards';

const ORDER: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Ascending ranks, 2 (lowest) .. 14 = Ace (highest). */
export function rankOrder(): readonly Rank[] {
  return ORDER;
}

/**
 * Highest card of the LED suit wins. Hearts has no trump, so an off-suit card
 * can never take the trick however high it is. `entries` are in seat order
 * starting from the leader, so `entries[0]` is the led card.
 */
export function trickWinner(entries: TrickEntry[]): PlayerId {
  if (entries.length === 0) {
    throw new Error('Cannot resolve a winner for an empty trick');
  }
  const ledSuit = entries[0].card.suit;
  let winner = entries[0];
  for (const entry of entries.slice(1)) {
    if (entry.card.suit !== ledSuit) continue;
    if (entry.card.rank > winner.card.rank) winner = entry;
  }
  return winner.playerId;
}

/** True once any ♥ or the Q♠ has been played in any completed trick. */
export function heartsBrokenFromTricks(tricks: TrickEntry[][]): boolean {
  return tricks.some((trick) =>
    trick.some(
      (entry) => entry.card.suit === 'hearts' || isQueenOfSpades(entry.card)
    )
  );
}

/** True when the hand contains at least one card of the led suit. */
export function followsSuit(hand: Card[], ledSuit: Suit): boolean {
  return hand.some((card) => card.suit === ledSuit);
}
