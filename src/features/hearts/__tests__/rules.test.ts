import { describe, expect, it } from 'vitest';
import {
  createDeck,
  createSeededRng,
  deal,
  findTwoOfClubs,
  shuffle,
} from '../domain/deck';
import type { Card, Rank, Suit, TrickEntry } from '../domain/types';
import { RANK_LABEL, SUIT_GLYPH, isRed, cardName } from '../domain/rules/cards';
import {
  PASS_ROTATION,
  applyPass,
  passDirectionForHand,
  passReceiver,
} from '../domain/rules/passing';
import {
  followsSuit,
  heartsBrokenFromTricks,
  rankOrder,
  trickWinner,
} from '../domain/rules/tricks';
import {
  ALL_POINTS,
  addToTotals,
  applyMoon,
  isGameOver,
  isQueenOfSpades,
  isShootingMoon,
  scoreHand,
  trickPoints,
  winners,
} from '../domain/rules/scoring';
import { canLeadHearts, legalPlays } from '../domain/rules/validate';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });
const entry = (playerId: 0 | 1 | 2 | 3, card: Card): TrickEntry => ({
  playerId,
  card,
});

const key = (card: Card) => `${card.suit}-${card.rank}`;
const keys = (cards: Card[]) => cards.map(key).sort();

describe('deck', () => {
  it('creates 52 unique cards, 13 per suit, 4 of each rank', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(key)).size).toBe(52);

    for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]) {
      expect(deck.filter((card) => card.suit === suit)).toHaveLength(13);
    }
    for (let rank = 2; rank <= 14; rank++) {
      expect(deck.filter((card) => card.rank === rank)).toHaveLength(4);
    }
  });

  it('shuffles deterministically for a fixed seed and permutes the input', () => {
    const deck = createDeck();
    const a = shuffle(deck, createSeededRng(42));
    const b = shuffle(deck, createSeededRng(42));
    const other = shuffle(deck, createSeededRng(43));

    expect(a).toEqual(b);
    expect(a).not.toEqual(other);
    expect(keys(a)).toEqual(keys(deck));
    expect(deck[0]).toEqual({ suit: 'hearts', rank: 2 }); // input untouched
  });

  it('deals 4 hands of 13 with no duplicates and the full deck between them', () => {
    const deck = shuffle(createDeck(), createSeededRng(7));
    const hands = deal(deck);

    expect(hands).toHaveLength(4);
    for (const hand of hands) expect(hand).toHaveLength(13);

    const all = hands.flat();
    expect(all).toHaveLength(52);
    expect(new Set(all.map(key)).size).toBe(52);
    expect(keys(all)).toEqual(keys(createDeck()));
  });

  it('finds the hand holding the 2♣', () => {
    const deck = shuffle(createDeck(), createSeededRng(3));
    const hands = deal(deck);
    const holder = findTwoOfClubs(hands);
    expect(
      hands[holder].some((card) => card.suit === 'clubs' && card.rank === 2)
    ).toBe(true);
  });
});

describe('card helpers', () => {
  it('labels ranks, glyphs suits and flags red cards', () => {
    expect(RANK_LABEL[2]).toBe('2');
    expect(RANK_LABEL[10]).toBe('10');
    expect(RANK_LABEL[11]).toBe('J');
    expect(RANK_LABEL[12]).toBe('Q');
    expect(RANK_LABEL[13]).toBe('K');
    expect(RANK_LABEL[14]).toBe('A');
    expect(SUIT_GLYPH).toEqual({
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    });
    expect(isRed('hearts')).toBe(true);
    expect(isRed('diamonds')).toBe(true);
    expect(isRed('clubs')).toBe(false);
    expect(isRed('spades')).toBe(false);
    expect(cardName(c('hearts', 7))).toBe('Seven of Hearts');
  });
});

