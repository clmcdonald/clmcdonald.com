import type {
  Card,
  Difficulty,
  GameState,
  PlayerId,
  Suit,
  TrickEntry,
} from '../types';
import { cardEquals, isQueenOfSpades } from '../rules/cards';
import { legalPlays, playOptionsFor } from '../rules/validate';

const byRankAsc = (a: Card, b: Card): number => a.rank - b.rank;
const byRankDesc = (a: Card, b: Card): number => b.rank - a.rank;

function lowest(cards: Card[]): Card {
  return [...cards].sort(byRankAsc)[0];
}

function highest(cards: Card[]): Card {
  return [...cards].sort(byRankDesc)[0];
}

function pointsInTrick(trick: TrickEntry[]): number {
  return trick.reduce(
    (sum, e) =>
      sum +
      (e.card.suit === 'hearts' ? 1 : 0) +
      (isQueenOfSpades(e.card) ? 13 : 0),
    0
  );
}

function currentBestRank(trick: TrickEntry[]): number {
  const ledSuit = trick[0].card.suit;
  const ranks = trick
    .filter((e) => e.card.suit === ledSuit)
    .map((e) => e.card.rank);
  return ranks.length > 0 ? Math.max(...ranks) : 0;
}

/** Would `card` take the trick as things stand? Only the led suit can win. */
function wouldWin(card: Card, trick: TrickEntry[]): boolean {
  if (trick.length === 0) return true;
  if (card.suit !== trick[0].card.suit) return false;
  return card.rank > currentBestRank(trick);
}

/** How costly it is to still be holding this card. */
function danger(card: Card): number {
  if (isQueenOfSpades(card)) return 100;
  if (card.suit === 'hearts') return 30 + card.rank;
  if (card.suit === 'spades' && card.rank >= 12) return 25 + card.rank;
  return card.rank;
}

function passDanger(card: Card, hand: Card[], difficulty: Difficulty): number {
  let score = card.rank * 2;
  if (isQueenOfSpades(card)) score += 100;
  if (card.suit === 'hearts') score += 10 + card.rank;
  if (card.suit === 'spades' && card.rank >= 13) score += 25;
  if (difficulty === 'hard') {
    // Favour emptying a long suit so we can shed points later.
    score += hand.filter((c) => c.suit === card.suit).length * 3;
  }
  return score;
}

function groupBySuit(hand: Card[]): Map<Suit, Card[]> {
  const bySuit = new Map<Suit, Card[]>();
  for (const card of hand) {
    const bucket = bySuit.get(card.suit);
    if (bucket) bucket.push(card);
    else bySuit.set(card.suit, [card]);
  }
  return bySuit;
}

/** Choose exactly 3 cards to pass away. Deterministic for a given `rng`. */
export function choosePass(
  hand: Card[],
  difficulty: Difficulty,
  rng: () => number
): Card[] {
  if (hand.length <= 3) return hand.slice();

  if (difficulty === 'hard') {
    // Prefer passing an entire suit to create a void.
    const bySuit = groupBySuit(hand);
    let bestSuit: Suit | null = null;
    let bestScore = -Infinity;
    for (const [suit, cards] of bySuit) {
      if (cards.length < 3) continue;
      const score =
        cards.reduce(
          (sum, card) => sum + passDanger(card, hand, difficulty),
          0
        ) +
        cards.length * 4;
      if (score > bestScore) {
        bestScore = score;
        bestSuit = suit;
      }
    }
    if (bestSuit) {
      const cards = bySuit.get(bestSuit) ?? [];
      return [...cards]
        .sort(
          (a, b) =>
            passDanger(b, hand, difficulty) - passDanger(a, hand, difficulty)
        )
        .slice(0, 3);
    }
  }

  const ranked = [...hand].sort(
    (a, b) =>
      passDanger(b, hand, difficulty) - passDanger(a, hand, difficulty) ||
      a.rank - b.rank
  );
  const picks = ranked.slice(0, 3);

  if (difficulty === 'easy' && rng() < 0.5) {
    // Sometimes give away a random card instead of the safest choice.
    const pool = hand.filter((card) => !picks.some((p) => cardEquals(p, card)));
    if (pool.length > 0) {
      picks[2] = pool[Math.floor(rng() * pool.length)];
    }
  }

  return picks;
}

/**
 * A rough test for "this hand can plausibly take every point", used to switch
 * the hard AI into aggressive moon-chasing mode.
 */
function moonPosture(state: GameState, playerId: PlayerId): boolean {
  if (state.players[playerId]?.difficulty !== 'hard') return false;
  const hand = state.hands[playerId];
  const hearts = hand.filter((card) => card.suit === 'hearts');
  const highHearts = hearts.filter((card) => card.rank >= 12).length;
  const hasAceOfSpades = hand.some(
    (card) => card.suit === 'spades' && card.rank === 14
  );
  return (
    hearts.length >= 5 &&
    highHearts >= 2 &&
    hasAceOfSpades &&
    hand.some(isQueenOfSpades)
  );
}

function chooseLead(state: GameState, legal: Card[], playerId: PlayerId): Card {
  if (moonPosture(state, playerId)) {
    // Chasing the moon: win tricks to keep the lead and hoover up points.
    const hearts = legal.filter((card) => card.suit === 'hearts');
    if (hearts.length > 0) return highest(hearts);
    return highest(legal);
  }

  // Lead low from a short suit to work towards a void.
  const bySuit = groupBySuit(legal);
  let bestSuit: Card[] | null = null;
  for (const cards of bySuit.values()) {
    if (bestSuit === null || cards.length < bestSuit.length) bestSuit = cards;
  }
  return lowest(bestSuit ?? legal);
}

function chooseFollow(
  state: GameState,
  hand: Card[],
  legal: Card[],
  playerId: PlayerId
): Card {
  const trick = state.trick;
  const ledSuit = trick[0].card.suit;
  const isVoid = !hand.some((card) => card.suit === ledSuit);

  if (isVoid) {
    // Nothing of the led suit: shed the most dangerous card we hold.
    const queen = legal.find(isQueenOfSpades);
    if (queen) return queen;
    return highest(legal);
  }

  const winners = legal.filter((card) => wouldWin(card, trick));
  const losers = legal.filter((card) => !wouldWin(card, trick));

  if (pointsInTrick(trick) > 0) {
    if (losers.length > 0) {
      // Duck the points while dumping the most dangerous card we can afford.
      return [...losers].sort((a, b) => danger(b) - danger(a))[0];
    }
    // Everything we hold would win, so take it as cheaply as possible.
    return lowest(winners);
  }

  if (winners.length > 0 && moonPosture(state, playerId)) {
    return highest(winners);
  }
  return lowest(legal);
}

/**
 * Pick a card to play. Always legal — the candidate set comes from
 * `legalPlays`, so the AI can never make an illegal move.
 */
export function choosePlay(
  state: GameState,
  playerId: PlayerId,
  rng: () => number
): Card {
  const hand = state.hands[playerId];
  const legal = legalPlays(hand, state.trick, playOptionsFor(state));
  if (legal.length === 0) return hand[0];
  if (legal.length === 1) return legal[0];

  const difficulty = state.players[playerId]?.difficulty ?? 'normal';
  if (difficulty === 'easy' && rng() < 0.35) {
    return legal[Math.floor(rng() * legal.length)];
  }

  if (state.trick.length === 0) return chooseLead(state, legal, playerId);
  return chooseFollow(state, hand, legal, playerId);
}
