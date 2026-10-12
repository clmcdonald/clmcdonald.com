import { memo } from 'react';
import type { Card } from '../domain/types';
import { RANK_LABEL, SUIT_GLYPH, cardName, isRed } from '../domain/rules/cards';
import { CardButton, CardCorner, CardPip, CardStatic } from '../styled';

interface CardFaceProps {
  card: Card;
}

/** The static face of a card: rank and suit glyphs in the corners and centre. */
export function CardFace({ card }: CardFaceProps) {
  const red = isRed(card.suit);
  const label = RANK_LABEL[card.rank];
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <>
      <CardCorner $red={red}>
        <span>{label}</span>
        <span>{glyph}</span>
      </CardCorner>
      <CardPip $red={red} aria-hidden="true">
        {glyph}
      </CardPip>
      <CardCorner $red={red} $flipped>
        <span>{label}</span>
        <span>{glyph}</span>
      </CardCorner>
    </>
  );
}

interface CardViewProps {
  card: Card;
  selected?: boolean;
  /** Just arrived in the pass: lifted like a selection, but not a toggle. */
  received?: boolean;
  /** Dim a card that cannot be played right now. */
  dimmed?: boolean;
  /** This card took the trick. */
  highlighted?: boolean;
  /** This card led the trick. Rendered in a different colour from
   *  `highlighted`, so the card that opened the trick is never mistaken for
   *  the card that won it. */
  led?: boolean;
  /** Renders a focusable, tappable card. Off by default (pure display). */
  interactive?: boolean;
  disabled?: boolean;
  /**
   * Called with this card when an interactive card is activated. Kept as one
   * stable reference (rather than a per-card closure) so `memo` can skip
   * re-rendering the twelve cards whose state did not change.
   */
  onSelect?: (card: Card) => void;
}

/**
 * A single card. Interactive cards are real buttons so they are keyboard
 * reachable and announce themselves ("Seven of Hearts").
 */
export const CardView = memo(function CardView({
  card,
  selected = false,
  received = false,
  dimmed = false,
  highlighted = false,
  led = false,
  interactive = false,
  disabled = false,
  onSelect,
}: CardViewProps) {
  const face = <CardFace card={card} />;

  if (!interactive) {
    return (
      <CardStatic
        $selected={selected}
        $received={received}
        $dimmed={dimmed}
        $highlighted={highlighted}
        $led={led}
      >
        {face}
      </CardStatic>
    );
  }

  return (
    <CardButton
      type="button"
      $selected={selected}
      $received={received}
      $dimmed={dimmed}
      $highlighted={highlighted}
      $led={led}
      disabled={disabled}
      aria-label={cardName(card)}
      aria-pressed={selected}
      onClick={onSelect ? () => onSelect(card) : undefined}
    >
      {face}
    </CardButton>
  );
});
