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
    usersListEl.innerHTML = '';

    try {
        const response = await fetch('https://jsonplaceholder.typicode.com/users');
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allUsers = await response.json();
        statusEl.textContent = `Successfully loaded ${allUsers.length} users.`;
        renderUsers(allUsers);
    } catch (error) {
        statusEl.textContent = `Error: Failed to load users. Please try again later.`;
        console.error('Fetch error:', error);
    } finally {
        loadUsersBtn.disabled = false;
    }
}

function renderUsers(users) {
    usersListEl.innerHTML = '';

    if (users.length === 0) {
        statusEl.textContent = 'No users match your filter.';
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');

        const nameEl = document.createElement('strong');
        nameEl.textContent = user.name;

        const detailsEl = document.createElement('p');
        detailsEl.textContent = `Email: ${user.email} | City: ${user.address.city} | Company: ${user.company.name}`;

        li.appendChild(nameEl);
        li.appendChild(detailsEl);
        usersListEl.appendChild(li);
    });
}

function handleFilter() {
    const query = filterInput.value.toLowerCase().trim();
    
    const filtered = allUsers.filter(user => 
        user.name.toLowerCase().includes(query)
    );

    renderUsers(filtered);
}