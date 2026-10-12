import { useState } from 'react';
import { useFocusTrap } from './useFocusTrap';
import type { ScoreHistoryEntry } from '../state/storage';
import { summarise } from '../state/storage';
import {
  Button,
  HistoryList,
  ModalActions,
  ModalCard,
  ModalSubtitle,
  ModalTitle,
  Muted,
  Overlay,
  ResultBadge,
  Spacer,
  StatsGrid,
} from '../styled';

/** How many past games the list shows before it stops. */
const VISIBLE_LIMIT = 20;

const RESULT_LABEL = { win: 'Win', lose: 'Loss', tie: 'Tie' } as const;

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface HistoryPanelProps {
  entries: ScoreHistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}

/** Past games plus win/loss stats, shown as a modal over the game. */
export function HistoryPanel({ entries, onClose, onClear }: HistoryPanelProps) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const stats = summarise(entries);
  const visible = entries.slice(0, VISIBLE_LIMIT);

  return (
    <Overlay $top>
      <ModalCard
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Game history"
      >
        <ModalTitle>History</ModalTitle>
        <ModalSubtitle>Your games on this device</ModalSubtitle>

        <StatsGrid>
          <div>
            <dt>Played</dt>
            <dd>{stats.played}</dd>
          </div>
          <div>
            <dt>Wins</dt>
            <dd>{stats.wins}</dd>
          </div>
          <div>
            <dt>Losses</dt>
            <dd>{stats.losses}</dd>
          </div>
          <div>
            <dt>Ties</dt>
            <dd>{stats.ties}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{stats.winRate}%</dd>
          </div>
          <div>
            <dt>Moons</dt>
            <dd>{stats.moons}</dd>
          </div>
        </StatsGrid>

        {visible.length === 0 ? (
          <Muted>No games finished yet — play one to start your history.</Muted>
        ) : (
          <HistoryList>
            {visible.map((entry) => (
              <li key={`${entry.date}-${entry.playerName}`}>
                <ResultBadge $result={entry.result}>
                  {RESULT_LABEL[entry.result]}
                </ResultBadge>
                <span>{formatDate(entry.date)}</span>
                <span>
                  {entry.finalTotals.join(' · ')} pts · {entry.hands} hand
                  {entry.hands === 1 ? '' : 's'}
                  {entry.moons > 0 ? ` · ${entry.moons}🌙` : ''}
                </span>
                <Spacer />
                <Muted>{entry.difficulty}</Muted>
              </li>
            ))}
          </HistoryList>
        )}

        {entries.length > VISIBLE_LIMIT ? (
          <Muted>
            Showing the {VISIBLE_LIMIT} most recent of {entries.length} games.
          </Muted>
        ) : null}

        <ModalActions>
          {entries.length > 0 ? (
            confirmingClear ? (
              <Button
                type="button"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
              >
                Yes, clear history
              </Button>
            ) : (
              <Button
                $ghost
                type="button"
                onClick={() => setConfirmingClear(true)}
              >
                Clear history
              </Button>
            )
          ) : null}
          <Button $primary type="button" data-autofocus onClick={onClose}>
            Close
          </Button>
        </ModalActions>
      </ModalCard>
    </Overlay>
  );
}
