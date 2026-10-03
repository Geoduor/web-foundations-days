let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// 1. searchNotes(word)
function searchNotes(word) {
  return notes.filter(note => 
    note.text.toLowerCase().includes(word.toLowerCase())
  );
}

// 2. longestNote()
function longestNote() {
  if (notes.length === 0) return null;
  return notes.reduce((longest, current) => 
    current.text.length > longest.text.length ? current : longest
  );
}

// 3. countByCategory()
function countByCategory() {
  const counts = {};
  for (let note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }
  return counts;
}

// 4. getSummary()
function getSummary() {
  const counts = countByCategory();
  const totalNotes = notes.length;
  const noteWord = totalNotes === 1 ? "note" : "notes";
  
  const categoryParts = Object.entries(counts).map(
    ([category, count]) => `${count} ${category}`
  );
  
  return `${totalNotes} ${noteWord}: ${categoryParts.join(", ")}.`;
}

// 5. isDuplicate(text)
function isDuplicate(text) {
  const cleanText = text.trim().toLowerCase();
  return notes.some(note => note.text.trim().toLowerCase() === cleanText);
}

// 6. addNote(text, category)
function addNote(text, category) {
  const validCategories = ["personal", "work", "study"];
  
  if (typeof text !== "string" || text.length < 1 || text.length > 200) {
    console.log("Rejected: Note text must be between 1 and 200 characters.");
    return false;
  }
  
  if (!validCategories.includes(category)) {
    console.log(`Rejected: Invalid category '${category}'. Must be personal, work, or study.`);
    return false;
  }
  
  if (isDuplicate(text)) {
    console.log("Rejected: Duplicate note already exists.");
    return false;
  }
  
  const newId = notes.length > 0 ? notes[notes.length - 1].id + 1 : 1;
  notes.push({ id: newId, text: text, category: category });
  console.log("Success: Note added.");
  return true;
}

// --- Tests & Console Logs ---

// Test searchNotes
console.log(searchNotes("study")); 
// Expected: [ { id: 2, ... }, { id: 4, ... } ]

console.log(searchNotes("javascript")); 
// Expected: [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]

console.log(searchNotes("nonexistent")); 
// Expected: []


// Test longestNote
console.log(longestNote()); 
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }


// Test countByCategory
console.log(countByCategory()); 
// Expected: { personal: 2, study: 2, work: 1 }


// Test getSummary
console.log(getSummary()); 
// Expected: "5 notes: personal 2, study 2, work 1." (or similar depending on category key order)


// Test isDuplicate
console.log(isDuplicate("call mum")); 
// Expected: true

console.log(isDuplicate("Clean the house")); 
// Expected: false


// Test addNote
console.log(addNote("Buy groceries", "personal")); 
// Expected: "Success: Note added." followed by true

console.log(addNote("Buy milk and bread", "personal")); 
// Expected: "Rejected: Duplicate note already exists." followed by false

console.log(addNote("", "work")); 
// Expected: "Rejected: Note text must be between 1 and 200 characters." followed by false

console.log(addNote("Valid text", "fitness")); 
// Expected: "Rejected: Invalid category 'fitness'. Must be personal, work, or study." followed by false