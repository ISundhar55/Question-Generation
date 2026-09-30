# QUESTION MECHANICS & FORMATTING STANDARDS

[STEM_MECHANICS]
• Stem Mechanics:
* Phrase stems as a complete, focused task worded in direct question form whenever possible.
* Match the specified grade-level reading level and vocabulary; keep reading burden low.
* Grammatical Neutrality: Ensure the stem does not provide grammatical clues to the correct answer (e.g. avoid "a/an" matching only one choice).
* Do not reveal, imply, or embed the answer in the stem.
* Avoid double negatives and ambiguous wording.
* Never use “All of the above” or “None of the above.”
[/STEM_MECHANICS]

[LANGUAGE_LEVEL]
• Language & Reading Level:
* Match vocabulary, sentence complexity, and reading level to the specified grade.
* Spell out abbreviations or acronyms on first use when appropriate.
* Preserve the correct spelling, units, terminology, and proper nouns from the approved educational content.
[/LANGUAGE_LEVEL]

[TABLES_AND_DATA]
• Tables & Data:
* Format tables using standard GitHub-Flavored Markdown with pipe separators:
  | Header 1 | Header 2 |
  | :--- | :--- |
  | Value 1 | Value 2 |
* Include a header row and separator row. Do not use informal or dash-based tables.
[/TABLES_AND_DATA]

[BLANK_MARKERS]
• Blank Markers (For Blank-Based Items):
* Use exactly three underscores (`___`) for each blank.
* Do not put numbers or labels inside the blanks (write `___`, never `___1___`).
* The number of blanks must match the required number of responses.
* Every blank must directly assess the targeted learning objective.
* Do not include filler blanks, unnecessary steps, or blanks requiring unstated outside knowledge.
[/BLANK_MARKERS]

[MULTIPLE_SELECT]
• Multiple-Select Standards:
* Always provide exactly 5 options (`A`, `B`, `C`, `D`, `E`).
* MUST have more than one correct answer (e.g., "A|C" or "A|B|C"). Never create a multiple-select item with only one correct answer.
* Stem-Answer Agreement: The count requested in the stem (e.g., "Which TWO...", "Select THREE...") must match the exact number of correct answers.
* List correct letters in alphabetical order separated by `|` (e.g., "A|C" or "B|D|E").
[/MULTIPLE_SELECT]

[MATH_ACCURACY]
• Mathematics & Numerical Accuracy:
* Verify all calculations, comparisons, and multi-step arithmetic before generating the stem, options, answer, and explanation.
* Ensure every numerical option is consistent with the information and calculations in the stem.
* Do not provide an option containing an incorrect calculation as the intended correct answer.
* Write equations and variables cleanly in plain text (e.g., `3x + 2 = 38`), avoiding raw LaTeX `$` signs.
* Use standard Unicode mathematical symbols where appropriate, such as `°`, `×`, `÷`, `²`, `³`, `√`, `π`, `≤`, `≥`, and `±`.
[/MATH_ACCURACY]
