# AI-assisted Fast Create

Status: DONE

## Why

Fast Create lets a teacher paste a numbered list of questions instead of adding them one at
a time. Two things limit it today. The teacher still has to write the questions somewhere
first, and for a multiple-choice exercise the paste carries only the question text: every
question arrives with two empty answer options that the teacher fills in by hand.

This task gives the teacher a ready-made prompt to copy into any AI chat. The AI answers in
the exact text format Fast Create reads, and the teacher pastes that reply back. For
multiple choice the format now carries the options and the correct answer, so a whole
exercise can be built from one paste.

Grilling round held on 2026-10-22. Outcome: frontend-only, one fixed prompt per exercise
type, a lenient parser that reads multiple-choice options, and a correct answer that becomes
optional everywhere in the editor.

## Behaviour

In the exercise editor, the teacher picks the exercise type as before and opens Fast Create.
The side sheet now has a "Copy AI prompt" button above the paste box, under a short title
and two lines that say what the button is for and how to use it (wording in Decisions).
Pressing it copies the prompt for the chosen exercise type and shows a
"Copied" toast. The paste box's example text shows the format for that type.

The prompt tells the AI to reply with the questions only, in the format below, in the same
language as the teacher's material, and ends with "Material and instructions from the
teacher:" so the teacher types their topic and how many questions they want straight after
it in the chat.

Written-answer format, unchanged from today:

| Line | Meaning |
| --- | --- |
| `1.` or `1)` followed by text | Starts a question |
| Any other line | Continues the question above |

Multiple-choice format:

| Line | Meaning |
| --- | --- |
| `1.` or `1)` followed by text | Starts a question |
| `a)` `a.` `A)` `A.` through `f` followed by text | An answer option, two to six per question |
| `*` before the option letter | Marks that option as correct; may be absent |
| Any other line before the first option | Continues the question text |
| Blank line | Ignored |

The paste is lenient. Text before the first numbered line is ignored, as are code fences the
AI may wrap its reply in. A multiple-choice question with fewer than two options is topped
up with empty options. A question with no starred option is added with none marked. The
button still reads "Add N Questions", and a line under it says how many questions have no
correct answer marked, when any.

Saving no longer requires a correct answer on a multiple-choice question, whether it came
from Fast Create or was typed by hand. A new hand-typed question starts with no option
marked. Options must still number at least two and must all have text.

Fast Fill on the attempt screen uses the same line splitter and gains one fix: text before
the first numbered answer is ignored instead of becoming answer 1.

## UI sketch

For the owner. The Fast Create side sheet, multiple-choice exercise, after a paste. The
question list stays visible to the left as before.

```
┌─ Fast Create Questions ──────────────────────────────────── ✕ ─┐
│                                                                 │
│  Let an AI write the questions for you.                         │
│  Copy the prompt, paste it into ChatGPT, Claude or Gemini, and  │
│  add your topic. The reply comes back in the layout this box    │
│  accepts. Paste it below.                                       │
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │ ⧉  Copy AI prompt    │   ← toast: "Prompt copied. Paste it   │
│  └──────────────────────┘      into your AI chat."              │
│                                                                 │
│  Paste your numbered question list below                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Capital of France?                                   │    │
│  │ a) Berlin                                               │    │
│  │ *b) Paris                                               │    │
│  │ c) Rome                                                 │    │
│  │                                                         │    │
│  │ 2. Largest planet?                                      │    │
│  │ a) Mars                                                 │    │
│  │ b) Jupiter                                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ⚠ 1 question has no correct answer marked.                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [ Cancel ]  [ Add 2 Questions ]    │
└─────────────────────────────────────────────────────────────────┘
```

Before any text is pasted, the box shows the format as grey placeholder text, and the
warning line is absent. For a written-answer exercise the placeholder is the plain numbered
list and there are no lettered lines.

Result after "Add 2 Questions", in the question list:

```
Q1  Capital of France?
    ○ Berlin   ● Paris   ○ Rome

Q2  Largest planet?
    ○ Mars   ○ Jupiter            ← no option marked; saving is allowed
```

Clicking the ● of a marked option clears it. Clicking a ○ marks that option.

## Decisions

