/**
 * Persistence for the Hearts game.
 *
 * Everything here is deliberately defensive: `localStorage` throws in private
 * browsing, can be full, and its contents are user-editable. A corrupt or
 * missing value must never crash the game — we fall back to defaults and carry
 * on. This is also the only module in the feature that touches `Date` or the
 * browser, keeping `domain/` pure.
 */
import { countMoons, winners } from '../domain/rules/scoring';
import type { Difficulty, GameState } from '../domain/types';
import { DIFFICULTIES, HUMAN_SEAT } from '../domain/types';

/** All keys are namespaced so they are easy to find and clear. */
export const STORAGE_KEYS = {
  history: 'hearts:scoreHistory',
  playerName: 'hearts:playerName',
  difficulty: 'hearts:difficulty',
} as const;

export const DEFAULT_PLAYER_NAME = 'You';
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Bounds storage growth: the newest games are kept, older ones dropped. */
export const MAX_HISTORY_ENTRIES = 50;
export const MAX_PLAYER_NAME_LENGTH = 24;

export type GameResult = 'win' | 'lose' | 'tie';

export interface ScoreHistoryEntry {
  /** ISO timestamp of when the game ended. */
  date: string;
  playerName: string;
  difficulty: Difficulty;
  result: GameResult;
  /** Final totals, indexed by player id. */
  finalTotals: number[];
  /** Hands played in the game. */
  hands: number;
  /** Moons the human shot during the game. */
  moons: number;
}

/* ------------------------------------------------------------------ */
/* Guarded raw access                                                  */
/* ------------------------------------------------------------------ */

function readRaw(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing, disabled storage, or a hostile getter.
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable: losing the write is acceptable.
  }
}

function removeRaw(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/* ------------------------------------------------------------------ */
/* Runtime validation (stored data is untrusted)                       */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDifficulty(value: unknown): value is Difficulty {
  return (DIFFICULTIES as readonly unknown[]).includes(value);
}

function isGameResult(value: unknown): value is GameResult {
  return value === 'win' || value === 'lose' || value === 'tie';
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Coerce one stored entry into a valid record, or null if unusable. */
function parseHistoryEntry(value: unknown): ScoreHistoryEntry | null {
  if (!isRecord(value)) return null;

  const { date, playerName, difficulty, result, finalTotals, hands, moons } =
    value;

  // A Hearts game always has four seats, so a totals row of any other length
  // is a sign of tampered or foreign data.
  if (typeof date !== 'string' || Number.isNaN(new Date(date).getTime())) {
    return null;
  }
  if (!isDifficulty(difficulty) || !isGameResult(result)) return null;
  if (!Array.isArray(finalTotals) || finalTotals.length !== 4) return null;

  const totals = finalTotals.filter(
    (total): total is number =>
      typeof total === 'number' && Number.isFinite(total)
  );
  if (totals.length !== finalTotals.length) return null;

  return {
    date,
    playerName:
      typeof playerName === 'string' && playerName.trim() !== ''
        ? playerName.trim().slice(0, MAX_PLAYER_NAME_LENGTH)
        : DEFAULT_PLAYER_NAME,
    difficulty,
    result,
    finalTotals: totals,
    hands: isCount(hands) ? hands : 0,
    moons: isCount(moons) ? moons : 0,
  };
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/** Newest first. Returns `[]` for missing, unparseable or corrupt data. */
export function loadHistory(): ScoreHistoryEntry[] {
  const raw = readRaw(STORAGE_KEYS.history);
  if (raw === null) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseHistoryEntry)
      .filter((entry): entry is ScoreHistoryEntry => entry !== null)
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    // Hand-edited or truncated JSON: start fresh rather than crash.
    return [];
  }
}

export function saveHistory(entries: ScoreHistoryEntry[]): void {
  writeRaw(
    STORAGE_KEYS.history,
    JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES))
  );
}

/** Prepend one entry, trimming to `MAX_HISTORY_ENTRIES`. Returns the new list. */
export function appendToHistory(entry: ScoreHistoryEntry): ScoreHistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, MAX_HISTORY_ENTRIES);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  removeRaw(STORAGE_KEYS.history);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function loadPlayerName(): string {
  const raw = readRaw(STORAGE_KEYS.playerName);
  if (raw === null) return DEFAULT_PLAYER_NAME;
  const trimmed = raw.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
  return trimmed === '' ? DEFAULT_PLAYER_NAME : trimmed;
}

export function savePlayerName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
  if (trimmed === '') {
    removeRaw(STORAGE_KEYS.playerName);
    return;
  }
  writeRaw(STORAGE_KEYS.playerName, trimmed);
}

export function loadDifficulty(): Difficulty {
  const raw = readRaw(STORAGE_KEYS.difficulty);
  return isDifficulty(raw) ? raw : DEFAULT_DIFFICULTY;
}

export function saveDifficulty(difficulty: Difficulty): void {
  writeRaw(STORAGE_KEYS.difficulty, difficulty);
}

/* ------------------------------------------------------------------ */
/* Deriving an entry from a finished game                              */
/* ------------------------------------------------------------------ */

/** Win / lose / tie for the human (seat 0) from the final totals. */
export function resultFor(totals: number[]): GameResult {
  const lowest = winners(totals);
  if (!lowest.includes(HUMAN_SEAT)) return 'lose';
  return lowest.length > 1 ? 'tie' : 'win';
}

export function buildHistoryEntry(
  state: GameState,
  playerName: string,
  difficulty: Difficulty
): ScoreHistoryEntry {
  return {
    date: new Date().toISOString(),
    playerName,
    difficulty,
    result: resultFor(state.totals),
    finalTotals: [...state.totals],
    hands: state.scores.length,
    moons: countMoons(state.scores, HUMAN_SEAT),
  };
}

/* ------------------------------------------------------------------ */
/* Stats for the history view                                          */
/* ------------------------------------------------------------------ */

export interface HistoryStats {
  played: number;
  wins: number;
  losses: number;
  ties: number;
  /** Whole-number win percentage, 0 when nothing has been played. */
  winRate: number;
  moons: number;
}

export function summarise(entries: ScoreHistoryEntry[]): HistoryStats {
  const wins = entries.filter((entry) => entry.result === 'win').length;
  const losses = entries.filter((entry) => entry.result === 'lose').length;
  const ties = entries.filter((entry) => entry.result === 'tie').length;
  const moons = entries.reduce((total, entry) => total + entry.moons, 0);

  return {
    played: entries.length,
    wins,
    losses,
    ties,
    winRate:
      entries.length === 0 ? 0 : Math.round((wins / entries.length) * 100),
    moons,
  };
}
