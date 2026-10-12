import type { HandScores, Player } from '../domain/types';
import { CardBackView } from './CardBackView';
import { SEAT_AREA } from './seats';
import { CardFan, Seat, SeatHeader, SeatMeta, SeatName } from '../styled';

/** How many card backs to actually draw before collapsing into a count. */
const MAX_VISIBLE_BACKS = 5;

interface OpponentSectionProps {
  player: Player;
  cardCount: number;
  handPoints?: HandScores[number];
  total: number;
  isTurn: boolean;
  /** This seat took the trick currently being collected. */
  isWinner: boolean;
}

/** One AI seat: name, card count, and running score. */
export function OpponentSection({
  player,
  cardCount,
  handPoints,
  total,
  isTurn,
  isWinner,
}: OpponentSectionProps) {
  const visibleBacks = Math.min(cardCount, MAX_VISIBLE_BACKS);
  const points = handPoints?.points ?? 0;

  return (
    <Seat $area={SEAT_AREA[player.id]}>
      <SeatHeader $active={isTurn} $winner={isWinner}>
        <SeatName>{player.name}</SeatName>
        <SeatMeta>
          {player.difficulty} · {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </SeatMeta>
      </SeatHeader>

      {cardCount > 0 ? (
        <CardFan aria-hidden="true">
          {Array.from({ length: visibleBacks }, (_, index) => (
            <CardBackView key={index} />
          ))}
        </CardFan>
      ) : null}

      <SeatMeta>
        {points > 0 ? `+${points} this hand · ` : ''}
        {total} pts
      </SeatMeta>
    </Seat>
  );
}
