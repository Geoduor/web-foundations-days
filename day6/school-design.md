# School Database Design

## Table Explanations & Relationships
* **`students`**: Stores personal details for each student registered in the school (ID, name, and a unique email).
* **`courses`**: Stores information on the subjects or classes offered by the institution (ID, title, and description).
* **`enrolments`**: A junction (join) table used to bridge the many-to-many relationship between `students` and `courses`. 

### Why a Join Table is Needed
A single student can register for multiple courses, and a single course can have many students enrolled. In a relational database, a direct many-to-many relationship cannot be modeled using single columns on either table without violating normalization rules. The `enrolments` join table resolves this by holding foreign keys (`student_id` and `course_id`) alongside relationship-specific attributes like the student's `grade`. A `UNIQUE (student_id, course_id)` constraint ensures a student cannot sign up for the exact same course more than once.

## Indexes
* **Index Name:** `idx_enrolments_student_id` on `enrolments(student_id)`
* **Reason:** This index dramatically speeds up lookup queries that filter or join enrolments based on a specific student (such as finding all courses taken by a given student), bypassing full table scans.

## Database Choice: SQL vs NoSQL
For a school management system tracking students, courses, and structured academic records (grades and enrolments), a **Relational Database (SQL)** is the optimal choice. Schools rely heavily on strict data integrity, foreign key constraints to prevent orphaned records, atomic transactions for grading or registration, and complex relational queries (`JOIN` operations across students and courses). NoSQL databases are better suited for unstructured, rapidly scaling documents or real-time logging, whereas a school database thrives on consistency and structured relationships.