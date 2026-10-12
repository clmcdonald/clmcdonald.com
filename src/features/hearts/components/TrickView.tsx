import type { PlayerId, TrickEntry } from '../domain/types';
import {
  CardStatic,
  TrickCard,
  TrickCardEnter,
  TrickGrid,
  TrickResult,
  TrickSlot,
} from '../styled';
import { CardView } from './CardView';
import { SEAT_AREA, SEAT_LABEL } from './seats';

interface TrickViewProps {
  trick: TrickEntry[];
  /** Set once the trick is complete, to collect the cards towards the taker. */
  winnerId?: PlayerId | null;
  /** The winner's display name, for the caption. */
  winnerName?: string | null;
}

const SEATS: PlayerId[] = [0, 1, 2, 3];

/** The four cards of the current trick, laid out around the centre. */
export function TrickView({
  trick,
  winnerId = null,
  winnerName = null,
}: TrickViewProps) {
  // Plays are appended in turn order, so the first entry is the card that led
  // the trick. While a trick is live this is the only thing that says which
  // suit the others were obliged to follow.
  const leaderId = trick[0]?.playerId ?? null;

  return (
    <>
      <TrickGrid aria-label="Current trick">
        {SEATS.map((playerId) => {
          const played = trick.find((entry) => entry.playerId === playerId);
          // Once the trick is decided the winner's gold ring is the story, so
          // the lead marker steps aside rather than competing with it.
          const led = winnerId === null && leaderId === playerId;
          return (
            <TrickSlot key={playerId} $area={SEAT_AREA[playerId]}>
              {played ? (
                // Once the trick is decided every card travels to the winner,
                // so it is the destination rather than the owner that the
                // movement describes.
                <TrickCard
                  $flyTo={winnerId === null ? undefined : SEAT_AREA[winnerId]}
                >
                  <TrickCardEnter>
                    <CardView
                      card={played.card}
                      led={led}
                      highlighted={winnerId === playerId}
                    />
                  </TrickCardEnter>
                </TrickCard>
              ) : (
                <CardStatic
                  $placeholder
                  aria-label={`${SEAT_LABEL[playerId]}: no card yet`}
                />
              )}
            </TrickSlot>
          );
        })}
      </TrickGrid>
      <TrickResult role="status">
        {winnerName === null ? null : <span>{winnerName} takes the trick</span>}
      </TrickResult>
    </>
  );
}
