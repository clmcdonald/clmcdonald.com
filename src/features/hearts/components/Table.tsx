import type { ReactNode } from 'react';
import type { Card, GameState } from '../domain/types';
import {
  CenterArea,
  Felt,
  HandArea,
  NoticeArea,
  SeatHeader,
  SeatMeta,
  SeatName,
  TableArea,
} from '../styled';
import { OpponentSection } from './OpponentSection';
import { PlayerHand } from './PlayerHand';
import { Scoreboard } from './Scoreboard';
import { TrickView } from './TrickView';

interface TableProps {
  state: GameState;
  /** Cards the human may legally play; null when it is not their turn. */
  legalPlays: Card[] | null;
  /** Cards the human has chosen to pass (passing phase only). */
  passSelection: Card[];
  /** Cards that just arrived in the pass, lifted so they can be spotted. */
  receivedCards: Card[];
  onCardClick?: (card: Card) => void;
  /** Whether the scoreboard panel is expanded on narrow screens. */
  scoreboardOpen: boolean;
  /** Extra content for the centre of the table (banners, notices). */
  children?: ReactNode;
}

/** The table: three AI seats, the centre trick, and the human's hand. */
export function Table({
  state,
  legalPlays,
  passSelection,
  receivedCards,
  onCardClick,
  scoreboardOpen,
  children,
}: TableProps) {
  const human = state.players[0];
  // A completed trick is on the table being collected: the winner is known,
  // and nobody may act until it has been cleared.
  const trickWinnerId = state.trickWinnerId;
  const isCollecting = trickWinnerId !== null;

  const isPassing = state.phase === 'passing' && state.passDirection !== 'hold';
  const isMyTurn =
    state.phase === 'playing' && state.turn === 0 && !isCollecting;
  const interactive = Boolean(onCardClick) && (isPassing || isMyTurn);
  const legal = isMyTurn ? legalPlays : null;
  const humanPoints = state.handPoints[0]?.points ?? 0;

  return (
    <Felt>
      <TableArea>
        {([2, 1, 3] as const).map((seat) => {
          const player = state.players[seat];
          if (!player) return null;
          return (
            <OpponentSection
              key={player.id}
              player={player}
              cardCount={state.hands[player.id].length}
              handPoints={state.handPoints[player.id]}
              total={state.totals[player.id]}
              isTurn={
                state.phase === 'playing' &&
                state.turn === player.id &&
                !isCollecting
              }
              isWinner={trickWinnerId === player.id}
            />
          );
        })}

        <CenterArea>
          <TrickView
            trick={state.trick}
            winnerId={trickWinnerId}
            winnerName={
              trickWinnerId === null
                ? null
                : (state.players[trickWinnerId]?.name ?? null)
            }
          />
        </CenterArea>

        {children ? <NoticeArea>{children}</NoticeArea> : null}

        <HandArea>
          <SeatHeader $active={isMyTurn} $winner={trickWinnerId === 0}>
            <SeatName>{human?.name ?? 'You'}</SeatName>
            <SeatMeta>
              {humanPoints > 0 ? `+${humanPoints} this hand · ` : ''}
              {state.totals[0]} pts
            </SeatMeta>
            {/* The pass prompt used to be repeated here. It lives on the
                PassSelector bar in the middle of the table, button and all,
                and saying it twice only crowded the name off the pill. */}
          </SeatHeader>
          <PlayerHand
            cards={state.hands[0] ?? []}
            selected={passSelection}
            received={receivedCards}
            legal={legal}
            interactive={interactive}
            onCardClick={onCardClick}
          />
        </HandArea>
      </TableArea>

      <Scoreboard state={state} open={scoreboardOpen} />
    </Felt>
  );
}
