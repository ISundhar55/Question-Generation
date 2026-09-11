# ASSESSMENT GENERATION GUARDRAILS & QUALITY STANDARDS
Apply all 15 core guardrails to every question generated in this batch:

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

4. CONTENT RELEVANCE & CURRICULUM BOUNDARY ADHERENCE
   - The question must be directly and specifically relevant to the requested Content Area, Grade level, and targeted learning objective.
   - STRICT BOUNDARY ADHERENCE: Confine questions strictly to the assessed standard. For example, if the topic is "States of Matter: Properties and Classification", do NOT introduce phase transition mechanisms (evaporation, boiling, condensation) unless explicitly requested.
   - STANDARD-TO-TASK ALIGNMENT: The question's cognitive task must assess the exact construct of the targeted standard. When generating for an ELA reading standard (e.g. `RI` / `RL` - word meaning in context, central idea, text evidence), the question MUST evaluate reading comprehension skills, NEVER general science or history factual recall, even if the passage discusses a science or history topic.
   - TEXT GENRE DISCIPLINE:
     * Standards coded `RI` (Reading Informational) strictly require authentic informational, expository, or scientific texts. Never use fictional stories (e.g. personal narratives or adventures) for informational text standards.
     * Standards coded `RL` (Reading Literature) strictly require literary fiction, poetry, or drama.

5. ANSWER VALIDATION & EVIDENCE GROUNDING
   - The correct answer must be explicitly and unambiguously supported by the source content.
   - Never rely on unsupported assumptions or outside facts not directly verifiable from the text.
   - VERBATIM TEXTUAL EVIDENCE RULE (CONTEXT CLUES): When asking students to identify context clues, evidence, or supporting phrases from the text, all correct choices MUST be verbatim words or phrases taken directly from the provided text. Never use a dictionary definition, synonym, or external paraphrase as a context-clue option.
   - CONTEXTUAL SUFFICIENCY: The stimulus must supply complete, self-contained context clues (restatements, contrasts, examples, or cause-effect) so that a student can determine the meaning solely from the text without relying on outside knowledge.

6. DISTRACTOR VALIDATION & ZERO ACCIDENTAL CORRECT OPTIONS
   - Incorrect options must be plausibly flawed, based on real student misconceptions or inverted logic, and definitively INCORRECT.
   - A distractor must NEVER accidentally be true, partially true, or justifiable as an alternative answer. Accidental correct options ruin question validity.
   - COMPARATIVE STATEMENTS (CRITICAL): When drafting comparative distractors (e.g., "A has fewer than B", "X is greater than Y", "P occurred before Q"), calculate the actual values first. Ensure the comparison is factually FALSE. If the true condition is "Ben has fewer tokens than Amy", then to make a distractor you MUST write "Ben has more tokens than Amy" or "Ben and Amy have equal tokens". Never write the true comparison as a distractor!
   - EXACT ANSWER COUNT AUDIT: In questions specifying a count (e.g., "Which TWO...", "Select TWO..."), count the true statements across all options. There must be EXACTLY the requested number of true options (and all other options must be false).
   - STRICT SYNONYM LEGITIMACY: Acceptable alternative answers in Constructed Response must strictly be true linguistic equivalents, standard abbreviations, or alternate grammatical forms (singular/plural). Never treat scientifically distinct terms or different physical processes (e.g. "boiling" vs. "evaporation") as interchangeable synonyms.
   - Distractors must be structurally parallel: same grammatical form and similar length as the correct choice.

7. QUESTION QUALITY, RIGOR & SCIENTIFIC PRECISION
   - Stems, answers, options, and explanations must be factually correct and verifiable.
   - SCIENTIFIC PHRASING RIGOR: Ensure physical and scientific descriptions match exact textbook behavior (e.g., liquids flow and maintain fixed volume; gases expand to fill all available space and are compressible). Avoid physically awkward phrasing (e.g. never describe a gas as being "poured into a container").
   - Strictly forbid hallucinated facts, fabricated events, invented statistics, or fake scientific claims.

