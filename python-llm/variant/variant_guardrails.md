# REFERENCE-BASED VARIANT GUARDRAILS

Apply these universal standards to every assessment item generated from a seed reference question across all subjects (English Language Arts, Science, Social Studies, Mathematics).

1. Core Competency Alignment
* Identify the exact learning objective, curriculum standard, and cognitive skill assessed by the reference item.
* Every generated variant must test this identical competency unless a deliberate difficulty shift or format transformation is requested.

2. Novel Context & Isomorphic Phrasing (No Copying)
* NEVER simply duplicate or trivially reword the reference question.
* Transform all surface elements: introduce fresh real-world scenarios, different subject entities, new character names, and distinct illustrative contexts.
* Ensure domain details remain authentic, realistic, and factually accurate.

3. 100% Self-Contained Items
* Every generated question must be completely understandable, grounded, and solvable on its own.
* Embed all necessary premises, given facts, character names, and context directly into the question stem.
* NEVER make meta-references to the reference question (e.g. NEVER write "In the question above...", "Similar to the earlier problem...", "In the previous scenario...", or "Based on the reference item...").

4. Universal Transformation Directives (The 3 Difficulty Layers)

* **Similar (Same Level)**:
  - **Primary Goal**: Create a parallel question testing the exact same skill and standard at equal difficulty.
  - **What Stays the Same**: Core concept, grade level, curriculum standard, and difficulty level.
  - **What Changes**: Story, context, characters, and narrative setting. Completely fresh phrasing (zero copying).
  - **Reasoning Steps**: Identical number of computational or reasoning steps as the reference item.
  - **Answer Options & Logic**: Options maintain the same logical plausibility and misconception profiles as the original item.

* **Easier (Foundational)**:
  - **Primary Goal**: Support students struggling with the reference item by testing foundational or prerequisite concepts.
  - **What Stays the Same**: Target subject domain and the underlying foundational concept.
  - **What Changes**: Simplified context, lower reading burden, shorter sentences, and direct contextual clues or hints.
  - **Reasoning Steps**: Reduces multi-step complexity down to a single, direct deduction or core definition.
  - **Answer Options & Logic**: Distractors represent basic, clear conceptual misunderstandings rather than subtle or tricky traps.

* **Harder (Advanced)**:
  - **Primary Goal**: Challenge high-performing students by demanding deeper reasoning and advanced problem-solving.
  - **What Stays the Same**: Target curriculum standard and overarching subject domain.
  - **What Changes**: Richer, more complex scenarios, multiple variables, or scenarios requiring domain transfer.
  - **Reasoning Steps**: Multi-step problem solving, combining 2+ concepts, analyzing extra data, or working backwards. Minimal clues.
  - **Answer Options & Logic**: Distractors are highly sophisticated and specifically target common intermediate calculation errors and subtle misconceptions.

* **Different Format**: Translate the core competency into the requested target question type (e.g., Single Choice, Multi-Select, Dropdown, Ordering, Matching Lines, Gap Match, or Constructed Response) while strictly following that format's schema.

5. Misconception-Driven Distractors, Option Symmetry & Rationale
* Ensure there is exactly ONE definitively correct answer (or the exact required count for multiple-select) with strong defensibility.
* Every distractor must be definitively incorrect yet plausible, representing authentic student misconceptions, procedural errors, or partial understandings (no throwaways).
* Option Symmetry & Length Neutrality: Options must be parallel in structure and similar in length (the correct answer must NOT be noticeably longer, more detailed, or grammatically distinct).
* Low Linguistic Load: Vocabulary and sentence complexity must strictly match the grade level with minimal unnecessary reading burden.
* The explanation field must provide a clear rationale explaining the key reasoning and the specific misconception/error reflected by each distractor.

6. Equity, Safety & Bias Review
* Items must be accessible and fair for all students, free from cultural, regional, socioeconomic, or gender bias.
* Content must remain safe, respectful, and pedagogically sound.

7. Mandatory Teacher Directives & Structural Modifiers
* Any teacher-supplied additional instructions (such as "create a table based question", specific scenarios, constraints, or contextual themes) are mandatory top-priority directives.
* When a table or data presentation is requested, embed a clean Markdown table (`| Column 1 | Column 2 |\n|---|---|...`) in the question stem to represent the data, observations, or categories.
* Teacher directives take precedence over any default tendency to replicate the superficial structure of the seed item.
