import type { Card, GameState, TrickEntry } from '../types';
import { cardEquals, isQueenOfSpades } from './cards';

export interface PlayOptions {
  /**
   * True on trick 1 of the hand. The 2♣ holder must lead it, and a player void
   * in clubs may not discard a ♥ or the Q♠.
   */
  isFirstTrick: boolean;
  heartsBroken: boolean;
}

/**
 * A player may lead a ♥ only once hearts are broken, or when their entire
 * hand is hearts (i.e. they have no alternative).
 */
export function canLeadHearts(hand: Card[], heartsBroken: boolean): boolean {
  return heartsBroken || hand.every((card) => card.suit === 'hearts');
}

/**
 * The authoritative legal-move gate. Returns every card from `hand` that the
 * owner may legally play given the current trick and hand state.
 *
 * Rules encoded (the classic ruleset):
 *  - The player holding the 2♣ after the pass must lead it to the first trick
 *    of EVERY hand, so every hand opens the same way. It is not a
 *    first-hand-of-the-game rule, and it is only the 2♣ holder who is bound by
 *    it.
 *  - You must follow the led suit when you hold it.
 *  - On the first trick of a hand, a player who cannot follow clubs may play
 *    neither a ♥ nor the Q♠. The restriction bites on discards only — the
 *    opening lead is the 2♣, so it never arises there.
 *  - On a fresh trick you may not lead a ♥ unless hearts are broken or your
 *    whole hand is hearts.
 *  - The Q♠ may be led at any time, and never has to be shed at the first
 *    opportunity.
 */
export function legalPlays(
  hand: Card[],
  trick: TrickEntry[],
  opts: PlayOptions
): Card[] {
  if (hand.length === 0) return [];

  // Leading a fresh trick.
  if (trick.length === 0) {
    if (opts.isFirstTrick) {
      const twoOfClubs = hand.find(
        (card) => card.suit === 'clubs' && card.rank === 2
      );
      if (twoOfClubs) return [twoOfClubs];
      // Falling through only happens if the 2♣ is not in this hand at all,
      // which a four-player deal cannot produce: it is always dealt to someone
      // and the pass only moves it. The ordinary lead rules are the right
      // answer for such a state rather than no answer at all.
    }

    if (!canLeadHearts(hand, opts.heartsBroken)) {
      const nonHearts = hand.filter((card) => card.suit !== 'hearts');
      if (nonHearts.length > 0) return nonHearts;
    }
    return hand.slice();
  }

  const ledSuit = trick[0].card.suit;
  const followers = hand.filter((card) => card.suit === ledSuit);

  if (opts.isFirstTrick) {
    // The first trick of a hand may contain no ♥ and no Q♠.
    const allowed = followers.length > 0 ? followers : hand;
    const safe = allowed.filter(
      (card) => card.suit !== 'hearts' && !isQueenOfSpades(card)
    );
    // A hand of nothing but ♥/Q♠ that cannot follow suit is a rules dead end;
    // fall back to allowing the whole hand rather than offering no move.
    return safe.length > 0 ? safe : allowed.slice();
  }

  return followers.length > 0 ? followers : hand.slice();
}

/** True when `card` is in the player's legal set right now. */
export function isLegalPlay(
  card: Card,
  hand: Card[],
  trick: TrickEntry[],
  opts: PlayOptions
): boolean {
  return legalPlays(hand, trick, opts).some((legal) => cardEquals(legal, card));
}

/** Build the play options implied by a game state. */
export function playOptionsFor(
  state: Pick<GameState, 'isFirstTrick' | 'heartsBroken'>
): PlayOptions {
  return {
    isFirstTrick: state.isFirstTrick,
    heartsBroken: state.heartsBroken,
  };
}