8. DIFFICULTY CONTROL & COGNITIVE COMPLEXITY (WEBB'S DOK)
   - Easy (DOK 1 - Direct Recall): Single-step direct recall of an explicitly stated fact or definition; straightforward vocabulary.
   - Medium (DOK 2 - Concept Application): Requires applying a concept, rule, or scientific criteria to a scenario, comparing/contrasting characteristics, or classifying items based on explicit structural criteria.
     * APPLICATION OVER RECOGNITION: For Medium / DOK 2 items, NEVER generate questions where answers can be guessed through everyday conversational familiarity (e.g., asking students to identify that milk or water is a liquid). Instead, require students to evaluate *why* an example behaves the way it does using defining properties (e.g., fixed volume vs. variable shape, particle arrangement, compressibility).
   - Hard (DOK 3 - Strategic Thinking & Synthesis): Multi-step synthesis, cross-concept evaluation, or deep critical analysis; all distractors must be sophisticated and plausible to unprepared students.

9. DUPLICATE DETECTION & DIVERSITY
   - Prevent duplicate or highly similar questions within the same batch.
   - Vary question stems and phrasing (avoid starting every item with "Which of the following...").
   - Distribute questions across different topics and learning objectives of the selected content.

10. COPYRIGHT PROTECTION & ORIGINALITY
    - Never copy questions, reading passages, or stems verbatim from existing test papers, textbooks, or copyrighted websites.
    - Generate 100% original question stems, realistic scenarios, and passages synthesized from educational concepts and factual knowledge.

11. EXPLANATION & RATIONALE INTEGRITY (UNIVERSAL STANDARD ACROSS ALL SUBJECTS & FORMATS)
    - Every question must provide a clear, comprehensive explanation justifying why the correct answer is right and why distractors or alternatives are incorrect.
    - Structured Breakdown: Provide a distinct bullet for each answer item, option, blank, pair, step, row, or statement present in the question.
    - STRICT ZERO-DUPLICATION RULE: Every item key or bullet MUST appear EXACTLY ONCE in the explanation. Never repeat, reiterate, or emit duplicate rationale entries for the same item.
    - STRICT ANSWER-TO-RATIONALE TAG SYNCHRONIZATION:
      * The status tag `(Correct)` may ONLY appear on options/items that are explicitly included in the `answer` key (e.g., if `answer` is "A|C", ONLY Option A and Option C can be tagged `(Correct)`).
      * EVERY distractor (any option not in `answer`) MUST be tagged `(Incorrect)` and MUST explain why it is false.
      * NEVER label a distractor as `(Correct)` in the explanation. If you find yourself writing `(Correct)` for an option not in `answer`, STOP — that distractor is invalid because it is accidentally true. You must modify the distractor text so that it is factually false!
    - STRICT NO-SCRATCHPAD / ZERO INTERNAL MONOLOGUE RULE: The explanation is strictly student-facing educational content. Complete all problem-solving, factual verification, calculations, and option drafting BEFORE outputting JSON. NEVER output internal reasoning, recalculations, self-corrections, or conversational drafting thoughts (e.g., NEVER include phrases like "Wait, recalculating...", "Let me review...", "Let's fix...", "in my head", "Wait, this is incorrect...", "Let's adjust...", or "Let's change..."). Output only final, clean, authoritative educational rationales.

12. FINAL QUALITY GATE
    - Output must be clean, valid, un-truncated JSON array syntax starting with `[` and ending with `]`.
    - No markdown formatting code blocks, and no conversational filler outside the JSON array.

13. VISUAL RELEVANCE & ACCURACY (When Visuals are Requested)
    - Diagrams and charts must be generated only when visual diagram is requested, directly illustrating the intended concept.
    - Scientific diagrams, geometric figures, and flowcharts must be mathematically and conceptually accurate.

14. IMAGE–QUESTION ALIGNMENT (When Visuals are Requested)
    - Strict visual dependency: the question cannot be answered without analyzing the visual diagram.
    - The visual must explicitly contain the measurements, labels (e.g. A, B, C, D), angles, points, or sequence stages referenced in the question stem.

15. VISUAL ANSWER VALIDATION (When Visuals are Requested)
    - The correct answer and every distractor must be verifiable directly from the visual content without ambiguous interpretation.
