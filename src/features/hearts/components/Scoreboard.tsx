import type { GameState } from '../domain/types';
import { Panel, PanelHeading, ScoreTable, ScoreTotal } from '../styled';

interface ScoreboardProps {
  state: GameState;
  /** Expanded on narrow screens; always visible on wide ones. */
  open?: boolean;
}

/**
 * Running and cumulative scores: one row per player, one column per completed
 * hand, plus the hand in progress and the running total.
 */
export function Scoreboard({ state, open = false }: ScoreboardProps) {
  const { players, scores, totals, handPoints, handNumber } = state;
  const handInProgress = state.phase === 'passing' || state.phase === 'playing';
  const lowest = Math.min(...totals);
  const finished = state.phase === 'gameOver' || state.phase === 'handOver';

  return (
    <Panel aria-label="Scoreboard" $open={open}>
      <PanelHeading>Scoreboard</PanelHeading>
      <ScoreTable>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {scores.map((_, index) => (
              <th scope="col" key={index}>
                H{index + 1}
              </th>
            ))}
            {handInProgress ? <th scope="col">Now</th> : null}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <th scope="row">{player.name}</th>
              {scores.map((hand, index) => (
                <td key={index}>{hand[player.id]}</td>
              ))}
              {handInProgress ? (
                <td>{handPoints[player.id]?.points ?? 0}</td>
              ) : null}
              <ScoreTotal $leader={finished && totals[player.id] === lowest}>
                {totals[player.id]}
              </ScoreTotal>
            </tr>
          ))}
        </tbody>
      </ScoreTable>
      <PanelHeading as="p" style={{ marginTop: 12, marginBottom: 0 }}>
        Hand {handNumber + 1} · first to 100 loses
      </PanelHeading>
    </Panel>
  );
}
