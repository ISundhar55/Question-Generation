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

4. Universal Transformation Directives
* **Similar (Same Level)**: Maintain the exact same cognitive demand, skill depth, and difficulty level with a fresh scenario and new context.
* **Easier (Foundational)**: Scaffold the core concept by reducing cognitive load, providing direct context clues, using accessible vocabulary, or isolating single-step deductions.
* **Harder (Advanced)**: Elevate cognitive complexity (Webb's DOK / Bloom's Taxonomy) through deeper inference, multi-step analysis, synthesis of multiple conditions, or closer distractor discrimination.
* **Different Format**: Translate the core competency into the requested target question type (e.g., Single Choice, Multi-Select, Dropdown, Ordering, Matching Lines, Gap Match, or Constructed Response) while strictly following that format's schema.

5. Distractor Quality & Rationale Completeness
* Ensure there is exactly ONE definitively correct answer (or the exact required count for multiple-select).
* Every distractor must be unambiguously incorrect yet plausible, representing authentic student misconceptions or common reasoning errors.
* The explanation field must provide a clear, bulleted rationale for every option, blank, or matched pair.

6. Mandatory Teacher Directives & Structural Modifiers
* Any teacher-supplied additional instructions (such as "create a table based question", specific scenarios, constraints, or contextual themes) are mandatory top-priority directives.
* When a table or data presentation is requested, embed a clean Markdown table (`| Column 1 | Column 2 |\n|---|---|...`) in the question stem to represent the data, observations, or categories.
* Teacher directives take precedence over any default tendency to replicate the superficial structure of the seed item.
