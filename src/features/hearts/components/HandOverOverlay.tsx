import type { GameState } from '../domain/types';
import { useFocusTrap } from './useFocusTrap';
import {
  Button,
  ModalActions,
  ModalCard,
  ModalSubtitle,
  ModalTitle,
  Overlay,
} from '../styled';

interface HandOverOverlayProps {
  state: GameState;
  onNextHand: () => void;
}

/** Recap shown between hands, before the next deal. */
export function HandOverOverlay({ state, onNextHand }: HandOverOverlayProps) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  const lastHand = state.scores[state.scores.length - 1] ?? [0, 0, 0, 0];

  return (
    <Overlay>
      <ModalCard
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Hand complete"
      >
        <ModalTitle>Hand {state.handNumber + 1} complete</ModalTitle>
        <ModalSubtitle>Points taken this hand</ModalSubtitle>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {state.players.map((player) => (
            <li key={player.id}>
              {player.name}: <strong>{lastHand[player.id]}</strong> · total{' '}
              {state.totals[player.id]}
            </li>
          ))}
        </ul>
        <ModalActions>
          <Button $primary type="button" data-autofocus onClick={onNextHand}>
            Next hand
          </Button>
        </ModalActions>
      </ModalCard>
    </Overlay>
  );
}
