import type { PassDirection } from '../domain/types';
import { PASS_COUNT } from '../domain/rules/passing';
import { Button, Notice } from '../styled';

const DIRECTION_LABEL: Record<PassDirection, string> = {
  left: 'your left',
  right: 'your right',
  across: 'across the table',
  hold: 'nobody',
};

interface PassSelectorProps {
  direction: PassDirection;
  selectedCount: number;
  onConfirm: () => void;
}

/** The "choose three cards to pass" bar, with a Confirm button at exactly 3. */
export function PassSelector({
  direction,
  selectedCount,
  onConfirm,
}: PassSelectorProps) {
  if (direction === 'hold') return null;

  const remaining = PASS_COUNT - selectedCount;
  const ready = selectedCount === PASS_COUNT;

  return (
    <Notice>
      <div style={{ marginBottom: 8 }}>
        Pass {PASS_COUNT} cards to {DIRECTION_LABEL[direction]} —{' '}
        {ready
          ? 'ready to pass'
          : `select ${remaining} more (${selectedCount}/${PASS_COUNT})`}
      </div>
      <Button $primary type="button" disabled={!ready} onClick={onConfirm}>
        Pass {PASS_COUNT} cards
      </Button>
    </Notice>
  );
}
