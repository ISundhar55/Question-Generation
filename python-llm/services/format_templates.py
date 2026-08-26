"""
format_templates.py
-------------------
Standardized JSON format instructions and pedagogical rules for each question type.
Shared across all generation and refinement prompt builders.
"""

FORMAT_BY_TYPE = {
    "SINGLE_SELECT": """Each question object must follow this exact format:
{
  "questionType": "SINGLE_SELECT",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option A>", "B": "<option B>", "C": "<option C>", "D": "<option D>"},
  "answer": "<correct letter, e.g. A, B, C, or D>",
  "explanation": "• Option <Letter> (<Correct or Incorrect>): <Clear reason why this option is correct or incorrect>\\n• (Include a bullet for EVERY option letter present in options: A, B, C, D...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}
IMPORTANT for SINGLE_SELECT:
- Default: 4 options (A, B, C, D). If the teacher instructs a different count, add or remove letters accordingly. Always use consecutive letters starting from A.
- Vary the correct answer across available letters (A, B, C, D) — do not always pick Option A.
- MANDATORY RATIONALE: The explanation field MUST contain a bulleted item (• Option <Letter> (<Correct/Incorrect>)) for EVERY option in 'options', explaining why the correct choice is right and why each incorrect distractor is wrong.""",

    "MULTIPLE_SELECT": """Each question object must follow this exact format:
{
  "questionType": "MULTIPLE_SELECT",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option A>", "B": "<option B>", "C": "<option C>", "D": "<option D>"},
  "answer": "<pipe-separated list of correct letters, e.g. A|C or B|D>",
  "explanation": "• Option <Letter> (<Correct or Incorrect>): <Clear reason why this option is correct or incorrect>\\n• (Include a bullet for EVERY option letter present in options: A, B, C, D...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}
IMPORTANT for MULTIPLE_SELECT:
- Default: 4 options (A, B, C, D). Always use consecutive letters starting from A.
- MANDATORY: The answer field MUST contain AT LEAST 2 pipe-separated letters (minimum 2 correct answers). A MULTIPLE_SELECT question with only 1 correct answer is INVALID and will be rejected.
- The answer field must list all correct letters in alphabetical order, joined with | (pipe).
- MANDATORY RATIONALE: The explanation field MUST contain a bulleted item (• Option <Letter> (<Correct/Incorrect>)) for EVERY option in 'options', explaining why each correct choice is right and why each distractor is wrong.""",

    "MCQ": """Each question object must follow this exact format:
{
  "questionType": "SINGLE_SELECT",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question text>",
  "options": {"A": "<option A>", "B": "<option B>", "C": "<option C>", "D": "<option D>"},
  "answer": "<correct letter, e.g. A, B, C, or D>",
  "explanation": "• Option <Letter> (<Correct or Incorrect>): <Clear reason why this option is correct or incorrect>\\n• (Include a bullet for EVERY option letter present in options: A, B, C, D...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}
IMPORTANT for MCQ:
- Default: 4 options (A, B, C, D). Always use consecutive letters starting from A.
- Vary the correct answer across available letters (A, B, C, D).
- MANDATORY RATIONALE: The explanation field MUST contain a bulleted item (• Option <Letter> (<Correct/Incorrect>)) for EVERY option, explaining why each is correct or incorrect.""",

    "TRUE_FALSE": """Each question object must follow this exact format:
{
  "questionType": "TRUE_FALSE",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<statement that is clearly true or false>",
  "answer": "True" or "False",
  "explanation": "• True (<Correct or Incorrect>): <Clear explanation of why True is or is not the correct assessment of this statement>\\n• False (<Correct or Incorrect>): <Clear explanation of why False is or is not the correct assessment of this statement>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}
IMPORTANT for TRUE_FALSE:
- MANDATORY RATIONALE: The explanation field MUST provide an explicit rationale for BOTH True and False, clearly identifying which is correct and which is incorrect.""",

    "SHORT_ANSWER": """Each question object must follow this exact format:
{
  "questionType": "SHORT_ANSWER",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<question>",
  "answer": "<model answer in 1-3 sentences>",
  "explanation": "<detailed rationale explaining the complete concept and key points expected in the answer>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}""",

    "CONSTRUCTED_RESPONSE": """Each question object must follow this exact format:
{
  "questionType": "CONSTRUCTED_RESPONSE",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<sentence(s) with ___ for each blank>",
  "options": {
    "answers": [
      ["<primary correct answer for blank 1>", "<acceptable alternative synonym 1>", "<acceptable alternative synonym 2>"],
      ["<primary correct answer for blank 2>", "<acceptable alternative synonym 1>"]
    ]
  },
  "answer": "<pipe-separated primary correct answers in blank order, e.g. answer1|answer2>",
  "explanation": "• Blank <N> (<primary answer>): <Clear explanation of the concept and why the primary answer and acceptable alternatives are correct>\\n• (Provide a bullet for EVERY blank present in the question: Blank 1, Blank 2, ...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for CONSTRUCTED_RESPONSE:
- Create 1-3 blanks using ___ in the text. Use EXACTLY three underscores (___) for EVERY blank.
  Do NOT use ____ (4), _____ (5), or any other count — always exactly three underscores.
- Each element in options.answers MUST be an array of strings representing acceptable correct answers (synonyms, alternate spellings, abbreviations, or alternative terminology) for that blank.
- You MUST provide at least 2-3 acceptable alternatives inside the array for EACH blank.
- The first string in each array is the primary correct answer.
- The answer field must list only the primary correct answers joined with | (pipe).
- MANDATORY RATIONALE: The explanation field MUST provide a distinct bulleted rationale for EVERY blank present in the question (• Blank 1: ..., • Blank 2: ..., etc.), explaining the core concept and why the listed alternatives are valid.""",

    "DROPDOWN": """Each question object must follow this exact format:
{
  "questionType": "DROPDOWN",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<sentence(s) with ___ for each blank>",
  "options": {
    "blanks": [
      {"choices": ["<choice1>", "<choice2>", "<choice3>", "<choice4>"], "correct": "<correct_choice>"},
      {"choices": ["<choice1>", "<choice2>", "<choice3>", "<choice4>"], "correct": "<correct_choice>"}
    ]
  },
  "answer": "<pipe-separated correct answers in blank order, e.g. answer1|answer2>",
  "explanation": "• Blank <N>: '<correct_choice>' is correct because <reason>. Other choices (<distractor1>, <distractor2>, <distractor3>) are incorrect because <reason>.\\n• (Provide a bullet for EVERY blank dropdown present in the question: Blank 1, Blank 2, ...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for DROPDOWN:
- Create 2-3 blanks using ___ in the text.
- The number of objects in options.blanks must match the number of ___ in the text.
- Each blank must have exactly 4 choices (1 correct + 3 plausible distractors).
- The correct field must be identical to one of the choices strings.
- The answer field is the pipe-separated correct values in blank order.
- MANDATORY RATIONALE: The explanation field MUST provide a distinct bulleted rationale for EVERY blank dropdown (• Blank 1: ..., • Blank 2: ..., etc.), explaining why the chosen option is correct and why the other choices in that dropdown are incorrect distractors.""",

    "MATCHING_LINES": """Each question object must follow this exact format:
{
  "questionType": "MATCHING_LINES",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<stem instruction, e.g. Match each item in Column A with the correct item in Column B>",
  "options": {
    "left":  {"A": "<left item 1>", "B": "<left item 2>", "C": "<left item 3>", "D": "<left item 4>"},
    "right": {"1": "<right item 1>", "2": "<right item 2>", "3": "<right item 3>", "4": "<right item 4>"}
  },
  "answer": "A-<number>, B-<number>, C-<number>, D-<number>",
  "explanation": "• Match <LeftKey>-<RightKey> (<Left item> -> <Right item>): <Clear explanation of why these two items pair together>\\n• (Provide a bullet for EVERY matched pair: Match A-..., Match B-..., etc.)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for MATCHING_LINES:
- Left column keys MUST be uppercase letters: A, B, C, D.
- Right column keys MUST be digit strings: "1", "2", "3", "4".
- Every left key must have exactly one matching right key.
- The answer field must list all pairs in order, e.g. "A-2, B-4, C-1, D-3".
- MANDATORY RATIONALE: The explanation field MUST provide a distinct bulleted rationale for EVERY matched pair (• Match A-..., • Match B-..., etc.), clearly explaining the reason for the pairing.""",

    "ORDERING": """Each question object must follow this exact format:
{
  "questionType": "ORDERING",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<instruction/stem, e.g. Put these steps of the scientific method in the correct sequence:>",
  "options": ["<shuffled/incorrect ordered option 1>", "<shuffled/incorrect ordered option 2>", "<shuffled/incorrect ordered option 3>", "<shuffled/incorrect ordered option 4>"],
  "answer": "<pipe-separated correct sequence of options, in correct order, e.g. Option 3|Option 2|Option 1>",
  "explanation": "• Step <N> (<Option Text>): <Clear explanation of why this step/item is placed at position N in the sequence>\\n• (Provide a bullet for EVERY step in the sequence: Step 1, Step 2, ...)",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for ORDERING:
- Default: 3 to 5 items in the options array in shuffled/incorrect order. Follow teacher instructions for a different count.
- The answer field MUST consist of all the options strings exactly as written, sorted in their correct sequence, joined by a pipe (|).
- MANDATORY RATIONALE: The explanation field MUST provide a distinct bulleted rationale for EVERY step/item in the sequence (• Step 1: ..., • Step 2: ..., etc.), justifying its exact placement in the ordered sequence.""",

    "BACKGROUND_GRAPHIC": """Each question object must follow this exact format:
{
  "questionType": "BACKGROUND_GRAPHIC",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "<instruction/stem, e.g. Label the marked parts on the diagram by matching each label to the correct drop zone:>",
  "options": {
    "svg_graphic": "<raw standalone valid SVG code starting with <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' width='100%' height='100%'> and ending with </svg>. Must be an educational 2D vector diagram with clean shapes, gradients, and pointer lines for pins>",
    "drop_zone_width": 120,
    "drop_zone_height": 36,
    "drop_zones": [
      {
        "id": "zone_1",
        "pin_label": "A",
        "x_percent": <number between 10.0 and 85.0 representing X coordinate percentage of diagram>,
        "y_percent": <number between 10.0 and 85.0 representing Y coordinate percentage of diagram>,
        "description": "<short description of structure A on diagram>"
      },
      {
        "id": "zone_2",
        "pin_label": "B",
        "x_percent": <number between 10.0 and 85.0 representing X coordinate percentage of diagram>,
        "y_percent": <number between 10.0 and 85.0 representing Y coordinate percentage of diagram>,
        "description": "<short description of structure B on diagram>"
      },
      {
        "id": "zone_3",
        "pin_label": "C",
        "x_percent": <number between 10.0 and 85.0 representing X coordinate percentage of diagram>,
        "y_percent": <number between 10.0 and 85.0 representing Y coordinate percentage of diagram>,
        "description": "<short description of structure C on diagram>"
      }
    ],
    "label_bank": [
      "<correct_label_1>",
      "<correct_label_2>",
      "<correct_label_3>",
      "<distractor_label_1>",
      "<distractor_label_2>"
    ]
  },
  "answer": {
    "zone_1": "<correct_label_1>",
    "zone_2": "<correct_label_2>",
    "zone_3": "<correct_label_3>"
  },
  "explanation": "• Pin <Letter> / <ZoneId> (<Correct Label>): <Clear explanation of why this label is correct based on visual characteristics and biological/physical function>\\n• (Provide a bullet for EVERY drop zone: Pin A, Pin B, Pin C...)\\n• <Distractor Label> (Distractor): <Clear reason why this option is an incorrect choice that does not match any marked zone>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for BACKGROUND_GRAPHIC:
- drop_zone_width (default 120) and drop_zone_height (default 36): Provide integer pixel dimensions for the drop zone container badges.
- Create 2 to 4 drop zones positioned at distinct (x_percent, y_percent) locations on the SVG graphic.
- The label_bank MUST contain all correct labels plus 1-2 plausible distractor labels.
- The answer field MUST be a JSON object mapping each drop zone id to its correct label string.
- MANDATORY RATIONALE: The explanation field MUST contain a bulleted item for EVERY drop zone pin (explaining why that label is correct) AND for EVERY distractor label in the label_bank (explaining why it is incorrect/not present).""",

    "GAP_MATCH": """Each question object must follow this exact format:
{
  "questionType": "GAP_MATCH",
  "difficulty": "<difficulty>",
  "contentArea": "<content_area>",
  "grade": "<grade>",
  "text": "Complete the passage by dragging or selecting the correct terms from the response options into each gap.",
  "options": {
    "passage": "<A cohesive 2 to 4 sentence passage containing gaps denoted by [gap_1], [gap_2], [gap_3], etc. Example: Water moves into root cells through [gap_1]. It is then transported upwards through the stem via [gap_2] vessels, driven by the process of [gap_3] in the leaves.>",
    "gaps": [
      {
        "id": "gap_1",
        "label": "Gap 1"
      },
      {
        "id": "gap_2",
        "label": "Gap 2"
      }
      // Note: Vary the number of gaps dynamically between 2, 3, or 4 gaps depending on passage complexity (e.g. add gap_3, gap_4 where appropriate).
    ],
    "response_options": [
      "<correct_target_for_gap_1>",
      "<correct_target_for_gap_2>",
      "<plausible_distractor_1>",
      "<plausible_distractor_2>"
    ]
  },
  "answer": {
    "gap_1": "<correct_target_for_gap_1>",
    "gap_2": "<correct_target_for_gap_2>"
  },
  "explanation": "• Gap 1 (<correct_target_1>): <Clear reason why this term accurately fills gap 1 based on the passage context and scientific/mathematical rules>\\n• (Provide a bullet for EVERY gap: Gap 1, Gap 2, and Gap 3/4 if present)\\n• <Distractor 1> (Distractor): <Clear reason why this term is an incorrect choice that does not properly fit any gap in this passage>\\n• <Distractor 2> (Distractor): <Clear reason why this term is incorrect>",
  "sourceChunkIds": [<list of chunk_id integers used>]
}

IMPORTANT for GAP_MATCH:
- "text" contains the prompt/instruction stem (e.g. "Complete the passage by selecting the correct terms from the response options.").
- "options.passage" contains the narrative or scientific passage with embedded gap tokens: [gap_1], [gap_2], [gap_3], [gap_4], etc. Use EXACTLY [gap_1], [gap_2], etc. tokens in the passage.
- VARY GAP COUNT DYNAMICALLY: Vary the number of gaps between 2, 3, and 4 gaps per question based on the content depth and difficulty (e.g. 2 gaps for concise concepts, 3 gaps for standard passages, 4 gaps for multi-step processes). Do NOT fix all questions to 3 gaps.
- The number of gap tokens in "options.passage" MUST match the entries in "options.gaps".
- "options.gaps" MUST be a list of objects with "id" (e.g. "gap_1") and "label" (e.g. "Gap 1"). Do NOT include any hint fields.
- "options.response_options" MUST contain all the correct target terms plus 2-3 plausible distractors from the same subject domain and grade level. CRITICAL: "options.response_options" MUST be randomized and shuffled in mixed or alphabetical order so that options do NOT match the chronological/sequential order of the gaps.
- "answer" MUST be a JSON dictionary mapping each gap id (e.g. "gap_1") to its exact correct term string in "response_options".
- MANDATORY RATIONALE: The "explanation" field MUST provide a distinct bulleted rationale for EVERY gap assignment (• Gap 1 (...): ..., • Gap 2 (...): ...) AND a bullet for EVERY distractor in the response_options bank explaining why it is incorrect."""
}

# Backward compatibility alias
_FORMAT_BY_TYPE = FORMAT_BY_TYPE
