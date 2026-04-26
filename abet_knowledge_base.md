# Smart ABET Platform — Knowledge Base
**Institution:** Al-Imam University (AIU) — Faculty of Computer Science & Engineering  
**System:** Smart ABET Accreditation Intelligence Platform  
**Version:** 1.0  

---

## CHUNK 1 — What Is This Platform?

The Smart ABET Platform is an AI-powered decision-support system built at Al-Imam University (AIU) to help the Faculty of Computer Science & Engineering manage ABET accreditation. The platform transforms raw academic data into intelligent predictions, insights, and reports.

The system has four main capabilities:
1. **Course Risk Prediction** — predicts whether a course will fail ABET thresholds in the next semester using a trained ML model.
2. **AI Assistant Chatbot** — an agentic RAG chatbot that answers questions about course performance, student outcomes, and ABET compliance using live data.
3. **Top Course Selection** — automatically ranks and recommends the best-performing courses to use as ABET evidence.
4. **Automated Report Generation** — generates formal ABET documentation narratives from raw data, reducing manual effort.

The technology stack is: React (frontend) + FastAPI (backend) + Supabase (PostgreSQL database) + HistGradientBoosting ML model + n8n (workflow automation and chatbot orchestration).

---

## CHUNK 2 — What Is ABET Accreditation?

ABET (Accreditation Board for Engineering and Technology) is an internationally recognized accreditation body that certifies that academic programs in engineering, technology, and computing meet quality standards.

For a program to maintain ABET accreditation, it must demonstrate that:
- Students consistently achieve defined learning outcomes (called Student Outcomes or SOs).
- Courses that map to those outcomes meet minimum performance thresholds.
- The program continuously monitors performance and takes corrective actions when needed.

If a course fails to meet ABET thresholds, the entire program's accreditation can be at risk. This is why early detection of weak courses is critical.

**ABET review cycle:** Programs are typically reviewed every 6 years. During review, accreditors examine historical assessment data, course reports, and evidence of continuous improvement.

---

## CHUNK 3 — ABET Risk Thresholds (The Three Rules)

A course is classified as **At Risk** (label = 1) if ANY of the following conditions are met in a given academic term:

| Rule | Condition | Meaning |
|------|-----------|---------|
| Rule 1 | Pass Rate < 65% | Fewer than 65% of enrolled students achieved a passing grade |
| Rule 2 | Composite SO Attainment < 65 | The weighted average of the course's Student Outcome scores fell below 65 out of 100 |
| Rule 3 | Severe Trend Decline < -4 | The SO index dropped more than 4 points compared to the previous semester, signaling sudden deterioration |

A course is classified as **Safe** (label = 0) when none of the above conditions are triggered.

The ML model's job is to predict whether the **next** semester will trigger any of these rules, based on the **current** semester's data.

---

## CHUNK 4 — Student Outcomes (SOs) Explained

Student Outcomes (SOs) are specific competencies that students must demonstrate by graduation. ABET requires each program to define and measure these outcomes.

**AIU CS/Engineering Student Outcomes:**

| SO | Name | Description |
|----|------|-------------|
| SO1 | Engineering Knowledge | Ability to apply knowledge of mathematics, science, and engineering fundamentals |
| SO2 | Problem Analysis | Ability to identify, formulate, and solve complex engineering problems |
| SO3 | Design/Development | Ability to design solutions that meet requirements while considering constraints |
| SO4 | Investigation | Ability to conduct investigations including data analysis and interpretation |
| SO5 | Modern Tool Usage | Ability to use appropriate tools, techniques, and IT resources |
| SO6 | Professional Ethics | Understanding of professional, legal, ethical responsibilities and societal impact |
| SO7 | Communication | Ability to communicate effectively in written and oral form |

**SO Attainment scoring:** Each SO is measured on a 0–100 scale. A score of 65 or above is considered acceptable by ABET standards at AIU.

