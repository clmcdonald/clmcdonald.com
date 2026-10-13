import { createSeededRng } from '../domain/deck';
import { createInitialState, reduce } from '../domain/engine/reducer';
import { step } from '../domain/engine/simulate';
import type { Difficulty, GameState } from '../domain/types';

const DEMO_DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'easy'];

/** Drive a real seeded game until `stop` says so, or the game runs out. */
function drive(seed: number, stop: (state: GameState) => boolean): GameState {
  const rng = createSeededRng(seed);
  let state = reduce(createInitialState(), {
    type: 'START_GAME',
    playerName: 'You',
    difficulties: DEMO_DIFFICULTIES,
    seed,
  });

  for (let steps = 0; steps < 400; steps += 1) {
    if (stop(state)) break;
    const next = step(state, rng);
    if (next === state) break;
    state = next;
  }

  return state;
}

/**
 * A realistic mid-hand state for previewing the table before the engine is
 * wired up. Rather than hand-authoring cards, it drives a real seeded game
 * until it is the human's turn partway through the hand — so it is always a
 * state the engine could actually produce.
 */
export function createDemoState(seed = 20240101): GameState {
  return drive(
    seed,
    (state) =>
      state.phase === 'gameOver' ||
      (state.phase === 'playing' &&
        state.turn === 0 &&
        state.completedTricks.length >= 3)
  );
}

/**
 * A state part-way through a trick that is still live, with at least the
 * leading card on the table. The only moment the lead marker can be seen, since
 * it is dropped once the trick is decided.
 */
export function createMidTrickState(seed = 5): GameState {
  return drive(
    seed,
    (state) =>
      state.phase === 'playing' &&
      state.trickWinnerId === null &&
      state.trick.length >= 2
  );
}

/**
 * A state where a trick has just been decided and is waiting to be collected —
 * the only moment `trickWinnerId` is set, and so the only one in which the
 * "who took it" feedback can be rendered.
 */
export function createResolvedTrickState(seed = 11): GameState {
  return drive(seed, (state) => state.trickWinnerId !== null);
}
