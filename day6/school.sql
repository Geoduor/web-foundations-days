-- Drop tables if they exist to ensure a clean slate on re-runs
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS courses;

-- 1. Create Tables
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
);

CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    -- Prevent the same student from enrolling in the same course twice
    UNIQUE (student_id, course_id)
);

-- Indexes for performance optimization on foreign keys
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- 2. Insert Sample Data
-- Add 3 students
INSERT INTO students (name, email) VALUES 
('Alice Smith', 'alice@example.com'),
('Bob Jones', 'bob@example.com'),
('Charlie Brown', 'charlie@example.com');

-- Add 3 courses
INSERT INTO courses (title, description) VALUES 
('Mathematics 101', 'Introduction to basic algebra and calculus.'),
('Database Design', 'Relational databases, SQL, and normalization.'),
('Web Development', 'HTML, CSS, and JavaScript fundamentals.');

-- Add 5 enrolments (linking students to courses with grades)
INSERT INTO enrolments (student_id, course_id, grade) VALUES 
(1, 1, 'A'),
(1, 2, 'B+'),
(2, 2, 'A-'),
(2, 3, 'B'),
(3, 1, 'C+');

-- 3. Required Queries

-- Query 1: All courses for one student (by name, e.g., 'Alice Smith')
SELECT c.title AS course_title, c.description, e.grade
FROM courses c
JOIN enrolments e ON c.id = e.course_id
JOIN students s ON e.student_id = s.id
WHERE s.name = 'Alice Smith';

-- Query 2: All students on one course (e.g., 'Database Design')
SELECT s.name AS student_name, s.email, e.grade
FROM students s
JOIN enrolments e ON s.id = e.student_id
JOIN courses c ON e.course_id = c.id
WHERE c.title = 'Database Design';

-- Query 3: The number of students per course
SELECT c.title AS course_title, COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON c.id = e.course_id
GROUP BY c.id, c.title;

-- Query 4: Students who have no enrolments
SELECT s.id, s.name, s.email
FROM students s
LEFT JOIN enrolments e ON s.id = e.student_id
WHERE e.id IS NULL;

-- Query 5: Update one enrolment's grade
UPDATE enrolments
SET grade = 'A+'
WHERE student_id = 1 AND course_id = 1;