describe('trick resolution', () => {
  it('ranks ascend from 2 to Ace', () => {
    expect(rankOrder()[0]).toBe(2);
    expect(rankOrder()[rankOrder().length - 1]).toBe(14);
  });

  it('gives a heart-led trick to the highest heart', () => {
    const winner = trickWinner([
      entry(0, c('hearts', 5)),
      entry(1, c('hearts', 9)),
      entry(2, c('hearts', 14)),
      entry(3, c('hearts', 13)),
    ]);
    expect(winner).toBe(2);
  });

  it('ignores off-suit cards even when higher (no trump)', () => {
    const winner = trickWinner([
      entry(0, c('spades', 3)),
      entry(1, c('diamonds', 14)),
      entry(2, c('spades', 13)),
      entry(3, c('clubs', 2)),
    ]);
    expect(winner).toBe(2);
  });

  it('orders A over K over Q in the led suit', () => {
    expect(
      trickWinner([
        entry(0, c('clubs', 12)),
        entry(1, c('clubs', 13)),
        entry(2, c('clubs', 14)),
        entry(3, c('clubs', 2)),
      ])
    ).toBe(2);
  });

  it('detects hearts broken and follow-suit', () => {
    const quiet = [
      [entry(0, c('clubs', 2)), entry(1, c('spades', 5))],
    ] as TrickEntry[][];
    expect(heartsBrokenFromTricks(quiet)).toBe(false);

    const withHeart = [
      [entry(0, c('clubs', 2)), entry(1, c('hearts', 5))],
    ] as TrickEntry[][];
    expect(heartsBrokenFromTricks(withHeart)).toBe(true);

    const withQueen = [
      [entry(0, c('clubs', 2)), entry(1, c('spades', 12))],
    ] as TrickEntry[][];
    expect(heartsBrokenFromTricks(withQueen)).toBe(true);

    expect(followsSuit([c('clubs', 2)], 'clubs')).toBe(true);
    expect(followsSuit([c('hearts', 2)], 'clubs')).toBe(false);
  });
});

describe('passing', () => {
  it('rotates left, right, across, hold across four hands', () => {
    expect(passDirectionForHand(0)).toBe('left');
    expect(passDirectionForHand(1)).toBe('right');
    expect(passDirectionForHand(2)).toBe('across');
    expect(passDirectionForHand(3)).toBe('hold');
    expect(passDirectionForHand(4)).toBe('left');
    expect(PASS_ROTATION).toEqual(['left', 'right', 'across', 'hold']);
  });

  it('maps senders to receivers per the neighbour table', () => {
    // Seats run clockwise S→W→N→E, and play moves to the left, so "left" is
    // the NEXT seat and "right" is the previous one.
    expect(passReceiver(0, 'left')).toBe(1);
    expect(passReceiver(0, 'right')).toBe(3);
    expect(passReceiver(0, 'across')).toBe(2);
    expect(passReceiver(1, 'left')).toBe(2);
    expect(passReceiver(2, 'across')).toBe(0);
    expect(() => passReceiver(0, 'hold')).toThrow();
  });

  it('moves exactly 3 cards each way and preserves hand sizes', () => {
    const hands = deal(shuffle(createDeck(), createSeededRng(11)));
    const selections = hands.map((hand) => hand.slice(0, 3));
    const after = applyPass(hands, selections, 'left');

    for (const hand of after) expect(hand).toHaveLength(13);
    expect(keys(after.flat())).toEqual(keys(hands.flat()));

    // Passing left goes to the next seat clockwise, so player 0 sends to 1
    // and therefore receives from 3.
    for (const card of selections[0]) {
      expect(after[0].some((held) => key(held) === key(card))).toBe(false);
    }
    for (const card of selections[3]) {
      expect(after[0].some((held) => key(held) === key(card))).toBe(true);
    }
  });

  it('rejects malformed selections', () => {
    const hands = deal(shuffle(createDeck(), createSeededRng(5)));
    const tooFew = hands.map((hand) => hand.slice(0, 2));
    expect(() => applyPass(hands, tooFew, 'left')).toThrow();

    const notOwned = hands.map((hand, i) =>
      i === 0 ? hands[1].slice(0, 3) : hand.slice(0, 3)
    );
    expect(() => applyPass(hands, notOwned, 'left')).toThrow();
  });
});

