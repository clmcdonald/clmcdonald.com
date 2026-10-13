import styled, { css } from 'styled-components';

/** Shared theme tokens. The felt green matches the route's body background. */
export const THEME = {
  felt: '#0d5c2e',
  feltLight: '#146b37',
  feltDark: '#073c1c',
  /**
   * `felt` at zero alpha. The table's vignette fades in from a band of flat
   * felt, and this is the other end of that fade. Spelled out rather than
   * written as `transparent` so the fade can only ever be felt-coloured.
   */
  feltFade: 'rgba(13, 92, 46, 0)',
  cardWhite: '#fdfdfd',
  red: '#c0392b',
  black: '#1f1f1f',
  cardBack: '#1f3a8a',
  cardBackDark: '#16265c',
  gold: '#e0b14b',
  /** Marks the card that led the trick. Deliberately not the winner's gold. */
  lead: '#4dabf7',
  text: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.74)',
  panel: 'rgba(0, 0, 0, 0.28)',
} as const;

export const Container = styled.div`
  --card-w: 64px;
  --card-h: calc(var(--card-w) * 1.4);
  --card-border: 1px;
  /* The trick is a cross of three card columns with a gap between them, and on
     a narrow screen the seat row is sized around it: the table's middle column
     is exactly this wide, so the cross always has room and the seats take what
     is left. One source of truth, used by both. */
  --trick-gap: 6px;
  --cross-w: calc(var(--card-w) * 3 + var(--trick-gap) * 2);

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  color: ${THEME.text};
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  /* The felt is a lamp over the table: warm near the middle, falling away to
     the rails — but the very top of the page is flat felt, on purpose.

     In an installed PWA the status bar is painted over the top of this
     element (the page is viewport-fit=cover, and the theme colour is the same
     green), so whatever colour the felt is at its top edge has to match the
     strip exactly. A vignette that is already partway to feltDark at zero
     height leaves a visible seam across the top of the screen; the flat band
     below is what stops that. */
  background-color: ${THEME.felt};
  background-image:
    linear-gradient(180deg, ${THEME.felt} 0, ${THEME.feltFade} 18%),
    radial-gradient(
      circle at 50% 42%,
      ${THEME.feltLight} 0%,
      ${THEME.felt} 48%,
      ${THEME.feltDark} 100%
    );
  overflow-x: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    env(safe-area-inset-bottom) env(safe-area-inset-left);

  /* Phones used to shrink the cards hard (38px) so that a full hand could fit
     the narrow strip the hand was given. The hand is now as wide as the table,
     so the cards can sit close to their desktop size; how tightly they fan is
     worked out from the row itself, so thirteen cards fit at any width. */
  @media (max-width: 720px) {
    --card-w: 52px;
  }
`;

export const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  flex-wrap: wrap;
`;

export const Title = styled.h1`
  font-size: 1.15rem;
  margin: 0;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const TopBarActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

interface ButtonProps {
  $primary?: boolean;
  $ghost?: boolean;
}

export const Button = styled.button<ButtonProps>`
  appearance: none;
  border-radius: 999px;
  border: 1px solid ${THEME.gold};
  background: transparent;
  color: ${THEME.text};
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  min-height: 44px;
  padding: 0 18px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 140ms ease,
    color 140ms ease,
    opacity 140ms ease;

  ${(props) =>
    props.$primary &&
    css`
      background: ${THEME.gold};
      color: #2b1d00;
      border-color: ${THEME.gold};
    `}

  ${(props) =>
    props.$ghost &&
    css`
      border-color: rgba(255, 255, 255, 0.35);
      font-weight: 500;
    `}

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }

  &:focus-visible {
    outline: 3px solid ${THEME.gold};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const Felt = styled.main`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  padding: 0 12px 12px;
  min-height: 0;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }
