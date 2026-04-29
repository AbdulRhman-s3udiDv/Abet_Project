# ABET Accreditation Knowledge Base

## What is ABET?

ABET (Accreditation Board for Engineering and Technology) is a globally recognized organization that accredits college and university programs in applied and natural science, computing, engineering, and engineering technology. ABET accreditation ensures that programs meet quality standards set by the profession for which the program prepares graduates.

## ABET Accreditation Criteria for Computing Programs (CAC)

### Criterion 1: Students
The program must monitor student progress and enforce policies for accepting transfer students and awarding credits. It must have processes to evaluate, advise, and monitor students to determine success in achieving student outcomes.

### Criterion 2: Program Educational Objectives (PEOs)
PEOs describe what graduates are expected to attain within a few years after graduation. Programs must:
- Publish PEOs consistently with the institutional mission
- Have documented, systematic processes for reviewing PEOs periodically

### Criterion 3: Student Outcomes (SOs)
Student Outcomes describe what students are expected to know and be able to do by the time of graduation. The ABET CAC defines 6 Student Outcomes for Computer Science programs and up to 7 for Engineering programs.

#### Student Outcomes for Computing Programs:
- **SO1**: Analyze a complex computing problem and apply principles of computing and other relevant disciplines to identify solutions.
- **SO2**: Design, implement, and evaluate a computing-based solution to meet a given set of computing requirements in the context of the program's discipline.
- **SO3**: Communicate effectively in a variety of professional contexts.
- **SO4**: Recognize professional responsibilities and make informed judgments in computing practice based on legal and ethical principles.
- **SO5**: Function effectively as a member or leader of a team engaged in activities appropriate to the program's discipline.
- **SO6**: Apply computer science theory and software development fundamentals to produce computing-based solutions.

#### Additional Student Outcome for Engineering Programs:
- **SO7**: An ability to acquire and apply new knowledge as needed, using appropriate learning strategies.

### Criterion 4: Continuous Improvement
Programs must regularly use appropriate, documented processes for assessing and evaluating the extent to which the student outcomes are being attained. The results of these evaluations must be systematically utilized as input for the continuous improvement of the program.

### Criterion 5: Curriculum
The curriculum must include:
- At least 30 semester credit hours of mathematics and science
- At least 45 semester credit hours of CS topics
- A major design experience incorporating standards, constraints, and teamwork

### Criterion 6: Faculty
Faculty must be sufficient in number and competence. Programs must have processes for faculty professional development, evaluation, and workload management.

### Criterion 7: Facilities
Classrooms, offices, laboratories, and computing infrastructure must be adequate to support attainment of student outcomes and provide a healthy learning environment.

### Criterion 8: Institutional Support
Institutional support, financial resources, and constructive leadership must be adequate to assure the quality and continuity of the program.

---

## ABET Performance Indicators and Thresholds

### Attainment Thresholds
Programs typically define attainment thresholds for each Student Outcome:
- **Target**: The desired level of achievement, usually 70-80% of students meeting the benchmark.
- **Acceptable**: The minimum acceptable level, usually 60-70%.
- **At Risk**: Below the acceptable threshold, requiring immediate remediation. Typically below 60%.

### Key Performance Metrics
- **Average Score (avg_score)**: The mean grade for all students in a course section. A healthy range is 65-100.
- **Pass Rate (pass_rate)**: The percentage of students who pass the course (typically grade C or above). Healthy range: 70-100%.
- **SO Attainment (so1 through so7)**: The percentage of students meeting the benchmark for each Student Outcome. Measured through assignments, exams, projects, and rubrics.
- **Composite SO Index**: The weighted average of all active SO attainments for a course. This is the primary indicator of overall course health.
- **Trend Value**: The change in Composite SO Index compared to the previous academic term. A negative trend indicates degradation.

### Risk Classification Rules
A course is classified as **At Risk** when:
- The ML model predicts a risk probability above 50%
- OR the composite SO index is below 65%
- OR the pass rate is below 60%
- OR there is a consistent negative trend over 3+ consecutive terms

A course is classified as **Safe** when:
- The ML model predicts a risk probability below 50%
- AND the composite SO index is above 70%
- AND the pass rate is above 70%

---

## Platform Database Schema

### Table: programs
Stores the academic programs offered by the faculty.
| Column | Type | Description |
|--------|------|-------------|
| id | integer (auto) | Primary key |
| code | text | Program code (e.g., CS, AIE, AIS, CE) |
| name | text | Full program name |
| created_at | timestamp | Record creation time |

### Available Programs:
- **CS** — Computer Science
- **AIE** — Artificial Intelligence Engineering
- **AIS** — Artificial Intelligence Science
- **CE** — Computer Engineering

