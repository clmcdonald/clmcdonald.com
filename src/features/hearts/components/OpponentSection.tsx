import type { HandScores, Player } from '../domain/types';
import { CardBackView } from './CardBackView';
import { SEAT_AREA } from './seats';
import { CardFan, Seat, SeatHeader, SeatMeta, SeatName } from '../styled';

/**
 * How many backs to draw before the fan stops being readable as a fan.
 *
 * Every card in a deep hand cannot be drawn on a phone: thirteen backs inside
 * a seat's ~107px share only ~4px of card each, which renders as a hatched
 * block rather than a hand of cards (it was tried). The count next to the seat
 * name is what states the hand honestly; this is the picture of it.
 */
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
        {/* The count, and not the difficulty: every opponent plays at the
            difficulty the player chose in setup, so printing it on all three
            seats said the same thing three times and ate the room the name
            needed on a phone. */}
        <SeatMeta>
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </SeatMeta>
      </SeatHeader>

      {/* The fan closes up to fit the seat rather than hanging off the edge of
          the screen, which is how the fifth back used to be cut off. */}
      {visibleBacks > 0 ? (
        <CardFan $count={visibleBacks} aria-hidden="true">
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
