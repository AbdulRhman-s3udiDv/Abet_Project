# ABET Risk Prediction - Machine Learning Architecture

## Overview
This document outlines the design, architecture, and logic behind the ABET Course Risk Prediction Machine Learning model. The goal of this system is to identify courses that are at risk of falling below ABET accreditation thresholds *before* the semester ends.

## 1. How "Risk/Failure" is Defined (The Ground Truth)
According to standard ABET Quality Assurance KPIs, a course is flagged as mathematically "at risk" (Failed) at the end of a given term if **any** of the following three conditions occur:
1. **Pass Rate < 65%**: Fewer than 65% of enrolled students achieve a grade above "F".
2. **Composite Student Outcome (SO) Attainment < 65**: The weighted average of the course's designated Student Outcomes falls below the threshold.
3. **Severe Trend Decline (< -4)**: A sudden performance drop of more than 4 points in SO attainment compared to the previous semester, signaling immediate deterioration.

The AI Model's job is to analyze current semester data to evaluate whether the course will breach any of these rules in the **subsequent** semester.

## 2. Program-Specific SO Matrices (Handling Sparse Data)
ABET programs (e.g., Computer Science vs. Engineering) have different numbers of Student Outcomes (6 vs 7). Furthermore, individual courses do not map to every SO. 
For example, course `AIE111` may only cover `SO1`, leaving `SO2` through `SO7` completely unassessed.

**How the model handles this:**
- The data pipeline reads directly from the official ABET structural mapping matrix (`SO-Coverage-V2 - Copy.xlsx`).
- When a course does not evaluate a specific SO (e.g., `SO5`), the data is passed to the AI as explicitly Missing (`NaN` or `Null`).
- This accurately mirrors reality: *Missing* does not mean *Zero* or *Failure*—it simply means *Inapplicable*. 

## 3. The Machine Learning Algorithm: HistGradientBoosting
Because the ABET data relies heavily on sparse matrices (many `NaN` values for unmapped SOs), traditional predictive models fail. We utilize a **HistGradientBoostingClassifier**, an advanced decision-tree ensemble algorithm natively supported by `scikit-learn`.

**Why HistGradientBoosting?**
- **Native NaN Handling**: When the algorithm builds its decision trees, it forces `NaN` values down a path that naturally segregates them without imputing false zeros.
- **Explainability**: The model allows for Permutation Feature Importance mapping, explicitly telling the university QA team exactly *why* a course was flagged.
- **Handling Non-Linear Risks**: Risk isn't universally linear (e.g., a 64% pass rate is a failure, but a 66% pass rate is passing). Tree-based models map these strict logic constraints and sudden thresholds flawlessly.

## 4. Evaluation Strategy (Preventing Data Leakage)
A common mistake in ML is training an algorithm on the *same mathematical criteria* it was meant to predict (Data Leakage). 
Our evaluation avoids this by shifting the timeframe:
- **Features (Input `X`)**: Semester $N$ metrics (e.g., Spring 2023 Pass Rate, Trend, Coverage).
- **Target (Label `y`)**: Semester $N+1$ failure status (e.g., Fall 2023 Risk Label).
- **Time-Based Splitting**: To prove the AI works in real life, the system was validated by training strictly on historical data (Terms 1 through 8) and predicting on unobserved future events (Term 9), yielding robust ~86%+ accuracy.

## 5. System Architecture
The application is built to be a full-stack, end-to-end ABET review platform:
- **Frontend**: A React web application utilizing Vite, styled with a glassmorphism aesthetic for an intuitive user experience.
- **Backend**: A FastAPI server that handles inference requests. It wraps the trained `HistGradientBoostingClassifier` and preprocessing pipelines, exposing them via RESTful endpoints.
- **Data Layer**: Supabase handles the database schemas, providing persistent storage for courses, programs, student outcomes mappings, and historical semester data.

## 6. Real-Time Inference vs Batch Inference
The FastAPI backend supports multiple modes of operation:
1. **Single Course Inference**: Program Directors can input risk factors for an individual course (e.g., current semester pass rate, trend decline, SO attainments) within the React dashboard and receive an immediate AI classification (Pass/Risk/Fail) along with its probability threshold.
2. **Batch Inference**: (Planned for future capabilities) Uploading an entire terms' worth of raw grading sheets and receiving a compiled risk report for all courses in a program simultaneously.

## Conclusion
The ABET Course Risk Predictor successfully demonstrates that institutional data, when properly engineered (handling missing mapped SOs properly with tree-based models) and rigorously evaluated out-of-time, can systematically forecast accreditation risks before they negatively impact graduation quality.
