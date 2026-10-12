import { choosePass, choosePlay } from '../ai/strategy';
import { createSeededRng } from '../deck';
import type { Difficulty, GameState } from '../types';
import { PLAYER_IDS } from '../types';
import { createInitialState, reduce } from './reducer';

const MAX_STEPS = 2000;

/**
 * Advance a state by one action, driving every seat (including the human's)
 * with the AI. Used for tests and diagnostics only.
 */
export function step(state: GameState, rng: () => number): GameState {
  switch (state.phase) {
    case 'passing': {
      const human = state.players[0];
      if (!human) return state;
      const picks = choosePass(state.hands[0], human.difficulty, rng);
      let next = state;
      for (const card of picks) {
        next = reduce(next, {
          type: 'SELECT_PASS_CARD',
          playerId: 0,
          card,
        });
      }
      return reduce(next, { type: 'CONFIRM_PASS', playerId: 0 });
    }
    case 'playing':
      // A completed trick waits on the table before it is collected; the
      // simulation has nothing to show, so it just moves straight on.
      if (state.trickWinnerId !== null) {
        return reduce(state, { type: 'CLEAR_TRICK' });
      }
      return reduce(state, {
        type: 'PLAY_CARD',
        playerId: state.turn,
        card: choosePlay(state, state.turn, rng),
      });
    case 'handOver':
      return reduce(state, { type: 'NEXT_HAND' });
    case 'gameOver':
      return state;
    default:
      return state;
  }
}

/** Auto-play until the hand ends (or the game ends). */
export function playOutHand(
  state: GameState,
  seed: number,
  maxSteps = MAX_STEPS
): GameState {
  const rng = createSeededRng(seed);
  let current = state;
  let steps = 0;
  while (current.phase !== 'handOver' && current.phase !== 'gameOver') {
    if (steps++ >= maxSteps) {
      throw new Error('playOutHand did not terminate');
    }
    const next = step(current, rng);
    if (next === current) {
      throw new Error(`playOutHand stalled in phase "${current.phase}"`);
    }
    current = next;
  }
  return current;
}

/** Play a complete game from a fresh deal, with every seat driven by the AI. */
export function playFullGame(
  seed: number,
  difficulties: Difficulty[],
  maxSteps = MAX_STEPS
): GameState {
  const rng = createSeededRng((seed ^ 0x5bf03635) >>> 0);
  let current = reduce(createInitialState(), {
    type: 'START_GAME',
    playerName: 'Sim',
    difficulties,
    seed,
  });

  let steps = 0;
  while (current.phase !== 'gameOver') {
    if (steps++ >= maxSteps) {
      throw new Error(`playFullGame did not terminate after ${maxSteps} steps`);
    }
    const next = step(current, rng);
    if (next === current) {
      throw new Error(`playFullGame stalled in phase "${current.phase}"`);
    }
    current = next;
  }
  return current;
}

/** Convenience for tests: every seat driven by the same difficulty. */
export function simulateGame(seed: number, difficulty: Difficulty): GameState {
  return playFullGame(
    seed,
    PLAYER_IDS.map(() => difficulty)
  );
}
