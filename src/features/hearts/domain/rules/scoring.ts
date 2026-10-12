import type { HandScores, PlayerId, TrickEntry } from '../types';
import { PLAYER_IDS } from '../types';
import { isQueenOfSpades } from './cards';
import { trickWinner } from './tricks';

/** Every ♥ is worth 1 point, the Q♠ is worth 13. */
export const ALL_POINTS = 26;
export const QUEEN_OF_SPADES_POINTS = 13;
export const GAME_OVER_THRESHOLD = 100;

export { isQueenOfSpades };

/**
 * Points taken from a single trick, keyed by the player who WON it. In Hearts
 * the winner of a trick collects every card in it, so all of the trick's
 * points belong to the winner — not to whoever happened to play the ♥ or Q♠.
 */
export function trickPoints(entries: TrickEntry[]): HandScores {
  const winner = trickWinner(entries);
  let hearts = 0;
  let queenOfSpades = false;
  for (const entry of entries) {
    if (entry.card.suit === 'hearts') hearts += 1;
    if (isQueenOfSpades(entry.card)) queenOfSpades = true;
  }
  return {
    [winner]: {
      hearts,
      queenOfSpades,
      points: hearts + (queenOfSpades ? QUEEN_OF_SPADES_POINTS : 0),
    },
  };
}

export interface HandResult {
  points: number[];
  hearts: number[];
  queensOfSpades: PlayerId[];
}

/** Aggregate a whole hand of completed tricks into per-player totals. */
export function scoreHand(tricks: TrickEntry[][]): HandResult {
  const points = [0, 0, 0, 0];
  const hearts = [0, 0, 0, 0];
  const queensOfSpades: PlayerId[] = [];

  for (const trick of tricks) {
    const winner = trickWinner(trick);
    for (const entry of trick) {
      if (entry.card.suit === 'hearts') {
        hearts[winner] += 1;
        points[winner] += 1;
      }
      if (isQueenOfSpades(entry.card)) {
        points[winner] += QUEEN_OF_SPADES_POINTS;
        queensOfSpades.push(winner);
      }
    }
  }

  return { points, hearts, queensOfSpades };
}

/** True when one player has taken every point in the hand. */
export function isShootingMoon(points: number[]): boolean {
  return points.some((value) => value === ALL_POINTS);
}

/**
 * True when `playerId` shot the moon in this hand. Requires everyone else to
 * have taken at least 26, which only happens after `applyMoon` — a plain
 * 0/0/0/26 hand is not a moon.
 */
export function didShootMoon(hand: number[], playerId: PlayerId): boolean {
  return (
    hand[playerId] === 0 &&
    hand.every((points, id) => id === playerId || points >= ALL_POINTS)
  );
}

/** How many hands of the game `playerId` shot the moon. */
export function countMoons(hands: number[][], playerId: PlayerId): number {
  return hands.filter((hand) => didShootMoon(hand, playerId)).length;
}

/** Shooting the moon: the shooter scores 0 and everyone else takes 26. */
export function applyMoon(points: number[], mooner: PlayerId): number[] {
  return points.map((value, playerId) =>
    playerId === mooner ? 0 : value + ALL_POINTS
  );
}

export function addToTotals(totals: number[], handPoints: number[]): number[] {
  return totals.map((total, playerId) => total + handPoints[playerId]);
}

export function isGameOver(totals: number[]): boolean {
  return totals.some((total) => total >= GAME_OVER_THRESHOLD);
}

/** Lowest total wins; returns every player tied on the lowest total. */
export function winners(totals: number[]): PlayerId[] {
  const lowest = Math.min(...totals);
  return PLAYER_IDS.filter((playerId) => totals[playerId] === lowest);
}
