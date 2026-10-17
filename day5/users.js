const USERS_URL = 'https://jsonplaceholder.typicode.com/users';

// Users loaded from the API are stored here, so filtering never needs a new request.
let allUsers = [];

const loadUsersBtn = document.getElementById('load-users');
const filterInput = document.getElementById('filter-input');
const statusEl = document.getElementById('status');
const usersListEl = document.getElementById('users-list');

loadUsersBtn.addEventListener('click', loadUsers);
filterInput.addEventListener('input', handleFilter);

async function loadUsers() {
    loadUsersBtn.disabled = true;
    statusEl.textContent = 'Loading users...';
    usersListEl.replaceChildren();

    try {
        const response = await fetch(USERS_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allUsers = await response.json();

        // Respect any text already typed in the filter box.
        renderUsers(getFilteredUsers());
        statusEl.textContent = `Loaded ${allUsers.length} users successfully.`;
    } catch (error) {
        allUsers = [];
        statusEl.textContent = 'Error: could not load users. Please try again.';
        console.error('Fetch error:', error);
    } finally {
        loadUsersBtn.disabled = false;
    }
}

function renderUsers(list) {
    usersListEl.replaceChildren();

    list.forEach((user) => {
        const li = document.createElement('li');

        const nameEl = document.createElement('strong');
        nameEl.textContent = user.name;

        const detailsEl = document.createElement('p');
        detailsEl.textContent =
            `Email: ${user.email} | City: ${user.address.city} | Company: ${user.company.name}`;

        li.appendChild(nameEl);
        li.appendChild(detailsEl);
        usersListEl.appendChild(li);
    });
}

function getFilteredUsers() {
    const query = filterInput.value.trim().toLowerCase();
    return allUsers.filter((user) => user.name.toLowerCase().includes(query));
}

function handleFilter() {
    // Nothing to filter until users have been loaded successfully.
    if (allUsers.length === 0) {
        return;
    }

    const filtered = getFilteredUsers();
    renderUsers(filtered);

    statusEl.textContent = filtered.length === 0
        ? 'No users match your filter.'
        : `Showing ${filtered.length} of ${allUsers.length} users.`;
}