| Question | Decision |
| --- | --- |
| Does the format carry options and the correct answer for multiple choice? | Yes. The parser is extended, shaped so a later exercise type adds its own block reader. Written answer keeps today's format. |
| What does the multiple-choice format look like? | Numbered question, lettered options `a)` to `f)`, `*` before the correct option. The star may be absent. |
| Where does the prompt live? | A frontend constant, one per exercise type. No admin screen exists, so a prompt change ships like any copy change. |
| Does the app ask for topic and count? | No. The prompt ends with "Material and instructions from the teacher:" and the teacher types the rest in the chat. |
| Where is the button? | Inside the Fast Create side sheet, above the paste box, with the one-line description quoted above. The placeholder follows the exercise type. |
| Does the sheet get its own type selector? | No. It follows the exercise type already chosen in the editor. |
| What happens to imperfect AI output? | Added anyway. Missing options are topped up with empty ones, a missing star leaves nothing marked. |
| Preview? | Count of questions only, plus one line with the number lacking a correct answer. No rendered preview. |
| Fast Fill? | Shares the numbered-line splitter with Fast Create. Option parsing applies only in Fast Create. |
| Language? | Prompt in English, with an instruction to write in the language of the material. |
| Correct answer at save time? | Optional. The save check that demanded one is removed. The backend never checked it. |
| Button description wording? | "Copy this prompt into ChatGPT, Claude or Gemini, add your topic or lesson text, and paste the reply below." |
| Which option markers? | `a)`, `a.`, `A)`, `A.`. |
| Text before the first question? | Dropped, and code fences stripped, in the shared splitter. The prompt also tells the AI to output questions only. |
| Where does the plan live? | Here, in the frontend repository. Feature docs and roadmap update in the same work. |
| Does relaxing the correct-answer rule reach the manual editor? | Yes. The first option is no longer pre-marked on a new question. One rule for both paths. |
| Does Fast Fill inherit the intro-dropping fix? | Yes, with no flag to keep the old behaviour. |
| Button description wording, revisited 2026-10-24? | The one-liner did not say what the button was for. Replaced by a title, "Let an AI write the questions for you.", and two lines: "Copy the prompt, paste it into ChatGPT, Claude or Gemini, and add your topic. The reply comes back in the layout this box accepts. Paste it below." |

## Steps

1. Add `src/app/shared/utils/fast-create.ts` with a shared numbered-line splitter that drops
   text before the first numbered line and strips code fences, and a per-type block reader
   that returns `{ content, meta, warnings }` per question; multiple choice reads options and
   the star, written answer returns empty meta. Add `fast-create.spec.ts` covering: intro
   line dropped, code fence stripped, continuation lines, all four option markers, star
   present and absent, fewer than two options topped up, more than six options kept as six.
   — verify: `CHROME_BIN=... npm test -- --watch=false --browsers=ChromeHeadless` passes
   with the new spec.
2. Point the exercise editor's Fast Create and the attempt screen's Fast Fill at the shared
   splitter and delete both private parsers. Fast Fill behaviour unchanged except the intro
   fix. — verify: `npm run build` passes; in the running app, pasting "Answers:\n1. a\n2. b"
   into Fast Fill gives two answers.
3. In the exercise editor, make Fast Create use the per-type reader, apply parsed meta
   instead of default meta, and show the "N questions have no correct answer marked" line.
   — verify: paste a four-question multiple-choice block with one unstarred question; the
   button says "Add 4 Questions", the line says 1, the added questions show the options and
   stars from the paste.
4. Remove the "at least one correct option" save check and stop pre-marking the first option
   on a new question or on the default option row. — verify: a hand-typed multiple-choice
   question with no option marked saves; two-option and empty-text checks still fire.
5. Add `src/app/shared/utils/fast-create-prompts.ts` with one prompt per supported exercise
   type. Add the "Copy AI prompt" button, its description line, the "Copied" toast and the
   per-type placeholder to the side sheet. — verify: pressing the button puts the prompt for
   the current type on the clipboard; the toast shows; switching exercise type changes the
   placeholder and the copied prompt.
6. Docs. Update `../docs/features/exercises-and-submissions.md` (Fast Create paragraph,
   correct answer now optional, "Last checked" line), add the feature to the Finished list in
   `../docs/roadmap.md`, update `src/app/components/course-teacher/CLAUDE.md` (the parser is
   no longer duplicated; the shared util is its home), check the attempt screen's module
   `CLAUDE.md`, run `scripts/check-docs.sh`. — verify: `scripts/check-docs.sh` is clean and
   `npm run build` passes.

## Out of scope

- Calling an AI from the app. The teacher uses their own chat; nothing leaves the app.
- Fast Create for code, file-upload and project-link exercises. They have no editor screen.
- A form for topic and question count inside the sheet. The chat window is the place for it.
- An editable prompt or an admin screen for it.
- Automatic marking. The correct answer is stored as before and still not used for grading.
- Any backend change. The backend never validated options.

## Open

## Progress

- [x] Step 1
- [x] Step 2 (verified by the editor spec, not in a browser)
- [x] Step 3 (verified by the editor spec, not in a browser)
- [x] Step 4 (verified by the editor spec, not in a browser)
- [x] Step 5 (verified by the editor spec, not in a browser)
- [x] Step 6

Last session 2026-10-24: added an exercise editor spec covering the paste, the hint, the prompt copy, the placeholder, saving with no correct answer and the radio toggle. 64 tests green, build and check-docs clean. No browser session was available, so the owner's own look at the sheet is the only thing not done.
