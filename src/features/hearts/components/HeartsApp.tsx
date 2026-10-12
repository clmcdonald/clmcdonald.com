import { useCallback, useState } from 'react';
import { cardName } from '../domain/rules/cards';
import type { Card, Difficulty, GameState } from '../domain/types';
import {
  appendToHistory,
  buildHistoryEntry,
  clearHistory,
  DEFAULT_PLAYER_NAME,
  loadDifficulty,
  loadHistory,
  loadPlayerName,
  saveDifficulty,
  savePlayerName,
} from '../state/storage';
import type { ScoreHistoryEntry } from '../state/storage';
import { useHeartsGame } from '../state/useHeartsGame';
import {
  Button,
  Container,
  Notice,
  Title,
  TopBar,
  TopBarActions,
  VisuallyHidden,
} from '../styled';
import { GameOverModal } from './GameOverModal';
import { HandOverOverlay } from './HandOverOverlay';
import { HistoryPanel } from './HistoryPanel';
import { PassSelector } from './PassSelector';
import { SetupScreen } from './SetupScreen';
import { Table } from './Table';

/** The setup screen is shown until the player starts a game. */
type Screen = 'setup' | 'game';

/** Composes the whole game: setup, the table, and the overlays. */
export function HeartsApp() {
  const [playerName, setPlayerName] = useState(loadPlayerName);
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);
  const [history, setHistory] = useState<ScoreHistoryEntry[]>(loadHistory);
  const [screen, setScreen] = useState<Screen>('setup');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  // Persist the result exactly once per finished game (guaranteed by the hook).
  const handleGameOver = useCallback(
    (final: GameState) => {
      setHistory(
        appendToHistory(buildHistoryEntry(final, playerName, difficulty))
      );
    },
    [playerName, difficulty]
  );

  const game = useHeartsGame({
    onGameOver: handleGameOver,
    // Don't let an abandoned game keep playing behind the setup screen.
    active: screen === 'game',
  });
  const { state, selectPassCard, playCard, startGame } = game;
  const { phase } = state;

  const handleChangeName = useCallback((name: string) => {
    setPlayerName(name);
    savePlayerName(name);
  }, []);

  const handleChangeDifficulty = useCallback((next: Difficulty) => {
    setDifficulty(next);
    saveDifficulty(next);
  }, []);

  const handleStart = useCallback(() => {
    const name = playerName.trim() || DEFAULT_PLAYER_NAME;
    savePlayerName(name);
    setPlayerName(name);
    setHistoryOpen(false);
    setScoreboardOpen(false);
    setScreen('game');
    startGame(name, [difficulty, difficulty, difficulty]);
  }, [playerName, difficulty, startGame]);

  const handleNewGame = useCallback(() => {
    setHistoryOpen(false);
    setScoreboardOpen(false);
    setScreen('setup');
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  // Two stable handlers rather than one that closes over the phase and turn:
  // `CardView` is memoised, so the callback it receives must not change
  // identity on every AI turn. `Table` only makes cards clickable when the
  // phase and turn actually allow it, so the wrong branch is unreachable.
  const handleSelectPassCard = useCallback(
    (card: Card) => selectPassCard(card),
    [selectPassCard]
  );
  const handlePlayCard = useCallback(
    (card: Card) => playCard(card),
    [playCard]
  );
  const handleCardClick =
    phase === 'passing' ? handleSelectPassCard : handlePlayCard;

  const playing = screen === 'game' && game.started;
  const isPassing = phase === 'passing' && state.passDirection !== 'hold';

  return (
    <Container>
      <TopBar>
        <Title>
          <span aria-hidden="true">♡</span> Hearts
        </Title>
        <TopBarActions>
          {playing ? (
            <Button
              $ghost
              type="button"
              aria-expanded={scoreboardOpen}
              onClick={() => setScoreboardOpen((open) => !open)}
            >
              Scores
            </Button>
          ) : null}
          <Button
            $ghost
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            History{history.length > 0 ? ` (${history.length})` : ''}
          </Button>
          {playing ? (
            <Button $ghost type="button" onClick={handleNewGame}>
              New game
            </Button>
          ) : null}
        </TopBarActions>
      </TopBar>

      {playing ? (
        <Table
          state={state}
          legalPlays={game.humanLegalPlays}
          passSelection={game.passSelection}
          receivedCards={game.receivedCards}
          onCardClick={handleCardClick}
          scoreboardOpen={scoreboardOpen}
        >
          {/* The received cards are lifted in the hand itself, which says
              nothing to a screen reader — so the same information also goes
              out as text for assistive tech only. */}
          {game.receivedCards.length > 0 ? (
            <VisuallyHidden role="status">
              You received {game.receivedCards.map(cardName).join(', ')}
            </VisuallyHidden>
          ) : null}

          {isPassing ? (
            <PassSelector
              direction={state.passDirection}
              selectedCount={game.passSelection.length}
              onConfirm={game.confirmPass}
            />
          ) : null}

          {game.aiThinking ? (
            <Notice>{state.players[state.turn]?.name} is thinking…</Notice>
          ) : null}
        </Table>
      ) : (
        <SetupScreen
          playerName={playerName}
          difficulty={difficulty}
          onChangeName={handleChangeName}
          onChangeDifficulty={handleChangeDifficulty}
          onStart={handleStart}
        />
      )}

      {playing && phase === 'handOver' ? (
        <HandOverOverlay state={state} onNextHand={game.nextHand} />
      ) : null}

      {playing && phase === 'gameOver' ? (
        <GameOverModal
          state={state}
          onPlayAgain={game.playAgain}
          onNewGame={handleNewGame}
        />
      ) : null}

      {/* Last in the DOM and on the top layer, so it can be opened over any
          other dialog (e.g. to check history from the game-over screen). */}
      {historyOpen ? (
        <HistoryPanel
          entries={history}
          onClose={() => setHistoryOpen(false)}
          onClear={handleClearHistory}
        />
      ) : null}
    </Container>
  );
}
