/**
 * Admin Panel JavaScript
 * Handles all admin panel functionality
 */

// Global state
let membersData = [];
let wishlistsData = [];
let eventsData = [];
let itemsDatabase = {};
let channelsData = [];
let pendingConfirmAction = null;

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadAdminData();
  loadEvents();
  loadMembers();
  loadWishlists();
  loadItemsDatabase();
  loadChannels();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Update buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

// ==========================================
// API Functions
// ==========================================

async function apiCall(endpoint, options = {}) {
  const url = `/api/admin/${TOKEN}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// ==========================================
// Data Loading
// ==========================================

async function loadAdminData() {
  try {
    const data = await apiCall('/data');

    document.getElementById('stat-members').textContent = data.memberCount.toLocaleString();
    document.getElementById('stat-players').textContent = data.playerCount.toLocaleString();
    document.getElementById('stat-wishlists').textContent = data.wishlistCount.toLocaleString();
    document.getElementById('stat-parties').textContent = data.partyCount.toLocaleString();
    document.getElementById('stat-rolls').textContent = data.activeRollCount.toLocaleString();
  } catch (error) {
    console.error('Error loading admin data:', error);
    showToast('Failed to load statistics', 'error');
  }
}

async function loadEvents() {
  try {
    const data = await apiCall('/events');
    eventsData = data.events;
    renderEvents();
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-list').innerHTML =
      '<div class="no-data"><div class="no-data-icon">&#128197;</div><p>Failed to load events</p></div>';
  }
}

async function loadMembers() {
  try {
    const data = await apiCall('/members');
    membersData = data.members;
    renderMembers();
  } catch (error) {
    console.error('Error loading members:', error);
    document.getElementById('members-list').innerHTML =
      '<div class="no-data"><div class="no-data-icon">&#128101;</div><p>Failed to load members</p></div>';
  }
}

async function loadWishlists() {
  try {
    const data = await apiCall('/wishlists');
    wishlistsData = data.wishlists;
    renderWishlists();
  } catch (error) {
    console.error('Error loading wishlists:', error);
    document.getElementById('wishlists-list').innerHTML =
      '<div class="no-data"><div class="no-data-icon">&#127873;</div><p>Failed to load wishlists</p></div>';
  }
}

async function loadItemsDatabase() {
  try {
    const data = await apiCall('/items-database');
    itemsDatabase = data.items;
    populateItemRollCategories();
  } catch (error) {
    console.error('Error loading items database:', error);
  }
}

async function loadChannels() {
  try {
    const data = await apiCall('/channels');
    channelsData = data.channels;
    populateChannelsSelect();
  } catch (error) {
    console.error('Error loading channels:', error);
  }
}

function populateChannelsSelect() {
  const select = document.getElementById('roll-channel');
  select.innerHTML = '<option value="">-- Select Channel --</option>';

  for (const channel of channelsData) {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = channel.parentName ? `${channel.parentName} > #${channel.name}` : `#${channel.name}`;
    select.appendChild(option);
  }
}

// ==========================================
// Rendering Functions
// ==========================================