**Composite SO Index formula:**
```
SO_index = (SO1 + SO2 + SO3 + ... + SOn) / n
```
Only the SOs that are actively mapped to a course are included in the average. Unmapped SOs are excluded (treated as Not Applicable, not as zero).

---

## CHUNK 5 — Programs Offered and Their Codes

The Faculty of Computer Science & Engineering at AIU runs the following ABET-accredited programs:

| Program Code | Full Name | SO Count |
|---|---|---|
| CS | Computer Science | 6 |
| AIE | Artificial Intelligence Engineering | 7 |
| AIS | Artificial Intelligence Science | 7 |
| CE | Computer Engineering | 7 |

Each program has a different SO mapping matrix. Not every course in a program maps to all SOs. A single course typically covers 2–4 SOs depending on its content.

Example: Course `AIE111` may only map to SO1 and SO3. When submitting data for this course, SO2, SO4, SO5, SO6, and SO7 are left blank (null), not zero.

---

## CHUNK 6 — Academic Term Format

Academic terms at AIU are encoded as a string combining the year and semester:

| Format | Example | Meaning |
|---|---|---|
| `YYYYF` | `2023F` | Fall semester of year 2023 |
| `YYYYS` | `2024S` | Spring semester of year 2024 |

**Semester sequence:** Fall → Spring → Fall → Spring (Fall comes first in the academic year).

To determine the next term from a given term:
- If the current term ends in `F` (Fall), the next term is `(year+1)S` — e.g., `2023F` → `2024S`
- If the current term ends in `S` (Spring), the next term is `(year)F` — e.g., `2024S` → `2024F`

---

## CHUNK 7 — The ML Risk Prediction Model

**Algorithm:** HistGradientBoostingClassifier (scikit-learn)

**Why this algorithm was chosen:**
- Natively handles `NaN` (null) values without imputation — critical because many SOs are not mapped to all courses.
- Handles non-linear decision boundaries (e.g., the sharp difference between 64% and 65% pass rate).
- Supports Permutation Feature Importance for explainability.

**Input features (what the model reads):**

| Feature | Description |
|---------|-------------|
| `avg_score` | Average student score in the course (0–100) |
| `pass_rate` | Percentage of students who passed (0–100) |
| `so1_attainment` | SO1 score for this course-term (null if not mapped) |
| `so2_attainment` | SO2 score (null if not mapped) |
| `so3_attainment` | SO3 score (null if not mapped) |
| `so4_attainment` | SO4 score (null if not mapped) |
| `so5_attainment` | SO5 score (null if not mapped) |
| `so6_attainment` | SO6 score (null if not mapped) |
| `so7_attainment` | SO7 score (null if not mapped) |
| `composite_so_index` | Average of all active SOs |
| `trend_value` | Current SO index minus previous term SO index |

**Output:**
- `risk_probability`: A value from 0 to 100 (percentage)
- `is_at_risk`: `true` if risk_probability > 50%
- `model_version`: The version tag of the loaded model

**Model accuracy:** Validated at ~86%+ accuracy using out-of-time evaluation (trained on terms 1–8, tested on term 9 unseen data).

---

## CHUNK 8 — Trend Calculation

The trend value measures whether a course is improving or declining over time.

**Formula:**
```
trend_value = SO_index(current term) - SO_index(previous term)
```

**Trend classification:**

| Condition | Classification |
|-----------|---------------|
| trend_value > +3 | Up (Improving) |
| -3 ≤ trend_value ≤ +3 | Stable |
| trend_value < -3 | Down (Declining) |
| trend_value < -4 | Severe Decline (automatic At-Risk trigger) |

**Example:**
- Current term SO index: 72.5
- Previous term SO index: 78.0
- Trend value: 72.5 - 78.0 = **-5.5** → Classified as **Severe Decline → At Risk**

---

## CHUNK 9 — Course Ranking System (ABET Evidence Selection)

For ABET submissions, the platform identifies the best-performing courses to use as strong evidence. Each course receives a composite evidence score:

