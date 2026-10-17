# Library API Design

A RESTful API for the `books` resource of a library. All requests and responses use JSON. The base path is `/api`.

## Endpoints

### 1. List all books
- **Method:** `GET`
- **Path:** `/api/books`
- **Description:** Return a list of all books in the library.
- **Request body:** None
- **Success status code:** `200 OK`

### 2. Get one book
- **Method:** `GET`
- **Path:** `/api/books/{id}`
- **Description:** Return the details of one book, found by its ID.
- **Request body:** None
- **Success status code:** `200 OK`

### 3. List books by an author
- **Method:** `GET`
- **Path:** `/api/books?author={author_name}`
- **Description:** Return only the books written by the given author, using the `author` query parameter (for example `/api/books?author=James%20Clear`).
- **Request body:** None
- **Success status code:** `200 OK` (an empty list `[]` if the author has no books)

### 4. Create a book
- **Method:** `POST`
- **Path:** `/api/books`
- **Description:** Add a new book to the library catalogue.
- **Request body:**

  ```json
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "publishedYear": 2018,
    "isbn": "978-0735211292"
  }
  ```

- **Success status code:** `201 Created` (the response includes the new book with its generated `id`)

### 5. Update a book
- **Method:** `PUT`
- **Path:** `/api/books/{id}`
- **Description:** Replace the details of an existing book with the data sent.
- **Request body:**

  ```json
  {
    "title": "Atomic Habits",
    "author": "James Clear",
    "publishedYear": 2018,
    "isbn": "978-0735211292"
  }
  ```

- **Success status code:** `200 OK`

### 6. Delete a book
- **Method:** `DELETE`
- **Path:** `/api/books/{id}`
- **Description:** Remove a book from the catalogue.
- **Request body:** None
- **Success status code:** `204 No Content`

## Error codes

### 400 Bad Request
- **Meaning:** The request is invalid, so the server cannot process it.
- **Example:** `POST /api/books` with a body that is missing the required `title` field, or `"publishedYear": "last year"` (not a number).
- **Example response:**

  ```json
  { "error": "Bad Request", "message": "The field 'title' is required." }
  ```

### 404 Not Found
- **Meaning:** The requested book does not exist.
- **Example:** `GET /api/books/9999` (or `PUT` / `DELETE` on the same path) when no book has the ID `9999`.
- **Example response:**

  ```json
  { "error": "Not Found", "message": "No book with id 9999 exists." }
  ```
