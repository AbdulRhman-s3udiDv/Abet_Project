-- ==============================================================================
-- Supabase PostgreSQL Schema for Smart ABET Intelligence Platform
-- ==============================================================================

-- 1. Programs Table
CREATE TABLE programs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL
);

-- 2. Courses Table
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2.5 Program Courses (Many-to-Many Junction)
-- Allows a single course (e.g CS305) to belong to multiple programs (e.g CS, CE)
CREATE TABLE program_courses (
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY(program_id, course_id)
);

-- 3. Course SO Mapping (Mirrors the Excel Matrix Structure)
-- Evaluates which Student Outcomes (1 to 7) are explicitly mapped for a specific course
CREATE TABLE course_so_mappings (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    so_index INTEGER NOT NULL CHECK (so_index BETWEEN 1 AND 7), -- SO1 to SO7
    so_weight FLOAT DEFAULT 1.0,
    UNIQUE(course_id, so_index)
);

-- 4. Term Metrics (Historical DB from 2020 onward)
CREATE TABLE term_metrics (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    academic_term VARCHAR(20) NOT NULL, -- e.g., '2020F', '2021S'
    avg_score FLOAT,
    pass_rate FLOAT,
    so1_attainment FLOAT,
    so2_attainment FLOAT,
    so3_attainment FLOAT,
    so4_attainment FLOAT,
    so5_attainment FLOAT,
    so6_attainment FLOAT,
    so7_attainment FLOAT,
    composite_so_index FLOAT,
    trend_value FLOAT,
    UNIQUE(course_id, academic_term)
);

-- 5. ML Risk Predictions
CREATE TABLE ml_predictions (
    id SERIAL PRIMARY KEY,
    term_metric_id INTEGER REFERENCES term_metrics(id) ON DELETE CASCADE,
    predicted_risk_probability FLOAT,
    is_at_risk BOOLEAN,
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    ml_model_version VARCHAR(50)
);

-- ==============================================================================
-- Default Master Data
-- ==============================================================================
INSERT INTO programs (code, name) VALUES 
('CS', 'Computer Science'),
('AIE', 'Artificial Intelligence Engineering'),
('AIS', 'Artificial Intelligence Science'),
('CE', 'Computer Engineering');
