// ---------- 1. Select the elements we need ----------
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const DRAFT_KEY = "note-draft";
const THEME_KEY = "note-theme";

// ---------- 2. Update the character and word counts ----------
function updateCounts() {
    const text = noteText.value;

    // Count characters
    const characters = text.length;

    // Count words
    const words =
        text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

    // Display the counts
    charCount.textContent = `${characters} / 200 characters`;
    wordCount.textContent = `${words} words`;

    // Remove old warning classes
    charCount.classList.remove("warning");
    charCount.classList.remove("over");

    // Add warning when over 180 characters
    if (characters > 180) {
        charCount.classList.add("warning");
    }

    // Add over when over 200 characters
    if (characters > 200) {
        charCount.classList.add("over");
    }
}

// ---------- 3. Listen for text input ----------
noteText.addEventListener("input", () => {
    updateCounts();

    // Save the draft automatically
    localStorage.setItem(DRAFT_KEY, noteText.value);
});

// ---------- 4. Clear the note ----------
function clearNote() {
    noteText.value = "";

    // Remove saved draft
    localStorage.removeItem(DRAFT_KEY);

    // Reset counters
    updateCounts();
}

// ---------- 5. Clear button ----------
clearBtn.addEventListener("click", (event) => {
    event.preventDefault();
    clearNote();
});

// ---------- 6. Escape key clears the note ----------
noteText.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        event.preventDefault();
        clearNote();
    }
});

// ---------- 7. Toggle the theme ----------
themeToggle.addEventListener("click", (event) => {
    event.preventDefault();

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        themeToggle.textContent = "Light mode";
        localStorage.setItem(THEME_KEY, "dark");
    } else {
        themeToggle.textContent = "Dark mode";
        localStorage.setItem(THEME_KEY, "light");
    }
});

// ---------- 8. Restore saved draft ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);

if (savedDraft !== null) {
    noteText.value = savedDraft;
}

// ---------- 9. Restore saved theme ----------
const savedTheme = localStorage.getItem(THEME_KEY);

if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
} else {
    themeToggle.textContent = "Dark mode";
}

// ---------- 10. Update the page when it first loads ----------
updateCounts();