`;

export const TableArea = styled.section`
  display: grid;
  grid-template-areas:
    '. north .'
    'west center east'
    '. notices .'
    '. south .';
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  align-items: center;
  /* Named because the narrow-screen seat width is derived from it; see the
     Seat component below. */
  --table-gap: 8px;
  gap: var(--table-gap);
  min-height: 0;

  /* A phone cannot afford the two side columns the desktop table has — at 390px
     they come out around 100px wide, narrower than a seat's own name and card
     count, so the seat headers were squeezed to nothing and their fans ran off
     the edge of the screen.

     So on a narrow screen the seats keep their places around the table but the
     middle column narrows to exactly the width of the trick cross and the two
     side seats take what is left (about 91px each at 390px, which the derived
     fan lap and the wrapping seat header are built to absorb). The hand gets a
     full-width row of its own, which was the real reason it used to scroll.

     The centre column was 1.6fr — wide enough for the pass bar as well as the
     cross. The pass bar needs nearly the whole screen, so it moves out to a row
     of its own rather than squeezing into a cross-width column. */
  @media (max-width: 900px) {
    grid-template-areas:
      'north north north'
      'west center east'
      'notices notices notices'
      'south south south';
    grid-template-columns: minmax(0, 1fr) var(--cross-w) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
  }
`;

/** Where a seat sits around the table, and which way a trick flies to it. */
export type SeatArea = 'north' | 'south' | 'east' | 'west';

export const Seat = styled.div<{ $area: SeatArea }>`
  grid-area: ${(props) => props.$area};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;

  /* On a narrow screen the middle column is only as wide as the trick cross, so
     the seat across the table sits in a cell twice as wide as the two beside it
     and draws a visibly wider fan — one opponent's hand looking twice the size
     of the others' reads as a rendering fault. It spans the whole top row
     instead and is held to exactly what its neighbours get: half of what is
     left once the cross and the two gaps are taken out. (A spanning item's
     containing block is the sum of its columns *and* the gaps between them, so
     this percentage comes out at the side column's width at any viewport.) */
  @media (max-width: 900px) {
    ${(props) =>
      props.$area === 'north' &&
      css`
        justify-self: center;
        width: calc((100% - var(--cross-w) - var(--table-gap) * 2) / 2);
      `}
  }
`;

export const SeatHeader = styled.div<{
  $active?: boolean;
  /** This seat took the trick currently being collected. */
  $winner?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 6px;
  /* Wrap rather than squeeze. A seat header is a name plus a card count (plus
     the hand's row of score and prompt), and when the pill is narrower than
     all of that the flex line used to take the difference out of whichever
     item could shrink the most — the name, whose overflow:hidden gives it a
     minimum size of zero. That is how "You" was rendered as "Y…". Wrapping
     keeps every item at the width it actually needs and moves what does not
     fit onto a second line. */
  flex-wrap: wrap;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${(props) =>
    props.$winner
      ? 'rgba(224, 177, 75, 0.42)'
      : props.$active
        ? 'rgba(224, 177, 75, 0.24)'
        : THEME.panel};
  border: 1px solid
    ${(props) =>
      props.$winner || props.$active
        ? THEME.gold
        : 'rgba(255, 255, 255, 0.12)'};
  font-size: 0.8rem;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;

  ${(props) =>
    props.$winner &&
    css`
      color: #fff;
      box-shadow: 0 0 0 3px rgba(224, 177, 75, 0.3);
      animation: seatWin 640ms ease-out;
    `}

  @keyframes seatWin {
    0% {
      transform: scale(1);
    }
    35% {
      transform: scale(1.12);
    }
    100% {
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const SeatName = styled.span`
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SeatMeta = styled.span`
  color: ${THEME.textMuted};
  font-size: 0.72rem;
`;

/**
 * An opponent's hand, face down.
 *
 * The backs close up to whatever room the seat has, so the fan always fits —
 * it used to lap by a fixed fraction of a card, which on a phone pushed the
 * last back off the edge of the screen. How many backs are drawn is the
 * caller's business (see MAX_VISIBLE_BACKS).
 *
 * `$count` is what the lap is divided by; it is a prop because the divisor goes
 * into the CSS itself, and making it a variable would need a division the
 * parser will not do.
 */
