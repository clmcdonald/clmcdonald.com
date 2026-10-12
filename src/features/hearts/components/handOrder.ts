import type { Card } from '../domain/types';
import { SUIT_ORDER } from './seats';

/** Sort a hand for display: by suit group, then ascending rank. */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.rank - b.rank
  );
}
