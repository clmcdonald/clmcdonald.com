import type { Difficulty } from '../domain/types';
import { DIFFICULTIES } from '../domain/types';
import { MAX_PLAYER_NAME_LENGTH } from '../state/storage';
import {
  Button,
  CenteredPanel,
  Field,
  FieldGroup,
  Muted,
  Segment,
  SegmentedControl,
  Stack,
  TextInput,
} from '../styled';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: 'AIs play loosely and misread the danger.',
  normal: 'AIs count points and duck the queen.',
  hard: 'AIs void suits, duck points and chase moons.',
};

interface SetupScreenProps {
  playerName: string;
  difficulty: Difficulty;
  onChangeName: (name: string) => void;
  onChangeDifficulty: (difficulty: Difficulty) => void;
  onStart: () => void;
}

/** Start-of-session screen: name, AI difficulty, and the start button. */
export function SetupScreen({
  playerName,
  difficulty,
  onChangeName,
  onChangeDifficulty,
  onStart,
}: SetupScreenProps) {
  return (
    <CenteredPanel>
      <Stack>
        <Muted>
          You against three AI opponents. Lowest score when someone reaches 100
          wins.
        </Muted>

        <Field>
          Your name
          <TextInput
            value={playerName}
            maxLength={MAX_PLAYER_NAME_LENGTH}
            autoComplete="nickname"
            placeholder="You"
            onChange={(event) => onChangeName(event.target.value)}
          />
        </Field>

        <FieldGroup>
          <span id="difficulty-label">AI difficulty</span>
          <SegmentedControl
            role="group"
            aria-labelledby="difficulty-label"
            aria-describedby="difficulty-hint"
          >
            {DIFFICULTIES.map((option) => (
              <Segment
                key={option}
                type="button"
                $active={option === difficulty}
                aria-pressed={option === difficulty}
                onClick={() => onChangeDifficulty(option)}
              >
                {DIFFICULTY_LABEL[option]}
              </Segment>
            ))}
          </SegmentedControl>
          <span id="difficulty-hint">{DIFFICULTY_HINT[difficulty]}</span>
        </FieldGroup>

        <Button $primary type="button" onClick={onStart}>
          Start game
        </Button>
      </Stack>
    </CenteredPanel>
  );
}
