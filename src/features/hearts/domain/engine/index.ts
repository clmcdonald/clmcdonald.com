import type { Card, Difficulty, HeartsAction, PlayerId } from '../types';

export { createInitialState, isGameStarted, reduce } from './reducer';
export { playFullGame, playOutHand, simulateGame, step } from './simulate';
export { choosePass, choosePlay } from '../ai/strategy';

export function startGame(
  playerName: string,
  difficulties: Difficulty[],
  seed?: number
): HeartsAction {
  return { type: 'START_GAME', playerName, difficulties, seed };
}

export function selectPassCard(playerId: PlayerId, card: Card): HeartsAction {
  return { type: 'SELECT_PASS_CARD', playerId, card };
}

export function confirmPass(playerId: PlayerId): HeartsAction {
  return { type: 'CONFIRM_PASS', playerId };
}

export function playCard(playerId: PlayerId, card: Card): HeartsAction {
  return { type: 'PLAY_CARD', playerId, card };
}

export function clearTrick(): HeartsAction {
  return { type: 'CLEAR_TRICK' };
}

export function nextHand(): HeartsAction {
  return { type: 'NEXT_HAND' };
}

export function playAgain(): HeartsAction {
  return { type: 'PLAY_AGAIN' };
}
