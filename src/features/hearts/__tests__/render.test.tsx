import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeartsApp } from '../components/HeartsApp';
import { CardBackView } from '../components/CardBackView';
import { CardView } from '../components/CardView';
import { OpponentSection } from '../components/OpponentSection';
import { Table } from '../components/Table';
import { TrickView } from '../components/TrickView';
import { PlayerHand } from '../components/PlayerHand';
import { sortHand } from '../components/handOrder';
import {
  createDemoState,
  createMidTrickState,
  createResolvedTrickState,
} from '../components/demoState';
import { HistoryPanel } from '../components/HistoryPanel';
import { Scoreboard } from '../components/Scoreboard';
import { SetupScreen } from '../components/SetupScreen';
import type { ScoreHistoryEntry } from '../state/storage';
import type { Card } from '../domain/types';

/**
 * The `class` attribute of the first element in a markup string.
 *
 * styled-components encodes a component's props into its generated class, so
 * two renders styled differently differ here — which is the only way to check a
 * styling prop from a string render with no browser to measure pixels in.
 */
function classAttributeOf(markup: string): string {
  return /class="([^"]+)"/.exec(markup)?.[1] ?? '';
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * These are smoke tests, not visual tests: they prove the whole tree renders
 * from a real engine state without throwing, and that key content reaches the
 * markup. Layout itself is verified in a browser.
 */
