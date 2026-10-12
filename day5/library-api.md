# Library API Design

A RESTful API for managing books within a library system.

## Endpoints

### 1. List All Books
* **Method:** `GET`
* **Path:** `/api/books`
* **Description:** Retrieve a list of all books available in the library.
* **Request Body:** None
* **Success Status Code:** `200 OK`

### 2. Get One Book
* **Method:** `GET`
* **Path:** `/api/books/{id}`
* **Description:** Retrieve details for a single book by its unique ID.
* **Request Body:** None
* **Success Status Code:** `200 OK`

### 3. List Books by Author
* **Method:** `GET`
* **Path:** `/api/books?author={author_name}`
* **Description:** Retrieve a filtered list of books written by a specific author using a query parameter.
* **Request Body:** None
* **Success Status Code:** `200 OK`

### 4. Create a Book
* **Method:** `POST`
* **Path:** `/api/books`
* **Description:** Add a new book to the library catalog.
* **Request Body:**
  ```json
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "publishedYear": 2018,
    "isbn": "978-0735211292"
  }