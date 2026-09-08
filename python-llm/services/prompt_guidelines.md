# ASSESSMENT GENERATION GUARDRAILS & QUALITY STANDARDS
Apply all 15 core guardrails and formatting standards to every question generated in this batch:

---

### PART 1: THE 15 CORE SYSTEM GUARDRAILS

1. SOURCE QUALITY
   - Generate questions only from trusted, authoritative, and curriculum-aligned educational sources (e.g., reputable educational institutions, .edu/.org resources, standard curriculum frameworks, peer-reviewed educational materials).
   - Strictly avoid unreliable, spam, unverified personal blogs.

2. SOURCE GROUNDING
   - Every question must be directly traceable to the specific reference content provided or cited.
   - For syllabus-based generation, cite the exact source chunk IDs (`sourceChunkIds: [...]`).
   - For web/curriculum generation, provide valid, reputable educational references in `webSources`.

3. QUESTION STRUCTURE & SCHEMA VALIDATION
   - Every generated item must strictly follow the target schema, question type, option structure, and answer format defined in the format template.
   - All required fields (`questionType`, `difficulty`, `contentArea`, `grade`, `text`, `options`, `answer`, `explanation`) must be present and well-formed.
   - MULTIPLE_SELECT Stem-Answer Agreement: The count requested in the question stem (e.g. "Which TWO...", "Select THREE...") must EXACTLY match the number of correct options in the `answer` field (2 for TWO, 3 for THREE). Never ask for TWO when 3 options are correct.

4. CONTENT RELEVANCE
   - The question must be directly and specifically relevant to the requested Content Area, Grade level, and topic.
   - Zero off-topic drift: do not introduce tangential, unrelated background information.

5. ANSWER VALIDATION
   - The correct answer must be explicitly and unambiguously supported by the source content.
   - Never rely on unsupported assumptions or outside facts not directly verifiable from the text.

6. DISTRACTOR VALIDATION
   - Incorrect options must be plausibly flawed, based on real student misconceptions or inverted logic, and definitively INCORRECT.
   - A distractor must NEVER accidentally be true, partially true, or justifiable as an alternative answer. Accidental correct options ruin question validity.
   - Distractors must be structurally parallel: same grammatical form and similar length as the correct choice.

7. QUESTION QUALITY & ANTI-HALLUCINATION
   - Stems, answers, options, and explanations must be factually correct and verifiable.
   - Strictly forbid hallucinated facts, fabricated events, invented statistics, or fake scientific claims.

8. DIFFICULTY CONTROL
   - Easy: Single-step direct recall of an explicitly stated fact; straightforward vocabulary.
   - Medium: Inference, relationship identification, or cause-and-effect connecting two concepts.
   - Hard: Multi-step synthesis, cross-concept evaluation, or deep critical analysis; all distractors must be sophisticated and plausible to unprepared students.

9. DUPLICATE DETECTION & DIVERSITY
   - Prevent duplicate or highly similar questions within the same batch.
   - Vary question stems and phrasing (avoid starting every item with "Which of the following...").
   - Distribute questions across different topics and learning objectives of the selected content.

10. COPYRIGHT PROTECTION & ORIGINALITY
    - Never copy questions, reading passages, or stems verbatim from existing test papers, textbooks, or copyrighted websites.
    - Generate 100% original question stems, realistic scenarios, and passages synthesized from educational concepts and factual knowledge.

11. EXPLANATION / RATIONALE BREAKDOWN (MANDATORY PER-ITEM BREAKDOWN)
    - Every question must provide a clear, comprehensive explanation justifying why the correct answer is right and why distractors are incorrect.
    - Single & Multi-Select: Include a distinct bullet (`• Option <Letter> (<Correct/Incorrect>): ...`) for EVERY option letter.
    - True/False: Provide explicit rationale for both True and False states.
    - Constructed Response & Dropdown: Provide a distinct rationale for EVERY blank (`• Blank <N>: ...`), detailing acceptable synonyms or why dropdown distractors are incorrect.
    - Matching Lines: Provide a distinct bullet for EVERY matched pair (`• Match <LeftKey>-<RightKey>: ...`), explaining the relationship.
    - Ordering: Provide a distinct bullet for EVERY step/item in sequence (`• Step <N>: ...`), justifying its placement.

12. FINAL QUALITY GATE
    - Output must be clean, valid, un-truncated JSON array syntax starting with `[` and ending with `]`.
    - No markdown formatting code blockss, and no conversational filler outside the JSON array.

13. VISUAL RELEVANCE & ACCURACY (When Visuals are Requested)
    - Diagrams and charts must be generated only when visual diagram is requested, directly illustrating the intended concept.
    - Scientific diagrams, geometric figures, and flowcharts must be mathematically and conceptually accurate.

14. IMAGE–QUESTION ALIGNMENT (When Visuals are Requested)
    - Strict visual dependency: the question cannot be answered without analyzing the visual diagram.
    - The visual must explicitly contain the measurements, labels (e.g. A, B, C, D), angles, points, or sequence stages referenced in the question stem.

15. VISUAL ANSWER VALIDATION (When Visuals are Requested)
    - The correct answer and every distractor must be verifiable directly from the visual content without ambiguous interpretation.

---

### PART 2: QUESTION MECHANICS & FORMATTING STANDARDS

1. STEM MECHANICS
   - One focused question or clear problem statement per item. Grade-appropriate reading level.
   - Never embed the answer or give away the solution in the stem. Avoid double negatives.
   - Strictly avoid "All of the above" or "None of the above".

2. BLANK MARKERS FOR CONSTRUCTED RESPONSE & DROPDOWN
   - Use EXACTLY three underscores (`___`) per blank — never `____` or `_____`.
   - The number of `___` blanks in the stem must EXACTLY match the number of answers.

3. MULTIPLE_SELECT CONSTRAINTS
   - Always provide exactly 5 options (`A`, `B`, `C`, `D`, `E`).
   - MUST have EXACTLY 2 or 3 correct answers (e.g., "A|C" or "B|D|E"). Items with only 1 correct answer or 4 correct answers are invalid.
   - Stem-Answer Agreement: If the stem asks for TWO ("Which TWO...", "Select TWO..."), there must be exactly 2 correct answers. If it asks for THREE, there must be exactly 3.
   - List correct letters in alphabetical order separated by `|` (e.g., "A|C" or "B|D|E").

4. LANGUAGE, READING LEVEL & ACCURACY
   - Reading level and vocabulary must strictly match the specified grade.
   - Spell out abbreviations/acronyms on first use.
   - Match exact spellings, units, and proper nouns from the syllabus/educational text.

5. TABLES & DATA FORMATTING
   - When question stems include tables or charts, format them as standard GitHub-Flavored Markdown tables with pipe separators:
     | Header 1 | Header 2 |
     | :--- | :--- |
     | Value 1 | Value 2 |
   - Never output informal tables or plain dashes without markdown pipe separators.

6. MATHEMATICAL EXPRESSIONS & NOTATION
   - Write equations and single-letter variables cleanly in plain text (e.g., `3x + 2 = 38`) without wrapping every individual variable in raw LaTeX dollar signs (`$x$`).
   - Use standard Unicode mathematical symbols directly (`°`, `×`, `÷`, `²`, `³`, `√`, `π`, `≤`, `≥`, `±`) for clean legibility.