export const CardFan = styled.div<{ $count: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  /* The full width of the seat. The lap below takes a percentage, which
     resolves against this box, so giving it a definite width is what keeps the
     sum of the cards inside the seat's column rather than spilling out of it. */
  width: 100%;

  > * + * {
    /* The lap wants to be 58% of a card, and settles for less if the seat
       cannot lend it that much — the minimum of the two is exactly the lap that
       leaves the fan as wide as its box and no wider. */
    margin-left: calc(
      min(
          calc(var(--card-w) * 0.58),
          calc(
            (100% - var(--card-w)) / ${(props) => Math.max(1, props.$count - 1)}
          )
        ) - var(--card-w) -
        0.5px
    );
  }
`;

export const CenterArea = styled.div`
  grid-area: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 0;
`;

/**
 * The pass bar and the "thinking…" notice.
 *
 * Its own row rather than a child of `CenterArea`, because on a narrow screen
 * the centre column is only as wide as the trick cross (~168px at a phone's
 * card size) and the pass bar needs nearly the whole screen to stay on one
 * line. It sits between the table and the hand — next to the cards being
 * chosen, which is where it belongs.
 */
export const NoticeArea = styled.div`
  grid-area: notices;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
`;

export const TrickGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, auto);
  grid-template-areas:
    '. north .'
    'west . east'
    '. south .';
  gap: var(--trick-gap);
  align-items: center;
  justify-items: center;
`;

export const TrickSlot = styled.div<{
  $area: SeatArea;
}>`
  grid-area: ${(props) => props.$area};
`;

/**
 * Plays a card into the trick as it lands.
 *
 * Deliberately a separate element from the fly-out below: changing an element's
 * `animation` restarts it, so the collection would otherwise replay the entry
 * animation on the three cards already sitting on the table.
 */
export const TrickCardEnter = styled.div`
  animation: trickIn 220ms ease;

  @keyframes trickIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/**
 * Collects the trick towards whoever won it.
 *
 * Two beats, deliberately: the winning card's gold ring and the seat highlight
 * land first, then a pause, then the cards travel. Without the pause the
 * movement and the highlight arrive together and neither reads — the point of
 * the delay is that you register who took it before the cards move.
 *
 * The delay also lets the last card of the trick land and then some: the fourth
 * card's own entry animation runs 220ms, so the table is fully still for the
 * rest of the pause. 600 + 660 = 1260ms, safely inside the 1400ms the hook
 * allows before it clears the trick.
 */
export const TrickCard = styled.div<{ $flyTo?: SeatArea }>`
  /* Collecting the trick: every card slides to the seat that won it. The
     offsets are in card widths so they hold up at all three card sizes, and
     the travel only needs to read as "towards that player" — the seats sit one
     grid cell outside the trick, and the destination is also called out by the
     winner's seat and the caption. */
  ${(props) =>
    props.$flyTo &&
    css`
      --fly-x: 0px;
      --fly-y: 0px;
      ${
        props.$flyTo === 'north' &&
        css`
          --fly-y: calc(var(--card-h) * -2.1);
        `
      }
      ${
        props.$flyTo === 'south' &&
        css`
          --fly-y: calc(var(--card-h) * 2.1);
        `
      }
      ${
        props.$flyTo === 'east' &&
        css`
          --fly-x: calc(var(--card-w) * 2.6);
        `
      }
      ${
        props.$flyTo === 'west' &&
        css`
          --fly-x: calc(var(--card-w) * -2.6);
        `
      }
      /* The single keyword meaning forwards + backwards. Writing both keywords
         is invalid in the shorthand, and the browser silently drops the whole
         declaration — which is why the cards never moved at all.

         The long delay is deliberate: the trick sits still for that beat so
         there is time to read all four cards and the winner's ring before
         anything moves. Keep it in step with TRICK_HOLD_MS. */
      animation: trickOut 660ms cubic-bezier(0.45, 0, 0.85, 0.5) 600ms both;
    `}

  /* The fill holds the card at its from state during the delay, so the flight
     states both ends: it begins exactly where the card already sits and ends
     at the winner, shrinking as it goes. */
  @keyframes trickOut {
    from {
      opacity: 1;
      transform: none;
    }
    to {
      opacity: 0;
      transform: translate(var(--fly-x), var(--fly-y)) scale(0.45);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/**
 * Names whoever took the trick, in the centre of the table.
 *
 * Always rendered (empty between tricks) so the table does not jump every time
 * a trick ends. It is a live region, so the winner is announced as well as
 * seen — without it, a reduced-motion player would get no signal at all.
 */
export const TrickResult = styled.p`
  min-height: 1.3em;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${THEME.gold};
  text-align: center;
  /* The centre column is narrow on a phone and the name is whatever the
     player typed, so keep the caption to one line and clip it rather than
     letting it wrap and shove the table around. The full name is still in the
     DOM, so the live region above announces it either way. */
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 400px) {
    font-size: 0.75rem;
  }

  /* The animation lives on the inner span, which is mounted fresh each time a
     trick is taken — so the fade replays on every trick, while the outer
     element stays put and keeps the table from jumping. */
  > span {
    animation: trickResultIn 240ms ease;
  }

  @keyframes trickResultIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    > span {
      animation: none;
    }
  }
`;

export const HandArea = styled.div`
  grid-area: south;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
`;

/**
 * The human's hand: one fanned row of cards, the whole hand on screen.
 *
 * The lap between cards is derived from the row's own width instead of being a
 * fixed fraction of a card. A fixed one cannot fit a whole hand: thirteen cards
 * at a sixth of their width are half again as wide as a phone's screen, so the
 * row scrolled and its last cards sat off the edge. Deriving the lap from the
 * width means thirteen cards always fit, on any screen, with no breakpoint to
 * keep in step — and the cards stay as spread as the room allows, which keeps
 * them legible (the rank and suit corner wants roughly the left 40% of a card
 * showing above the card in front of it).
 *
 * The 0.58 cap is the spacing a hand wants when there is room to spare, so the
 * desktop fan is unchanged; the overflow-x below is a last-resort fallback that
 * arithmetically should never be reached.
 */
export const HandRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  min-width: 0;
  padding: 18px 8px 4px;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  touch-action: manipulation;
  scrollbar-width: thin;

  > * + * {
    /* Divided by twelve, not by the number of cards: thirteen is the largest
       hand in a four-player deal, so a row sized for thirteen fits every hand
       the game can deal. */
    margin-left: calc(
      min(calc(var(--card-w) * 0.58), calc((100% - var(--card-w)) / 12)) - var(
          --card-w
        ) -
        1px
    );
  }
`;

interface CardVisualProps {
  $selected?: boolean;
  /** Cards that just arrived in the pass. Lifted like `$selected`, but a
   *  notification rather than a toggle, so it does not set `aria-pressed`. */
  $received?: boolean;
  /** This card took the trick: gold ring. */
  $highlighted?: boolean;
  /** This card led the trick: blue ring, so it is never confused with the
   *  card that took it. */
  $led?: boolean;
  $dimmed?: boolean;
  $placeholder?: boolean;
}

/** The lifted, gold-outlined look, shared by selection and just-received. */
const raisedStyles = css`
  transform: translateY(calc(var(--card-h) * -0.18));
  box-shadow: 0 10px 16px rgba(0, 0, 0, 0.45);
  outline: 2px solid ${THEME.gold};
  outline-offset: -1px;
`;

export const cardStyles = css<CardVisualProps>`
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: var(--card-w);
  height: var(--card-h);
  padding: 0;
  background: ${THEME.cardWhite};
  border: var(--card-border) solid rgba(0, 0, 0, 0.18);
  border-radius: calc(var(--card-w) * 0.09);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  color: ${THEME.black};
  font-family: inherit;
  user-select: none;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;

  /* Raise a card the pointer is over, but never override the lifted,
     outlined look of a card that is already selected. */
  &:not(:disabled)[aria-pressed='false']:hover {
    transform: translateY(-6%);
  }

  ${(props) => (props.$selected || props.$received) && raisedStyles}

  /* Declared before the winner's ring so that if the leader goes on to take the
     trick (perfectly possible — the highest card of the led suit wins), the
     gold of the taker is what shows. */
  ${(props) =>
    props.$led &&
    css`
      box-shadow:
        0 0 0 2px ${THEME.lead},
        0 4px 12px rgba(0, 0, 0, 0.45);
    `}

  ${(props) =>
    props.$highlighted &&
    css`
      box-shadow:
        0 0 0 2px ${THEME.gold},
        0 4px 12px rgba(0, 0, 0, 0.45);
    `}

  ${(props) =>
    props.$dimmed &&
    css`
      /* Wash an unplayable card with translucent grey instead of fading the
         whole card out: the rank and suit stay readable, so the player can
         still read their hand while seeing at a glance what cannot be played.
         The pseudo-element is generated after the corners and pip, so it paints
         over them.
         The negative inset is what covers the border: inset 0 resolves
         against the padding box, which would leave a hairline of the card's
         white face showing through the semi-transparent border all the way
         round. Going one border-width out puts the overlay exactly on the
         border box, so the inherited border-radius still matches the card's
         outer rounding. */
      &::after {
        content: '';
        position: absolute;
        inset: calc(var(--card-border) * -1);
        border-radius: inherit;
        background: rgba(18, 20, 22, 0.45);
        pointer-events: none;
      }
    `}

  ${(props) =>
    props.$placeholder &&
    css`
      background: transparent;
      border: 1px dashed rgba(255, 255, 255, 0.22);
      box-shadow: none;
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const CardStatic = styled.div<CardVisualProps>`
  ${cardStyles}
`;

export const CardButton = styled.button<CardVisualProps>`
  ${cardStyles}
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;

  &:disabled {
    cursor: default;
  }

  &:focus-visible {
    outline: 3px solid ${THEME.gold};
    outline-offset: 2px;
  }
`;

/**
 * The rank-and-suit index in the top-left corner (and its rotated twin in the
 * bottom-right).
 *
 * The two glyphs are stacked, so the index is twice its font size tall, and
 * that height is what sets how much room the centre pip has. A card is only
 * 1.4x its width, so an index at 0.28 of the card width grew to 40% of the
 * card's height and ran straight into a centred pip — most visibly on "10",
 * which is also the widest rank, so it crowded the pip on both axes.
 */
export const CardCorner = styled.span<{ $red?: boolean; $flipped?: boolean }>`
  position: absolute;
  top: calc(var(--card-w) * 0.06);
  left: calc(var(--card-w) * 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  font-weight: 700;
  font-size: calc(var(--card-w) * 0.22);
  color: ${(props) => (props.$red ? THEME.red : THEME.black)};

  ${(props) =>
    props.$flipped &&
    css`
      top: auto;
      left: auto;
      bottom: calc(var(--card-w) * 0.06);
      right: calc(var(--card-w) * 0.08);
      transform: rotate(180deg);
    `}
`;

/**
 * The large suit glyph in the middle of the card.
 *
 * Sized against the corner index rather than on its own: the pip is centred
 * vertically, so its top edge sits at half the card height minus half its own
 * height, and the corner index reaches down from the top-left. At 0.56 of the
 * card width the two overlapped. 0.40 clears the index with a few pixels to
 * spare at every card size while still reading as the card's main glyph.
 */
export const CardPip = styled.span<{ $red?: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: calc(var(--card-w) * 0.4);
  color: ${(props) => (props.$red ? THEME.red : THEME.black)};
  opacity: 0.9;
`;

export const CardBackFace = styled(CardStatic)`
  background: repeating-linear-gradient(
    45deg,
    ${THEME.cardBack} 0,
    ${THEME.cardBack} 4px,
    ${THEME.cardBackDark} 4px,
    ${THEME.cardBackDark} 8px
  );
  border: 2px solid rgba(255, 255, 255, 0.85);
`;

export const Panel = styled.aside<{ $open?: boolean }>`
  background: ${THEME.panel};
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  min-width: 240px;
  max-height: 100%;
  overflow: auto;
  box-sizing: border-box;

  @media (max-width: 900px) {
    min-width: 0;
    display: ${(props) => (props.$open ? 'block' : 'none')};
    max-height: 40dvh;
  }
`;

export const PanelHeading = styled.h2`
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${THEME.textMuted};
  margin: 0 0 8px;
`;

export const ScoreTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;

  th,
  td {
    padding: 4px 6px;
    text-align: center;
    white-space: nowrap;
  }

  th {
    color: ${THEME.textMuted};
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  td:first-child,
  th:first-child {
    text-align: left;
  }

  tbody tr + tr td {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

export const ScoreTotal = styled.td<{ $leader?: boolean }>`
  font-weight: 700;
  color: ${(props) => (props.$leader ? THEME.gold : THEME.text)};
`;

/**
 * Available to assistive tech only.
 *
 * Used where a state that is obvious visually — cards jumping up out of the
 * hand — carries real information that a screen reader would otherwise miss.
 */
export const VisuallyHidden = styled.p`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

export const Notice = styled.div`
  padding: 6px 12px;
  border-radius: 8px;
  background: ${THEME.panel};
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 0.8rem;
  color: ${THEME.textMuted};
  text-align: center;
`;

/** `$top` lifts an overlay above another one (history over the game-over card). */
export const Overlay = styled.div<{ $top?: boolean }>`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.6);
  z-index: ${(props) => (props.$top ? 30 : 20)};
  animation: fadeIn 180ms ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const ModalCard = styled.div`
  background: linear-gradient(180deg, #10402a, #0a2f1d);
  border: 1px solid ${THEME.gold};
  border-radius: 16px;
  padding: 20px;
  width: min(520px, 100%);
  max-height: 86dvh;
  overflow: auto;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
  animation: pop 200ms ease;

  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const ModalTitle = styled.h2`
  margin: 0 0 4px;
  font-size: 1.3rem;
`;

export const ModalSubtitle = styled.p`
  margin: 0 0 16px;
  color: ${THEME.textMuted};
  font-size: 0.88rem;
`;

export const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
  color: ${THEME.textMuted};
  margin-bottom: 12px;
  width: 100%;
  max-width: 320px;
  text-align: left;
`;

/** Same look as `Field`, for control groups that are not a single label. */
export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
  color: ${THEME.textMuted};
  margin-bottom: 12px;
  width: 100%;
  max-width: 320px;
  text-align: left;
`;

export const TextInput = styled.input`
  appearance: none;
  font: inherit;
  color: ${THEME.text};
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 8px;
  padding: 10px 12px;
  min-height: 44px;
  box-sizing: border-box;

  &:focus-visible {
    outline: 3px solid ${THEME.gold};
    outline-offset: 1px;
  }
`;

export const SegmentedControl = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

export const Segment = styled.button<{ $active?: boolean }>`
  appearance: none;
  font: inherit;
  font-size: 0.82rem;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 8px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  background: ${(props) => (props.$active ? THEME.gold : 'rgba(0, 0, 0, 0.3)')};
  color: ${(props) => (props.$active ? '#2b1d00' : THEME.text)};
  border: 1px solid
    ${(props) => (props.$active ? THEME.gold : 'rgba(255, 255, 255, 0.24)')};
  font-weight: ${(props) => (props.$active ? 700 : 500)};

  &:focus-visible {
    outline: 3px solid ${THEME.gold};
    outline-offset: 2px;
  }
`;

export const Muted = styled.p`
  color: ${THEME.textMuted};
  font-size: 0.85rem;
  margin: 0;
`;

export const CenteredPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
  min-height: 0;
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
`;

export const StatsGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 8px;
  margin: 0 0 16px;

  div {
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 8px 10px;
    text-align: center;
  }

  dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${THEME.textMuted};
  }

  dd {
    margin: 2px 0 0;
    font-size: 1.05rem;
    font-weight: 700;
  }
`;

export const HistoryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40dvh;
  overflow-y: auto;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 0.82rem;
  }
`;

export const ResultBadge = styled.span<{ $result: 'win' | 'lose' | 'tie' }>`
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid
    ${(props) =>
      props.$result === 'win'
        ? THEME.gold
        : props.$result === 'tie'
          ? 'rgba(255, 255, 255, 0.4)'
          : 'rgba(255, 255, 255, 0.24)'};
  background: ${(props) =>
    props.$result === 'win' ? 'rgba(224, 177, 75, 0.22)' : 'transparent'};
  color: ${(props) => (props.$result === 'win' ? THEME.gold : THEME.textMuted)};
`;

export const Spacer = styled.span`
  flex: 1;
`;
