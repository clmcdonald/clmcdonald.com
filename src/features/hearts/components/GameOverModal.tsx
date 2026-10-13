import type { GameState } from '../domain/types';
import { useFocusTrap } from './useFocusTrap';
import {
  Button,
  ModalActions,
  ModalCard,
  ModalSubtitle,
  ModalTitle,
  Overlay,
  ScoreTable,
  ScoreTotal,
} from '../styled';

interface GameOverModalProps {
  state: GameState;
  onPlayAgain: () => void;
  /** Return to the setup screen to change the name or difficulty. */
  onNewGame: () => void;
}

/** Final result: winner(s) or a tie, plus a per-hand recap of the session. */
export function GameOverModal({
  state,
  onPlayAgain,
  onNewGame,
}: GameOverModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  const winners = state.winner ?? [];
  const names = winners.map((id) => state.players[id]?.name ?? `Player ${id}`);
  const lowest = Math.min(...state.totals);
  const humanWon = winners.includes(0);

  const heading =
    names.length > 1 ? `It's a tie: ${names.join(' & ')}` : `${names[0]} wins!`;

  return (
    <Overlay>
      <ModalCard
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Game over"
      >
        <ModalTitle>{heading}</ModalTitle>
        <ModalSubtitle>
          {humanWon
            ? 'Your lowest total won the game. This result is saved to your history.'
            : 'Lowest score wins — the first player to 100 loses. This result is saved to your history.'}
        </ModalSubtitle>

        <ScoreTable>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {state.scores.map((_, index) => (
                <th scope="col" key={index}>
                  H{index + 1}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {state.players.map((player) => (
              <tr key={player.id}>
                <th scope="row">{player.name}</th>
                {state.scores.map((hand, index) => (
                  <td key={index}>{hand[player.id]}</td>
                ))}
                <ScoreTotal $leader={state.totals[player.id] === lowest}>
                  {state.totals[player.id]}
                </ScoreTotal>
              </tr>
            ))}
          </tbody>
        </ScoreTable>

        <ModalActions>
          <Button $ghost type="button" onClick={onNewGame}>
            New game
          </Button>
          <Button $primary type="button" data-autofocus onClick={onPlayAgain}>
            Play again
          </Button>
        </ModalActions>
      </ModalCard>
    </Overlay>
  );
}