function renderEvents() {
  const container = document.getElementById('events-list');

  if (eventsData.length === 0) {
    container.innerHTML = '<div class="no-data"><div class="no-data-icon">&#128197;</div><p>No upcoming events</p></div>';
    return;
  }

  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone',
    boonstone: 'Boonstone',
    wargames: 'Wargames',
    warboss: 'War Boss',
    guildevent: 'Guild Event'
  };

  container.innerHTML = eventsData.map(event => {
    const eventTime = new Date(event.eventTime);
    const timeStr = eventTime.toLocaleString();
    const eventName = eventTypeNames[event.eventType] || event.eventType;

    return `
      <div class="event-card">
        <div class="event-card-header">
          <div class="event-info">
            <h3>${eventName}</h3>
            <div class="event-time">${timeStr}</div>
            ${event.location ? `<div class="event-location">${event.location}</div>` : ''}
          </div>
          <span class="event-status ${event.hasPartiesFormed ? 'formed' : 'pending'}">
            ${event.hasPartiesFormed ? 'Parties Formed' : 'Pending'}
          </span>
        </div>
        <div class="event-stats">
          <div class="event-stat">
            <span>Attending:</span>
            <span class="event-stat-value">${event.rsvpAttendingCount}</span>
          </div>
          <div class="event-stat">
            <span>Maybe:</span>
            <span class="event-stat-value">${event.rsvpMaybeCount}</span>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn btn-primary btn-sm" onclick="openEventPartyEditor('${event._id}')">
            ${event.hasPartiesFormed ? 'Edit Parties' : 'Form Parties'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderMembers() {
  const container = document.getElementById('members-list');
  const searchInput = document.getElementById('user-search');

  // Filter by search
  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const filteredMembers = membersData.filter(m =>
    m.displayName.toLowerCase().includes(searchTerm)
  );

  if (filteredMembers.length === 0) {
    container.innerHTML = '<div class="no-data"><div class="no-data-icon">&#128101;</div><p>No members found</p></div>';
    return;
  }

  container.innerHTML = filteredMembers.map(member => `
    <div class="member-card">
      <div class="member-info">
        <img src="${member.avatarUrl || '/static/default-avatar.png'}" alt="" class="member-avatar">
        <div class="member-details">
          <h4>${member.displayName}</h4>
          <div class="member-meta">
            ${member.weapon1 ? `<span>${member.weapon1}/${member.weapon2}</span>` : ''}
            ${member.cp ? `<span>${member.cp.toLocaleString()} CP</span>` : ''}
          </div>
        </div>
      </div>
      <div class="member-status">
        ${member.hasPartyInfo
          ? '<span class="status-badge has-info">Party Info</span>'
          : '<span class="status-badge no-info">No Info</span>'
        }
        ${member.hasWishlist
          ? '<span class="status-badge has-wishlist">Wishlist</span>'
          : ''
        }
      </div>
      <div class="member-actions">
        ${member.hasPartyInfo ? `
          <button class="btn btn-danger btn-sm" onclick="confirmResetPartyInfo('${member.id}', '${member.displayName}')">
            Reset Info
          </button>
        ` : ''}
        ${member.hasWishlist ? `
          <button class="btn btn-warning btn-sm" onclick="confirmResetWishlist('${member.id}', '${member.displayName}')">
            Reset Wishlist
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Add search listener
  if (searchInput && !searchInput.dataset.listenerAdded) {
    searchInput.addEventListener('input', renderMembers);
    searchInput.dataset.listenerAdded = 'true';
  }
}

function renderWishlists() {
  const container = document.getElementById('wishlists-list');
  const searchInput = document.getElementById('wishlist-search');

  // Filter by search
  const searchTerm = searchInput?.value?.toLowerCase() || '';
  const filteredWishlists = wishlistsData.filter(wl =>
    wl.displayName.toLowerCase().includes(searchTerm)
  );

  if (filteredWishlists.length === 0) {
    container.innerHTML = '<div class="no-data"><div class="no-data-icon">&#127873;</div><p>No wishlists found</p></div>';
    return;
  }

  container.innerHTML = filteredWishlists.map(wl => {
    const submittedDate = new Date(wl.submittedAt).toLocaleDateString();

    return `
      <div class="wishlist-card">
        <div class="wishlist-card-header">
          <img src="${wl.avatarUrl || '/static/default-avatar.png'}" alt="" class="wishlist-avatar">
          <div class="wishlist-user-info">
            <h4>${wl.displayName}</h4>
            <div class="submitted-date">Submitted: ${submittedDate}</div>
          </div>
        </div>
        <div class="wishlist-items">
          ${wl.items.map(item => `
            <div class="wishlist-item-badge ${item.given ? 'given' : ''}"
                 onclick="${item.given ? '' : `giveItem('${wl.userId}', '${item.id}', '${wl.displayName}')`}"
                 title="${item.id}">
              ${item.id.substring(0, 30)}${item.id.length > 30 ? '...' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Add search listener
  if (searchInput && !searchInput.dataset.listenerAdded) {
    searchInput.addEventListener('input', renderWishlists);
    searchInput.dataset.listenerAdded = 'true';
  }
}

// ==========================================
// Item Roll Functions
// ==========================================

function populateItemRollCategories() {
  const select = document.getElementById('roll-category');
  select.innerHTML = '<option value="">-- Select Category --</option>';

  for (const category of Object.keys(itemsDatabase)) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    select.appendChild(option);
  }
}

function onRollCategoryChange() {
  const category = document.getElementById('roll-category').value;
  const subcategoryGroup = document.getElementById('roll-subcategory-group');
  const subcategorySelect = document.getElementById('roll-subcategory');
  const itemGroup = document.getElementById('roll-item-group');
  const itemPreview = document.getElementById('roll-item-preview');

  itemGroup.style.display = 'none';
  itemPreview.style.display = 'none';

  if (!category) {
    subcategoryGroup.style.display = 'none';
    return;
  }

  const subcategories = itemsDatabase[category];
  subcategorySelect.innerHTML = '<option value="">-- Select Subcategory --</option>';

  for (const subcategory of Object.keys(subcategories)) {
    const option = document.createElement('option');
    option.value = subcategory;
    option.textContent = subcategory;
    subcategorySelect.appendChild(option);
  }

  subcategoryGroup.style.display = 'block';
}

function onRollSubcategoryChange() {
  const category = document.getElementById('roll-category').value;
  const subcategory = document.getElementById('roll-subcategory').value;
  const itemGroup = document.getElementById('roll-item-group');
  const itemSelect = document.getElementById('roll-item');
  const itemPreview = document.getElementById('roll-item-preview');

  itemPreview.style.display = 'none';

  if (!subcategory) {
    itemGroup.style.display = 'none';
    return;
  }

  const items = itemsDatabase[category][subcategory];
  itemSelect.innerHTML = '<option value="">-- Select Item --</option>';

  for (const item of items) {
    const option = document.createElement('option');
    option.value = JSON.stringify(item);
    option.textContent = item.name;
    itemSelect.appendChild(option);
  }

  itemGroup.style.display = 'block';
}

function onRollItemChange() {
  const itemValue = document.getElementById('roll-item').value;
  const itemPreview = document.getElementById('roll-item-preview');

  if (!itemValue) {
    itemPreview.style.display = 'none';
    return;
  }

  const item = JSON.parse(itemValue);
  document.getElementById('roll-item-image').src = item.imageUrl;
  document.getElementById('roll-item-name').textContent = item.name;
  itemPreview.style.display = 'flex';
}

async function createItemRoll() {
  const itemValue = document.getElementById('roll-item').value;
  const trait = document.getElementById('roll-trait').value;
  const duration = parseInt(document.getElementById('roll-duration').value);
  const channelId = document.getElementById('roll-channel').value;

  if (!itemValue) {
    showToast('Please select an item', 'error');
    return;
  }

  if (!duration || duration < 1) {
    showToast('Please enter a valid duration', 'error');
    return;
  }

  if (!channelId) {
    showToast('Please select a channel', 'error');
    return;
  }

  const item = JSON.parse(itemValue);
  const btn = document.getElementById('btn-create-roll');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    await apiCall('/create-item-roll', {
      method: 'POST',
      body: JSON.stringify({
        itemName: item.name,
        imageUrl: item.imageUrl,
        trait: trait || null,
        durationMinutes: duration,
        channelId
      })
    });

    showToast('Item roll created successfully!', 'success');

    // Reset form
    document.getElementById('roll-category').value = '';
    document.getElementById('roll-subcategory-group').style.display = 'none';
    document.getElementById('roll-item-group').style.display = 'none';
    document.getElementById('roll-item-preview').style.display = 'none';
    document.getElementById('roll-trait').value = '';
    document.getElementById('roll-duration').value = '60';

    loadAdminData(); // Refresh stats
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Item Roll';
  }
}

// ==========================================
// Party Editor Functions
// ==========================================

async function openEventPartyEditor(eventId) {
  try {
    showToast('Generating party editor link...', 'info');

    const result = await apiCall('/event-party-editor', {
      method: 'POST',
      body: JSON.stringify({ eventId })
    });

    window.open(result.url, '_blank');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function openStaticPartyEditor() {
  try {
    showToast('Generating static party editor link...', 'info');

    const result = await apiCall('/static-party-editor', {
      method: 'POST'
    });

    window.open(result.url, '_blank');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// User Management Functions
// ==========================================

function confirmResetPartyInfo(userId, displayName) {
  pendingConfirmAction = async () => {
    try {
      await apiCall('/reset-party-info', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });

      showToast(`Reset party info for ${displayName}`, 'success');
      loadMembers();
      loadAdminData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  document.getElementById('confirm-modal-title').textContent = 'Reset Party Info';
  document.getElementById('confirm-modal-message').textContent =
    `Are you sure you want to reset all party information for ${displayName}? This will remove their weapons, CP, and party assignments.`;
  document.getElementById('confirm-modal').classList.add('show');
}

function confirmResetWishlist(userId, displayName) {
  pendingConfirmAction = async () => {
    try {
      await apiCall('/reset-wishlist', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });

      showToast(`Reset wishlist for ${displayName}`, 'success');
      loadMembers();
      loadWishlists();
      loadAdminData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  document.getElementById('confirm-modal-title').textContent = 'Reset Wishlist';
  document.getElementById('confirm-modal-message').textContent =
    `Are you sure you want to reset the wishlist for ${displayName}? They will need to submit a new wishlist.`;
  document.getElementById('confirm-modal').classList.add('show');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('show');
  pendingConfirmAction = null;
}

function confirmAction() {
  if (pendingConfirmAction) {
    pendingConfirmAction();
  }
  closeConfirmModal();
}

// ==========================================
// Reminder Functions
// ==========================================

async function sendPartyInfoReminder() {
  const btn = document.getElementById('btn-remind-party');
  const resultDiv = document.getElementById('party-reminder-result');

  btn.disabled = true;
  btn.textContent = 'Sending...';
  resultDiv.classList.remove('show', 'success', 'error');

  try {
    const result = await apiCall('/remind-party-info', { method: 'POST' });

    resultDiv.innerHTML = `
      <strong>Reminders Sent!</strong><br>
      Sent: ${result.results.sent} | Failed: ${result.results.failed} | Skipped: ${result.results.skipped}
    `;
    resultDiv.classList.add('show', 'success');
    showToast('Party info reminders sent!', 'success');
  } catch (error) {
    resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
    resultDiv.classList.add('show', 'error');
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Party Info Reminders';
  }
}

async function sendWishlistReminder() {
  const btn = document.getElementById('btn-remind-wishlist');
  const resultDiv = document.getElementById('wishlist-reminder-result');

  btn.disabled = true;
  btn.textContent = 'Sending...';
  resultDiv.classList.remove('show', 'success', 'error');

  try {
    const result = await apiCall('/remind-wishlist', { method: 'POST' });

    resultDiv.innerHTML = `
      <strong>Reminders Sent!</strong><br>
      Sent: ${result.results.sent} | Failed: ${result.results.failed} | Skipped: ${result.results.skipped}
    `;
    resultDiv.classList.add('show', 'success');
    showToast('Wishlist reminders sent!', 'success');
  } catch (error) {
    resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
    resultDiv.classList.add('show', 'error');
    showToast(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Wishlist Reminders';
  }
}

// ==========================================
// Give Item Functions
// ==========================================

async function giveItem(userId, itemId, displayName) {
  pendingConfirmAction = async () => {
    try {
      await apiCall('/give-item', {
        method: 'POST',
        body: JSON.stringify({ userId, itemId })
      });

      showToast(`Marked item as given to ${displayName}`, 'success');
      loadWishlists();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  document.getElementById('confirm-modal-title').textContent = 'Give Item';
  document.getElementById('confirm-modal-message').textContent =
    `Mark "${itemId}" as given to ${displayName}?`;
  document.getElementById('confirm-modal').classList.add('show');
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
