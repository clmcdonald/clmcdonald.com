import type { KeyboardEvent } from 'react';
import type { Card } from '../domain/types';
import { cardEquals } from '../domain/rules/cards';
import { HandRow } from '../styled';
import { CardView } from './CardView';
import { sortHand } from './handOrder';

interface PlayerHandProps {
  cards: Card[];
  /** Cards the player has selected (passing phase). */
  selected?: Card[];
  /** Cards just received in the pass, lifted briefly so they stand out. */
  received?: Card[];
  /**
   * The only cards that may be played right now. `null` means "no restriction
   * to show" (e.g. it is not this player's turn) — everything stays inert.
   */
  legal?: Card[] | null;
  interactive?: boolean;
  onCardClick?: (card: Card) => void;
}

/**
 * The human's hand: a fanned, tappable row. Cards outside `legal` are dimmed
 * and disabled so an illegal move can never be attempted. Left/right arrows
 * move focus along the playable cards; Enter or Space activates one.
 */
export function PlayerHand({
  cards,
  selected = [],
  received = [],
  legal = null,
  interactive = false,
  onCardClick,
}: PlayerHandProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled])'
      )
    );
    if (buttons.length === 0) return;

    const forward = event.key === 'ArrowRight';
    const current = buttons.indexOf(document.activeElement as HTMLElement);

    let next: number;
    if (current < 0) {
      // Nothing in the hand had focus: enter at whichever end we are heading.
      next = forward ? 0 : buttons.length - 1;
    } else {
      const step = forward ? 1 : -1;
      next = (current + step + buttons.length) % buttons.length;
    }

    event.preventDefault();
    buttons[next].focus();
  };

  return (
    <HandRow role="group" aria-label="Your hand" onKeyDown={handleKeyDown}>
      {sortHand(cards).map((card) => {
        const isSelected = selected.some((chosen) => cardEquals(chosen, card));
        const isLegal =
          legal === null || legal.some((option) => cardEquals(option, card));
        // Illegal cards stay buttons (so they are still announced) but are
        // disabled and dimmed, so an illegal move cannot be attempted.
        const clickable = interactive && isLegal;

        return (
          <CardView
            key={`${card.suit}-${card.rank}`}
            card={card}
            selected={isSelected}
            received={received.some((arrived) => cardEquals(arrived, card))}
            dimmed={interactive && !isLegal}
            interactive={interactive}
            disabled={interactive && !isLegal}
            onSelect={clickable ? onCardClick : undefined}
          />
        );
      })}
    </HandRow>
  );
}
