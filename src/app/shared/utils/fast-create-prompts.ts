import { ExerciseType } from '../models/enums';

/**
 * The prompt a teacher copies into any AI chat. The reply pastes straight into Fast Create.
 * Keep each prompt in step with the parser in `fast-create.ts`.
 */

const COMMON_HEAD = `You write exercise questions for a teacher. Reply with the questions only: no introduction, no explanation, no code fences.`;

const COMMON_TAIL = `- Write in the same language as the material below.

Material and instructions from the teacher:
`;

const TEXT_ANSWER_PROMPT = `${COMMON_HEAD}

Use exactly this format, one question per numbered item:

1. First question text. It may run over several lines.
2. Second question text.

Rules:
- Number the questions 1., 2., 3. in order.
- Each question is a written-answer question; do not add options.
${COMMON_TAIL}`;

const MULTIPLE_CHOICE_PROMPT = `${COMMON_HEAD}

Use exactly this format, one block per question:

1. Question text. It may run over several lines.
a) option
b) option
*c) option
d) option

Rules:
- Number the questions 1., 2., 3. in order.
- Options use the letters a) to f), two to six per question.
- Put * in front of the correct option. Leave it out if the question has no single right answer.
- A blank line between questions.
${COMMON_TAIL}`;

const TEXT_ANSWER_PLACEHOLDER = '1. First question\n2. Second question\n3. Third question';

const MULTIPLE_CHOICE_PLACEHOLDER =
  '1. Capital of France?\na) Berlin\n*b) Paris\nc) Rome\n\n2. Second question\na) option\n*b) option';

export function fastCreatePrompt(type: ExerciseType): string {
  return type === ExerciseType.MULTIPLE_CHOICE ? MULTIPLE_CHOICE_PROMPT : TEXT_ANSWER_PROMPT;
}

export function fastCreatePlaceholder(type: ExerciseType): string {
  return type === ExerciseType.MULTIPLE_CHOICE ? MULTIPLE_CHOICE_PLACEHOLDER : TEXT_ANSWER_PLACEHOLDER;
}