describe('scoring', () => {
  it('gives a mixed trick of 2 hearts + the queen to the trick winner', () => {
    // J♥ leads, so only hearts can win: the J♥ takes the trick and with it the
    // two hearts and the Q♠ that were played into it.
    const points = trickPoints([
      entry(0, c('hearts', 11)),
      entry(1, c('hearts', 2)),
      entry(2, c('spades', 3)),
      entry(3, c('spades', 12)),
    ]);
    expect(Object.keys(points)).toEqual(['0']);
    expect(points[0].points).toBe(15);
    expect(points[0].hearts).toBe(2);
    expect(points[0].queenOfSpades).toBe(true);

    const total = Object.values(points).reduce((sum, p) => sum + p.points, 0);
    expect(total).toBe(15);
  });

  it('gives a hearts-only trick of four hearts to the highest heart', () => {
    const points = trickPoints([
      entry(0, c('hearts', 5)),
      entry(1, c('hearts', 6)),
      entry(2, c('hearts', 7)),
      entry(3, c('hearts', 8)),
    ]);
    expect(Object.keys(points)).toEqual(['3']);
    const total = Object.values(points).reduce((sum, p) => sum + p.points, 0);
    expect(total).toBe(4);
  });

  it('identifies the queen of spades', () => {
    expect(isQueenOfSpades(c('spades', 12))).toBe(true);
    expect(isQueenOfSpades(c('hearts', 12))).toBe(false);
    expect(isQueenOfSpades(c('spades', 11))).toBe(false);
  });

  it('aggregates a whole hand by trick winner', () => {
    const result = scoreHand([
      // J♥ leads and wins, collecting the Q♠ played off-suit.
      [entry(0, c('hearts', 11)), entry(1, c('spades', 12))],
      // 3♥ leads, 4♥ overtakes: player 3 takes both hearts.
      [entry(2, c('hearts', 3)), entry(3, c('hearts', 4))],
    ]);
    expect(result.points).toEqual([14, 0, 0, 2]);
    expect(result.hearts).toEqual([1, 0, 0, 2]);
    expect(result.queensOfSpades).toEqual([0]);
    expect(result.points.reduce((a, b) => a + b, 0)).toBe(16);
  });

  it('detects a moon only on the full 26', () => {
    expect(isShootingMoon([0, 0, 26, 0])).toBe(true);
    expect(isShootingMoon([25, 0, 1, 0])).toBe(false);
    expect(ALL_POINTS).toBe(26);
  });

  it('applies the moon as 0/26/26/26', () => {
    expect(applyMoon([0, 0, 26, 0], 2)).toEqual([26, 26, 0, 26]);
  });

  it('accumulates totals and only ends at >= 100', () => {
    expect(addToTotals([10, 20, 30, 40], [1, 2, 3, 4])).toEqual([
      11, 22, 33, 44,
    ]);
    expect(isGameOver([99, 0, 0, 0])).toBe(false);
    expect(isGameOver([100, 0, 0, 0])).toBe(true);
    expect(isGameOver([0, 101, 0, 0])).toBe(true);
  });

  it('picks the lowest total and reports ties', () => {
    expect(winners([10, 30, 20, 40])).toEqual([0]);
    expect(winners([10, 30, 10, 40])).toEqual([0, 2]);
    expect(winners([10, 10, 10, 10])).toEqual([0, 1, 2, 3]);
  });
});

