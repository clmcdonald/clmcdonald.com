import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playFullGame } from '../domain/engine';
import { countMoons, didShootMoon } from '../domain/rules/scoring';
import {
  appendToHistory,
  buildHistoryEntry,
  clearHistory,
  DEFAULT_DIFFICULTY,
  DEFAULT_PLAYER_NAME,
  loadDifficulty,
  loadHistory,
  loadPlayerName,
  MAX_HISTORY_ENTRIES,
  MAX_PLAYER_NAME_LENGTH,
  resultFor,
  saveDifficulty,
  saveHistory,
  savePlayerName,
  STORAGE_KEYS,
  summarise,
} from '../state/storage';
import type { ScoreHistoryEntry } from '../state/storage';

/**
 * A `localStorage` stand-in. The tests run in the node environment (no DOM),
 * so `window` is stubbed rather than pulling in jsdom for one module.
 */
const store = new Map<string, string>();
let failWrites = false;

const storage = {
  get length(): number {
    return store.size;
  },
  clear(): void {
    store.clear();
  },
  getItem(key: string): string | null {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  setItem(key: string, value: string): void {
    if (failWrites) throw new Error('QuotaExceededError');
    store.set(key, String(value));
  },
};

beforeEach(() => {
  store.clear();
  failWrites = false;
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function entry(overrides: Partial<ScoreHistoryEntry> = {}): ScoreHistoryEntry {
  return {
    date: '2026-01-02T03:04:05.000Z',
    playerName: 'You',
    difficulty: 'normal',
    result: 'win',
    finalTotals: [31, 100, 88, 74],
    hands: 7,
    moons: 1,
    ...overrides,
  };
}

describe('history persistence', () => {
  it('starts empty when nothing has been stored', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('round-trips an entry', () => {
    appendToHistory(entry());
    expect(loadHistory()).toEqual([entry()]);
  });

  it('keeps the newest entry first', () => {
    appendToHistory(entry({ date: '2026-01-01T00:00:00.000Z' }));
    appendToHistory(entry({ date: '2026-02-01T00:00:00.000Z' }));
    expect(loadHistory().map((item) => item.date)).toEqual([
      '2026-02-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('caps the history so storage cannot grow without limit', () => {
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 5; index += 1) {
      appendToHistory(
        entry({
          date: `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`,
        })
      );
    }
    expect(loadHistory()).toHaveLength(MAX_HISTORY_ENTRIES);
  });

  it('recovers from corrupt JSON instead of throwing', () => {
    storage.setItem(STORAGE_KEYS.history, '{');
    expect(() => loadHistory()).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });

  it('ignores stored JSON that is not an array', () => {
    storage.setItem(STORAGE_KEYS.history, '{"nope":true}');
    expect(loadHistory()).toEqual([]);
  });

  it('drops unusable entries but keeps the valid ones', () => {
    storage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([
        entry(),
        null,
        'not an object',
        { date: 'x', difficulty: 'impossible', result: 'win' },
        { date: 'x', difficulty: 'easy', result: 'maybe' },
        { date: 'x', difficulty: 'easy', result: 'lose', finalTotals: 'no' },
        entry({ date: '2026-03-01T00:00:00.000Z' }),
      ])
    );
    expect(loadHistory().map((item) => item.date)).toEqual([
      '2026-01-02T03:04:05.000Z',
      '2026-03-01T00:00:00.000Z',
    ]);
  });

  it('rejects entries that are not a four-seat game', () => {
    storage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([
        entry({ finalTotals: [31, 100, 88] }),
        entry({ finalTotals: [] }),
        entry({ finalTotals: [31, 100, 88, 74, 12] }),
        entry({ date: '2026-04-01T00:00:00.000Z' }),
      ])
    );
    expect(loadHistory().map((item) => item.date)).toEqual([
      '2026-04-01T00:00:00.000Z',
    ]);
  });

  it('rejects entries with an unparseable date', () => {
    storage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([
        entry({ date: '2026-01-01T00:00:010.000Z' }),
        entry({ date: 'not a date' }),
        entry({ date: '2026-05-01T00:00:00.000Z' }),
      ])
    );
    expect(loadHistory().map((item) => item.date)).toEqual([
      '2026-05-01T00:00:00.000Z',
    ]);
  });

  it('truncates an over-long player name read back from storage', () => {
    storage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([entry({ playerName: 'n'.repeat(200) })])
    );
    expect(loadHistory()[0].playerName).toHaveLength(MAX_PLAYER_NAME_LENGTH);
  });

  it('defaults optional numeric fields on older entries', () => {
    storage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([
        {
          date: '2026-01-01T00:00:00.000Z',
          playerName: '',
          difficulty: 'hard',
          result: 'tie',
          finalTotals: [50, 50, 60, 70],
        },
      ])
    );
    expect(loadHistory()).toEqual([
      {
        date: '2026-01-01T00:00:00.000Z',
        playerName: DEFAULT_PLAYER_NAME,
        difficulty: 'hard',
        result: 'tie',
        finalTotals: [50, 50, 60, 70],
        hands: 0,
        moons: 0,
      },
    ]);
  });

  it('survives a storage backend that throws on write', () => {
    failWrites = true;
    expect(() => appendToHistory(entry())).not.toThrow();
    expect(() => saveHistory([entry()])).not.toThrow();
    expect(() => savePlayerName('Ada')).not.toThrow();
    expect(() => saveDifficulty('hard')).not.toThrow();
    // Reads still fall back to defaults rather than blowing up.
    expect(loadPlayerName()).toBe(DEFAULT_PLAYER_NAME);
  });

  it('clears the history', () => {
    appendToHistory(entry());
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it('falls back to defaults when there is no window at all', () => {
    vi.unstubAllGlobals();
    expect(loadHistory()).toEqual([]);
    expect(loadPlayerName()).toBe(DEFAULT_PLAYER_NAME);
    expect(loadDifficulty()).toBe(DEFAULT_DIFFICULTY);
  });
});

describe('settings persistence', () => {
  it('defaults the player name and difficulty', () => {
    expect(loadPlayerName()).toBe(DEFAULT_PLAYER_NAME);
    expect(loadDifficulty()).toBe(DEFAULT_DIFFICULTY);
  });

  it('round-trips a name and a difficulty', () => {
    savePlayerName('Ada');
    saveDifficulty('hard');
    expect(loadPlayerName()).toBe('Ada');
    expect(loadDifficulty()).toBe('hard');
  });

  it('trims, truncates and rejects blank names', () => {
    savePlayerName('  Ada Lovelace  ');
    expect(loadPlayerName()).toBe('Ada Lovelace');

    savePlayerName('x'.repeat(MAX_PLAYER_NAME_LENGTH + 20));
    expect(loadPlayerName()).toHaveLength(MAX_PLAYER_NAME_LENGTH);

    savePlayerName('Ada');
    savePlayerName('   ');
    expect(loadPlayerName()).toBe(DEFAULT_PLAYER_NAME);
  });

  it('ignores a stored difficulty that is not a known value', () => {
    storage.setItem(STORAGE_KEYS.difficulty, 'nightmare');
    expect(loadDifficulty()).toBe(DEFAULT_DIFFICULTY);
  });
});

describe('deriving results', () => {
  it('classifies win, tie and loss for the human seat', () => {
    expect(resultFor([31, 100, 88, 74])).toBe('win');
    expect(resultFor([50, 50, 60, 70])).toBe('tie');
    expect(resultFor([100, 40, 60, 70])).toBe('lose');
  });

  it('detects a moon only when everyone else took at least 26', () => {
    expect(didShootMoon([0, 26, 26, 26], 0)).toBe(true);
    expect(didShootMoon([0, 26, 26, 26], 1)).toBe(false);
    // A plain hand where one player took all 26 is NOT a moon.
    expect(didShootMoon([0, 0, 0, 26], 3)).toBe(false);
  });

  it('counts moons across a game', () => {
    expect(
      countMoons(
        [
          [0, 26, 26, 26],
          [5, 7, 7, 7],
        ],
        0
      )
    ).toBe(1);
    expect(countMoons([[5, 7, 7, 7]], 0)).toBe(0);
  });

  it('builds a history entry from a finished game', () => {
    const final = playFullGame(4242, ['normal', 'normal', 'normal']);
    expect(final.phase).toBe('gameOver');

    const built = buildHistoryEntry(final, 'Ada', 'hard');
    expect(built.playerName).toBe('Ada');
    expect(built.difficulty).toBe('hard');
    expect(built.finalTotals).toEqual(final.totals);
    expect(built.hands).toBe(final.scores.length);
    expect(built.moons).toBe(countMoons(final.scores, 0));
    expect(built.result).toBe(resultFor(final.totals));
    expect(Number.isNaN(new Date(built.date).getTime())).toBe(false);
  });
});

describe('history stats', () => {
  it('summarises an empty history', () => {
    expect(summarise([])).toEqual({
      played: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winRate: 0,
      moons: 0,
    });
  });

  it('counts results and rounds the win rate', () => {
    const stats = summarise([
      entry({ result: 'win', moons: 1 }),
      entry({ result: 'win', moons: 0 }),
      entry({ result: 'tie', moons: 0 }),
      entry({ result: 'lose', moons: 0 }),
    ]);
    expect(stats).toEqual({
      played: 4,
      wins: 2,
      losses: 1,
      ties: 1,
      winRate: 50,
      moons: 1,
    });
  });
});
