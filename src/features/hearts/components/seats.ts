import type { PlayerId, Suit } from '../domain/types';

/** Seat 0 sits at the bottom (the human), 1 west, 2 north, 3 east. */
export const SEAT_AREA: Record<PlayerId, 'north' | 'south' | 'east' | 'west'> =
  {
    0: 'south',
    1: 'west',
    2: 'north',
    3: 'east',
  };

export const SEAT_LABEL: Record<PlayerId, string> = {
  0: 'South',
  1: 'West',
  2: 'North',
  3: 'East',
};

/** Display order of suits in a hand, and of tricks in the log. */
export const SUIT_ORDER: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  spades: 2,
  hearts: 3,
};
