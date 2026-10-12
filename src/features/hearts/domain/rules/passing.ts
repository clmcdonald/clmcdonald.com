import type { Card, PassDirection, PlayerId } from '../types';
import { cardEquals } from './cards';

/** Rotation applied across hands: hand 0 passes left, hand 1 right, … */
export const PASS_ROTATION: readonly PassDirection[] = [
  'left',
  'right',
  'across',
  'hold',
];

export const PASS_COUNT = 3;

export function passDirectionForHand(handNumber: number): PassDirection {
  const index = ((handNumber % 4) + 4) % 4;
  return PASS_ROTATION[index];
}

/**
 * Fixed neighbour table.
 *
 * Seats run clockwise 0(South) → 1(West) → 2(North) → 3(East) → 0, and play
 * moves to the next seat, which is the neighbour on your left — a player at
 * South faces the centre (north), so their left hand points west. "Left" is
 * therefore the *next* seat, not the previous one:
 *   'left'   → to = (from + 1) % 4
 *   'right'  → to = (from + 3) % 4
 *   'across' → to = (from + 2) % 4
 *
 * NOTE: the implementation plan's §5 table gives the first two the other way
 * round. That table contradicts the plan's own seating definition (§0/types:
 * "0=South (human) 1=West 2=North 3=East, clockwise") and its own UI copy
 * ("Pass 3 cards to your left"), which would send the cards to the player drawn
 * on the *right* of the screen. The labels here are the ones that match what
 * the player sees; swapping these two lines restores the plan's literal table.
 */
export function passReceiver(from: PlayerId, dir: PassDirection): PlayerId {
  switch (dir) {
    case 'left':
      return ((from + 1) % 4) as PlayerId;
    case 'right':
      return ((from + 3) % 4) as PlayerId;
    case 'across':
      return ((from + 2) % 4) as PlayerId;
    case 'hold':
      throw new Error('Cannot pass to anyone when the direction is "hold"');
  }
}

function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

/**
 * Simultaneous transfer of every player's 3 selected cards in direction `dir`.
 * Each selection must have exactly `PASS_COUNT` cards and every selected card
 * must currently be in the sender's hand. Returns a new set of hands of the
 * same size, containing exactly the same multiset of cards.
 */
export function applyPass(
  hands: Card[][],
  selections: Card[][],
  dir: PassDirection
): Card[][] {
  if (dir === 'hold') return hands.map((hand) => hand.slice());

  const size = hands.length;
  if (selections.length !== size) {
    throw new Error('Selections must exist for every player');
  }

  const outgoing: Card[][] = [];
  for (let from = 0; from < size; from++) {
    const selection = selections[from];
    if (selection.length !== PASS_COUNT) {
      throw new Error(
        `Player ${from} must pass exactly ${PASS_COUNT} cards, got ${selection.length}`
      );
    }
    const hand = hands[from];
    for (const card of selection) {
      if (!hand.some((held) => cardEquals(held, card))) {
        throw new Error(`Player ${from} does not hold the card being passed`);
      }
    }
    if (new Set(selection.map(cardKey)).size !== PASS_COUNT) {
      throw new Error(`Player ${from} selected the same card more than once`);
    }
    outgoing.push(selection);
  }

  // Everyone gives simultaneously: strip every sender's selection first, then
  // add each selection to its receiver, so no card is ever handed along twice.
  const next: Card[][] = hands.map((hand, from) => {
    const given = outgoing[from];
    return hand.filter((card) => !given.some((sel) => cardEquals(sel, card)));
  });

  for (let from = 0; from < size; from++) {
    const to = passReceiver(from as PlayerId, dir);
    next[to].push(...outgoing[from]);
  }

  return next;
}