### Table: courses
Stores all courses monitored by the platform.
| Column | Type | Description |
|--------|------|-------------|
| id | integer (auto) | Primary key |
| course_code | text | Course identifier (e.g., CS301, AIE405) |
| course_name | text | Full course name |
| is_active | boolean | Whether the course is currently active |
| created_at | timestamp | Record creation time |

### Table: program_courses
Many-to-many relationship linking programs to courses.
| Column | Type | Description |
|--------|------|-------------|
| id | integer (auto) | Primary key |
| program_id | integer | Foreign key to programs table |
| course_id | integer | Foreign key to courses table |

### Table: course_so_mappings
Maps which Student Outcomes apply to each course.
| Column | Type | Description |
|--------|------|-------------|
| id | integer (auto) | Primary key |
| course_id | integer | Foreign key to courses table |
| so_index | integer | Student Outcome number (1-7) |
| so_weight | float | Weight of this SO for the course |

### Table: term_metrics
Stores per-term performance metrics for each course. This is the primary data source for risk prediction.
| Column | Type | Description |
|--------|------|-------------|
| id | integer (auto) | Primary key |
| course_id | integer | Foreign key to courses table |
| academic_term | text | Term identifier (e.g., 2024S = Spring 2024, 2023F = Fall 2023) |
| avg_score | float | Average student score (0-100) |
| pass_rate | float | Percentage of students passing (0-100) |
| so1_attainment | float (nullable) | SO1 attainment percentage |
| so2_attainment | float (nullable) | SO2 attainment percentage |
| so3_attainment | float (nullable) | SO3 attainment percentage |
| so4_attainment | float (nullable) | SO4 attainment percentage |
| so5_attainment | float (nullable) | SO5 attainment percentage |
| so6_attainment | float (nullable) | SO6 attainment percentage |
| so7_attainment | float (nullable) | SO7 attainment percentage |
| composite_so_index | float | Weighted average of all active SOs |
| trend_value | float | Change from previous term's composite SO |
| created_at | timestamp | Record creation time |

### Academic Term Format
- `2020F` = Fall 2020
- `2021S` = Spring 2021
- `2021F` = Fall 2021
- `2022S` = Spring 2022
- `2022F` = Fall 2022
- `2023S` = Spring 2023
- `2023F` = Fall 2023
- `2024S` = Spring 2024

---

## ML Prediction Model

The platform uses a **HistGradientBoostingClassifier** (scikit-learn) to predict whether a course will be at risk in the upcoming term.

### Model Input Features (11 features):
1. `avg_score` — Average student score
2. `pass_rate` — Pass rate percentage
3. `so1_attainment` through `so7_attainment` — Individual SO attainment values
4. `composite_so_index` — Weighted average of active SOs
5. `trend_value` — Change from previous term

### Model Output:
- **risk_probability** (0-100): The predicted probability that the course will fail ABET thresholds next term
- **is_at_risk** (boolean): True if risk_probability > 50%

### API Endpoint:
- **URL**: `POST http://localhost:8000/predict/manual`
- **Request Body**: JSON with all 11 features plus course_code, program_code, and academic_term
- **Response**: `{ course_code, academic_term, risk_probability, is_at_risk, model_version }`

---

## Continuous Improvement Process

The ABET continuous improvement cycle follows these steps:

1. **Collect Data**: Gather course metrics (grades, pass rates, SO attainments) each term.
2. **Analyze**: Use the ML model and trend analysis to identify at-risk courses.
3. **Plan**: Develop action plans for courses that fall below thresholds.
4. **Implement**: Execute improvements (curriculum changes, teaching methods, assessment redesign).
5. **Evaluate**: Measure the impact of changes in the following term.
6. **Document**: Maintain records of all assessment activities and improvements for ABET reviewers.

### Common Improvement Actions:
- Redesigning course assessments to better measure Student Outcomes
- Adding supplementary tutorials or lab sessions for struggling students
- Updating curriculum content to align with industry standards
- Providing faculty development workshops on pedagogy
- Implementing peer mentoring programs
- Adjusting grading rubrics to ensure fair and consistent evaluation

---

## Faculty of Computer Science & Engineering — AIU

The Smart ABET Platform serves the Faculty of Computer Science & Engineering at the Arab International University (AIU). The faculty offers four undergraduate programs: Computer Science (CS), Artificial Intelligence Engineering (AIE), Artificial Intelligence Science (AIS), and Computer Engineering (CE).

The platform monitors approximately 150 courses across all programs, tracking their performance metrics from Fall 2020 to the present. The database contains historical data spanning 8 academic terms, enabling trend analysis and predictive modeling for proactive accreditation management.
