# ASSESSMENT GENERATION GUARDRAILS
Apply these guardrails to every generated assessment item.

1. Source Quality & Grounding
* Use trusted, relevant, curriculum-aligned sources.
* Every item must be supported by the provided or approved source content.
* Do not use unreliable sources or introduce unsupported facts.
* Context-clue evidence options must use verbatim text from the stimulus, not outside definitions.

2. Content & Curriculum Alignment
* Align every item with the specified content area, grade, standard, learning objective, assessment target, and boundaries.
* Do not assess concepts or skills outside the defined scope.
* Ensure the question measures the intended skill, not an unrelated skill (e.g. test reading comprehension, not science recall, on ELA standards).

3. Question Structure & Schema
* Follow the required question type, format, schema, and response structure exactly.
* Include all required fields and ensure they are complete and consistent.
* Ensure answer requirements, including the number of correct responses, are satisfied.

4. Answer & Distractor Validation
* Ensure there is a clear, correct, and unambiguous answer.
* Every distractor must be definitively incorrect, while remaining plausible and relevant.
* Never include accidentally correct, partially correct distractors (fully validate all calculations, comparative statements, and relationships before finalizing).
* Acceptable alternative answers must be true grammatical/linguistic synonyms, never scientifically distinct terms (e.g. boiling vs. evaporation).
* Validate all options independently before finalizing the item.

5. Accuracy & Subject-Matter Precision
* Ensure all questions, answers, options, explanations, calculations, and visuals are factually and technically correct.
* Use accurate subject-specific terminology and grade-appropriate language.
* Do not fabricate facts, statistics, sources, events, or other information.

6. Difficulty & Cognitive Complexity
* Match the requested difficulty and cognitive level.
* Easy items should focus on recall or identification.
* Medium items should require application, comparison, classification, or interpretation (avoid everyday conversational recognition; require students to apply defining properties or rules).
* Hard items should require multi-step reasoning, analysis, evaluation, or synthesis.
* Do not create artificial difficulty through unnecessarily complex wording.

7. Diversity, Originality & Copyright Protection
* Avoid duplicate or highly similar items.
* Vary stems, scenarios, contexts, and reasoning approaches where appropriate.
* Never copy questions, reading passages, or stems verbatim from existing test papers, textbooks, or copyrighted websites.
* Generate 100% original question stems, realistic scenarios, and passages synthesized from educational concepts and factual knowledge.

8. Explanation Integrity
* Provide a clear and accurate explanation when required.
* Explain why the correct answer is correct and why alternatives are incorrect.
* Tag each option, blank, pair, step, or row breakdown explicitly with `(Correct)` or `(Incorrect)` exactly synchronized with the answer key.
* Keep each bullet strictly limited to 1–2 final, student-facing explanation sentences.
* Complete all math and verification before generating JSON; never include scratchpad calculations, final total tallies, or True/False audit lists in the explanation.

9. Visual Validation
* When visuals are requested, ensure they are relevant, accurate, and directly aligned with the question.
* All visuals must be 100% original, self-contained SVG diagrams; never copy, hotlink, or reproduce external or copyrighted images.
* All referenced labels, measurements, values, or relationships must be clearly represented.
* The answer and distractors must be verifiable from the question and visual without ambiguity.

10. Final Validation
* Perform a final consistency check across the question, options, answer, explanation, source, and visual when applicable.
* Ensure the output is complete, valid, and follows the required format.
* When JSON is required, return only valid, complete JSON with no additional text.