describe('legal move validation', () => {
  const midHand = { isFirstTrick: false, heartsBroken: false };

  it('forces the 2♣ holder to lead it to the first trick of any hand', () => {
    const hand = [c('clubs', 2), c('clubs', 5), c('diamonds', 9)];
    const plays = legalPlays(hand, [], {
      isFirstTrick: true,
      heartsBroken: false,
    });
    expect(plays).toEqual([c('clubs', 2)]);
  });

  it('binds only the 2♣ holder, and only on the opening lead', () => {
    // The rule is about who holds the 2♣, not about which hand it is: it used
    // to be applied to the game's first hand alone, so from hand 2 onward the
    // previous hand's last-trick winner led and could open with anything —
    // the 2♠ included.
    const withoutTwoClubs = [c('clubs', 5), c('diamonds', 9)];
    expect(
      legalPlays(withoutTwoClubs, [], {
        isFirstTrick: true,
        heartsBroken: false,
      })
    ).toEqual(withoutTwoClubs);

    // Once the 2♣ is on the table it is an ordinary club, like any other.
    expect(
      legalPlays(
        [c('clubs', 2), c('clubs', 5), c('diamonds', 9)],
        [entry(0, c('clubs', 4))],
        { isFirstTrick: true, heartsBroken: false }
      )
    ).toEqual([c('clubs', 2), c('clubs', 5)]);
  });

  it('allows the Q♠ to be led at any time', () => {
    const hand = [c('spades', 12), c('clubs', 9), c('diamonds', 4)];
    // Hearts unbroken, mid-hand: the Q♠ is a legal lead, because it may be led
    // whenever its holder likes.
    expect(legalPlays(hand, [], midHand)).toContainEqual(c('spades', 12));
    // And holding it never obliges you to shed it at the first opportunity.
    expect(legalPlays(hand, [entry(0, c('clubs', 2))], midHand)).toEqual([
      c('clubs', 9),
    ]);
  });

  it('requires following the led suit', () => {
    const hand = [c('clubs', 5), c('clubs', 9), c('diamonds', 9)];
    const plays = legalPlays(hand, [entry(0, c('clubs', 2))], midHand);
    expect(plays).toEqual([c('clubs', 5), c('clubs', 9)]);
  });

  it('lets a void player dump the Q♠ mid-hand', () => {
    const hand = [c('hearts', 5), c('spades', 12), c('diamonds', 9)];
    const plays = legalPlays(hand, [entry(0, c('clubs', 2))], midHand);
    expect(plays).toEqual(hand);
  });

  it('cannot lead a heart while unbroken', () => {
    const hand = [c('hearts', 5), c('clubs', 9), c('diamonds', 9)];
    const plays = legalPlays(hand, [], midHand);
    expect(plays).toEqual([c('clubs', 9), c('diamonds', 9)]);
    expect(canLeadHearts(hand, false)).toBe(false);
    expect(canLeadHearts(hand, true)).toBe(true);
  });

  it('allows an all-hearts hand to lead hearts while unbroken', () => {
    const hand = [c('hearts', 5), c('hearts', 9), c('hearts', 12)];
    expect(canLeadHearts(hand, false)).toBe(true);
    expect(legalPlays(hand, [], midHand)).toEqual(hand);
  });

  it('forbids hearts and the Q♠ on the very first trick', () => {
    const hand = [c('hearts', 5), c('spades', 12), c('diamonds', 9)];
    const plays = legalPlays(hand, [entry(0, c('clubs', 2))], {
      isFirstTrick: true,
      heartsBroken: false,
    });
    expect(plays).toEqual([c('diamonds', 9)]);
  });

  it('still requires following suit on the first trick', () => {
    const hand = [c('clubs', 4), c('hearts', 5), c('diamonds', 9)];
    const plays = legalPlays(hand, [entry(0, c('clubs', 2))], {
      isFirstTrick: true,
      heartsBroken: false,
    });
    expect(plays).toEqual([c('clubs', 4)]);
  });

  it('offers a move rather than dead-ending a first-trick void hand of ♥/Q♠', () => {
    const hand = [c('hearts', 5), c('hearts', 6), c('spades', 12)];
    const plays = legalPlays(hand, [entry(0, c('clubs', 2))], {
      isFirstTrick: true,
      heartsBroken: false,
    });
    expect(plays.length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty hand', () => {
    expect(legalPlays([], [], midHand)).toEqual([]);
  });
});
