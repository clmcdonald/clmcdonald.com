import type { Card, Rank, Suit } from '../types';

/** Display label for each rank: 2..10 as digits, then J/Q/K/A. */
export const RANK_LABEL: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

/** Display glyph for each suit. */
export const SUIT_GLYPH: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

/** Hearts and diamonds are red; clubs and spades are black. */
export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** Cards are identified by suit + rank (there is no per-card id). */
export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Positive when `a` outranks `b`, negative when lower, 0 when equal. */
export function compareRank(a: Card, b: Card): number {
  return a.rank - b.rank;
}

/** True when `a` is a strictly higher rank than `b`. */
export function rankAfter(a: Card, b: Card): boolean {
  return a.rank > b.rank;
}

/** The Q♠ — the single most valuable card in the deck (13 points). */
export function isQueenOfSpades(card: Card): boolean {
  return card.suit === 'spades' && card.rank === 12;
}

/** Human-readable card name, e.g. "Seven of Hearts" (used for aria-labels). */
export function cardName(card: Card): string {
  const names: Record<Rank, string> = {
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
    11: 'Jack',
    12: 'Queen',
    13: 'King',
    14: 'Ace',
  };
  const suit = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${names[card.rank]} of ${suit}`;
}