```
CourseScore = 0.4 × SO_index + 0.2 × percentile_rank + 0.2 × trend_stability + 0.2 × evidence_completeness
```

| Metric | Description |
|--------|-------------|
| SO index | Overall outcome attainment score |
| Percentile rank | How the course compares to all other courses |
| Trend stability | Consistency of performance (low variance = better) |
| Evidence completeness | Whether all SOs have documented assessments |

Courses with a score above 85 are considered strong ABET evidence candidates.

---

## CHUNK 10 — Database Schema (Supabase Tables)

The platform uses the following Supabase (PostgreSQL) tables:

**`programs`** — Stores the ABET programs
- `id`, `code` (e.g., "CS"), `name` (full name)

**`courses`** — Stores all courses
- `id`, `course_code` (e.g., "CSE251"), `course_name`

**`program_courses`** — Maps courses to programs (many-to-many)
- `program_id`, `course_id`

**`term_metrics`** — Stores per-course, per-term performance data
- `id`, `course_id`, `academic_term`, `avg_score`, `pass_rate`
- `so1_attainment` through `so7_attainment`
- `composite_so_index`, `trend_value`
- `is_at_risk` (boolean — the ground truth label)

**`so_mappings`** — Defines which SOs are mapped to which course in which program
- `program_id`, `course_id`, `so_number` (1–7), `is_active` (boolean)

---

## CHUNK 11 — API Endpoints Reference

Base URL: `http://127.0.0.1:8001`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check — returns `{"status": "ok"}` |
| POST | `/predict/manual` | Submit course metrics manually and get a risk prediction |
| POST | `/predict/upload-excel` | Upload `.xlsx` file for batch prediction |
| GET | `/api/courses` | List all courses with their IDs |
| GET | `/api/courses/{id}/trend` | Get trend data for a specific course (for the dashboard chart) |
| GET | `/api/courses/{id}/terms` | Get all historical term metrics for a course |
| GET | `/api/programs` | List all ABET programs |
| GET | `/api/programs/{id}/courses` | List all courses under a specific program |

**Prediction request body example:**
```json
{
  "course_code": "CSE251",
  "program_code": "CS",
  "academic_term": "2024S",
  "avg_score": 72.5,
  "pass_rate": 68.0,
  "so1_attainment": 70.0,
  "so2_attainment": null,
  "so3_attainment": 65.5,
  "so4_attainment": null,
  "so5_attainment": null,
  "so6_attainment": null,
  "so7_attainment": null,
  "composite_so_index": 67.75,
  "trend_value": -2.5
}
```

---

## CHUNK 12 — How to Interpret a Prediction Result

When the model returns a prediction, here is how to interpret it:

| Risk Probability | Status | Action Required |
|---|---|---|
| 0% – 30% | Safe | No immediate action. Continue monitoring. |
| 30% – 50% | Low Risk | Monitor closely. Consider reviewing SO coverage. |
| 50% – 70% | At Risk | Investigate weak SOs. Alert course instructor. |
| 70% – 85% | High Risk | Implement corrective action plan before next term. |
| 85% – 100% | Critical Risk | Escalate to department chair. Immediate intervention. |

**Key questions to ask when a course is at risk:**
1. Which SO had the lowest attainment score?
2. Is the pass rate below 65%?
3. Has performance been declining for multiple terms (negative trend)?
4. Are the correct SOs mapped to this course?

---

## CHUNK 13 — Corrective Actions for At-Risk Courses

When a course is predicted as at risk, the following actions are recommended:

**For low pass rate (< 65%):**
- Review exam difficulty and alignment with learning objectives
- Introduce supplementary tutoring or lab sessions
- Analyze grade distribution to identify if issues are widespread or isolated
- Consider prerequisite enforcement (students may lack foundation knowledge)

**For low SO attainment (< 65):**
- Review if course assessments (exams, projects) actually test the mapped SO
- Increase weight of assessments linked to the weak SO
- Re-design rubrics to better capture SO achievement
- Benchmark against similar courses in peer institutions