describe('render smoke tests', () => {
  it('renders the start screen before a game begins', () => {
    const markup = renderToStaticMarkup(<HeartsApp />);

    expect(markup).toContain('Hearts');
    expect(markup).toContain('Start game');
    // No table content leaks through before a game has started.
    expect(markup).not.toContain('Your hand');
  });

  it('renders a full table from a real engine state', () => {
    const state = createDemoState();
    const markup = renderToStaticMarkup(
      <Table
        state={state}
        legalPlays={null}
        passSelection={[]}
        receivedCards={[]}
        scoreboardOpen
      />
    );

    expect(markup).toContain('Scoreboard');
    expect(markup).toContain('West');
    expect(markup).toContain('North');
    expect(markup).toContain('East');
    // Suit glyphs from the human's hand reach the markup.
    expect(markup).toMatch(/[♠♥♦♣]/);
    expect(markup).toContain('Current trick');
    expect(markup).toContain('Your hand');
  });

  it('renders every seat and the running totals in the scoreboard', () => {
    const state = createDemoState();
    const markup = renderToStaticMarkup(<Scoreboard state={state} open />);

    for (const name of ['You', 'West', 'North', 'East']) {
      expect(markup).toContain(name);
    }
    expect(markup).toContain('Total');
  });

  it('renders the trick view with placeholders for seats that have not played', () => {
    const state = createDemoState();
    const markup = renderToStaticMarkup(<TrickView trick={state.trick} />);
    expect(markup).toContain('Current trick');
  });

  it('names the winner once a trick has been decided', () => {
    const state = createResolvedTrickState();
    const winner = state.trickWinnerId;
    expect(winner).not.toBeNull();

    const markup = renderToStaticMarkup(
      <TrickView
        trick={state.trick}
        winnerId={winner}
        winnerName={state.players[winner as 0 | 1 | 2 | 3].name}
      />
    );
    // The table used to drop the winner on the floor entirely, so the trick
    // just disappeared with no indication of who had taken it.
    expect(markup).toContain('takes the trick');
    // Announced, not just drawn, so the result is not carried by motion alone.
    expect(markup).toContain('role="status"');
  });

  it('passes the trick winner through to the table', () => {
    const state = createResolvedTrickState();
    const winner = state.trickWinnerId as 0 | 1 | 2 | 3;

    const markup = renderToStaticMarkup(
      <Table
        state={state}
        legalPlays={null}
        passSelection={[]}
        receivedCards={[]}
        scoreboardOpen
      />
    );
    expect(markup).toContain(`${state.players[winner].name} takes the trick`);
  });

  it('lifts a just-received card exactly like a selected one', () => {
    const card: Card = { suit: 'hearts', rank: 4 };

    // Same treatment, so the markup is identical for a card that is not a
    // button — the lift is the whole signal.
    expect(renderToStaticMarkup(<CardView card={card} received />)).toBe(
      renderToStaticMarkup(<CardView card={card} selected />)
    );
  });

  it('does not report just-received cards as pressed', () => {
    const card: Card = { suit: 'hearts', rank: 4 };
    const markup = renderToStaticMarkup(
      <CardView card={card} received interactive />
    );

    expect(markup).toContain('aria-pressed="false"');
    // Receiving is a notification; only an actual selection is a toggle.
    expect(markup).not.toContain('aria-pressed="true"');
  });

  it('styles the leading card differently from the one that took the trick', () => {
    const card: Card = { suit: 'clubs', rank: 2 };
    const plain = renderToStaticMarkup(<CardView card={card} />);
    const led = renderToStaticMarkup(<CardView card={card} led />);
    const won = renderToStaticMarkup(<CardView card={card} highlighted />);

    expect(led).not.toBe(plain);
    // The card that opened the trick must never be confused with the card that
    // won it, so these two states have to stay visually distinct.
    expect(led).not.toBe(won);
  });

  it('marks the card that led the trick, and only while the trick is live', () => {
    const card: Card = { suit: 'clubs', rank: 2 };
    const leadClass = classAttributeOf(
      renderToStaticMarkup(<CardView card={card} led />)
    );
    expect(leadClass).not.toBe('');

    const live = createMidTrickState();
    // Guards the fixture: without a card on the table there is nothing to mark.
    expect(live.trick.length).toBeGreaterThan(0);
    expect(
      occurrences(
        renderToStaticMarkup(<TrickView trick={live.trick} />),
        leadClass
      )
    ).toBe(1);

    // Once the trick is decided the gold ring is the story, so the lead marker
    // stands down rather than competing with it.
    const decided = createResolvedTrickState();
    expect(
      occurrences(
        renderToStaticMarkup(
          <TrickView trick={decided.trick} winnerId={decided.trickWinnerId} />
        ),
        leadClass
      )
    ).toBe(0);
  });

  it('sorts a hand by suit group and then by rank', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 14 },
      { suit: 'clubs', rank: 2 },
      { suit: 'hearts', rank: 5 },
      { suit: 'clubs', rank: 13 },
      { suit: 'spades', rank: 7 },
      { suit: 'diamonds', rank: 9 },
    ];
    expect(sortHand(hand).map((card) => `${card.suit}${card.rank}`)).toEqual([
      'clubs2',
      'clubs13',
      'diamonds9',
      'spades7',
      'hearts5',
      'hearts14',
    ]);
  });

  it('marks illegal cards as disabled when it is the human’s turn', () => {
    const state = createDemoState();
    const legal = state.hands[0].slice(0, 1);
    const markup = renderToStaticMarkup(
      <PlayerHand
        cards={state.hands[0]}
        legal={legal}
        interactive
        onCardClick={() => undefined}
      />
    );
    // Exactly one enabled card button; the rest are disabled.
    const enabled = markup.match(/<button(?![^>]*disabled)/g) ?? [];
    const disabled = markup.match(/<button[^>]*disabled/g) ?? [];
    expect(enabled).toHaveLength(1);
    expect(disabled.length).toBe(state.hands[0].length - 1);
  });

  it('renders a non-interactive hand as plain cards', () => {
    const state = createDemoState();
    const markup = renderToStaticMarkup(
      <PlayerHand cards={state.hands[0]} legal={null} interactive={false} />
    );
    expect(markup).not.toContain('<button');
  });

  it('draws the opponent fan from the hand size, and caps how many backs it draws', () => {
    const backClass = classAttributeOf(renderToStaticMarkup(<CardBackView />));
    expect(backClass).not.toBe('');

    const markupFor = (cardCount: number) =>
      renderToStaticMarkup(
        <OpponentSection
          player={{ id: 1, name: 'West', isHuman: false, difficulty: 'normal' }}
          cardCount={cardCount}
          total={0}
          isTurn={false}
          isWinner={false}
        />
      );

    // A fan wider than its seat is drawn off the edge of the screen — which is
    // what happened to a phone, where five backs at a fixed lap overhung the
    // seat column and the fifth was clipped. The lap is now worked out from the
    // seat's own width, and no string render can check that: what this pins is
    // the count of backs drawn, and that the cap is on the picture only. Whether
    // the fan actually fits is a layout question, checked in a browser.
    for (const [cardCount, backs] of [
      [13, 5],
      [6, 5],
      [3, 3],
      [1, 1],
      [0, 0],
    ] as const) {
      expect(occurrences(markupFor(cardCount), backClass)).toBe(backs);
    }

    // The cap is on the picture, never on the number: the count beside the name
    // is what says how many cards an opponent is actually holding.
    expect(markupFor(13)).toContain('13 cards');
    expect(markupFor(1)).toContain('1 card<');
  });

  it('renders the setup screen with the difficulty choices', () => {
    const markup = renderToStaticMarkup(
      <SetupScreen
        playerName="Ada"
        difficulty="hard"
        onChangeName={() => undefined}
        onChangeDifficulty={() => undefined}
        onStart={() => undefined}
      />
    );
    expect(markup).toContain('Start game');
    expect(markup).toContain('AI difficulty');
    for (const label of ['Easy', 'Normal', 'Hard']) {
      expect(markup).toContain(label);
    }
    // The active difficulty is exposed to assistive tech, not just by colour.
    expect(markup).toMatch(/aria-pressed="true"/);
  });

  it('renders an empty history panel', () => {
    const markup = renderToStaticMarkup(
      <HistoryPanel
        entries={[]}
        onClose={() => undefined}
        onClear={() => undefined}
      />
    );
    expect(markup).toContain('No games finished yet');
    expect(markup).toContain('Win rate');
  });

  it('renders past games with results and stats', () => {
    const entries: ScoreHistoryEntry[] = [
      {
        date: '2026-02-01T00:00:00.000Z',
        playerName: 'Ada',
        difficulty: 'hard',
        result: 'win',
        finalTotals: [31, 100, 88, 74],
        hands: 7,
        moons: 1,
      },
      {
        date: '2026-01-01T00:00:00.000Z',
        playerName: 'Ada',
        difficulty: 'normal',
        result: 'lose',
        finalTotals: [104, 62, 71, 90],
        hands: 6,
        moons: 0,
      },
    ];
    const markup = renderToStaticMarkup(
      <HistoryPanel
        entries={entries}
        onClose={() => undefined}
        onClear={() => undefined}
      />
    );

    expect(markup).toContain('Win');
    expect(markup).toContain('Loss');
    expect(markup).toContain('50%');
    expect(markup).toContain('31 · 100 · 88 · 74');
  });
});