**For declining trend:**
- Compare current instructor's approach with previous terms
- Analyze if a curriculum change was made that may have disrupted performance
- Survey students for feedback on difficulty and understanding
- Check if enrollment size changed significantly (large classes may reduce individual attention)

**For severe decline (trend < -4):**
- Immediate escalation to Department QA Committee
- Emergency course review meeting with course team
- Document root cause analysis in ABET continuous improvement log

---

## CHUNK 14 — Continuous Improvement Process (ABET CI Cycle)

ABET requires programs to follow a continuous improvement (CI) cycle. The platform supports this cycle:

1. **Measure** — Collect pass rates, SO attainment, and trend data each semester via the term_metrics table.
2. **Analyze** — The ML model flags courses predicted to fail next term.
3. **Intervene** — Faculty apply corrective actions (see Chunk 13).
4. **Verify** — The following semester's data is collected and compared.
5. **Document** — The AI report generation feature creates formal narratives of improvements for ABET self-study reports.

ABET evaluators look for evidence that this cycle is active, data-driven, and documented over at least two accreditation cycles (6+ years).

---

## CHUNK 15 — Frequently Asked Questions

**Q: What does "At Risk" mean exactly?**  
A: It means the ML model predicts there is more than a 50% probability that the course will fail one of the three ABET rules in the next semester (pass rate < 65%, composite SO < 65, or trend < -4).

**Q: Can a course be at risk even if its current pass rate is above 65%?**  
A: Yes. The model predicts **future** risk based on current trends, SO scores, and the rate of decline. A course with a 68% pass rate but a sharply declining trend may still be predicted at risk for the upcoming term.

**Q: What if a course has no historical data?**  
A: Without historical data, trend cannot be computed. For such courses, manually enter trend_value = 0.0 when using the manual predictor. The prediction will rely on current scores only.

**Q: How often should predictions be run?**  
A: Ideally at the end of each semester (after grades are finalized) to flag courses for the next term. This gives instructors and QA teams an entire semester to intervene.

**Q: What is the difference between CS and AIE programs' SOs?**  
A: CS programs typically use 6 SOs (SO1–SO6). AIE, AIS, and CE programs use 7 SOs (SO1–SO7). The extra SO7 covers communication skills, which is a stronger emphasis in engineering programs.

**Q: Why are some SO fields null in the prediction form?**  
A: Because not every course teaches and assesses every Student Outcome. A null value correctly tells the model "this SO is not applicable here" rather than treating it as a score of zero (which would unfairly penalize the course).

**Q: What is the n8n chatbot doing behind the scenes?**  
A: When you send a message, n8n receives it via webhook, retrieves relevant context from the Supabase vector store (embeddings of this knowledge base + live database queries), and sends it to the AI language model to generate a grounded, accurate response.

---

## CHUNK 16 — Glossary

| Term | Definition |
|------|-----------|
| ABET | Accreditation Board for Engineering and Technology |
| SO | Student Outcome — a competency students must demonstrate |
| SO Attainment | The percentage/score measuring how well students achieved a specific SO |
| Composite SO Index | Weighted average of all active SO attainments for a course in a term |
| Pass Rate | Percentage of enrolled students who received a passing grade |
| Trend Value | Difference between current and previous term's composite SO index |
| At Risk | ML prediction that a course will fail ABET thresholds in the next term |
| HistGradientBoosting | The ML algorithm used — handles missing data natively and performs well on tabular data |
| RAG | Retrieval-Augmented Generation — AI technique that retrieves real data before generating an answer |
| CI Cycle | Continuous Improvement cycle required by ABET for accreditation maintenance |
| QA | Quality Assurance — the university department overseeing ABET compliance |
| Term Metrics | A database record storing all performance data for one course in one academic term |
| Evidence Completeness | Whether all mapped SOs have associated documented assessments |
| Accreditation Cycle | The 6-year review period during which ABET evaluates a program |
| Data Leakage | An ML error where future data leaks into training, causing false accuracy — avoided here via out-of-time validation |
