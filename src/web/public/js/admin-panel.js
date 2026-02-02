/**
 * Admin Panel Frontend JavaScript
 * Handles all admin panel interactions
 */

// ==========================================
// State Management
// ==========================================
let membersData = [];
let eventsData = [];
let channelsData = [];
let wishlistedItemsData = [];
let pendingDistributions = new Map(); // itemId -> Set of userIds
let selectedRollUsers = new Set();

// ==========================================
// Utility Functions
// ==========================================

/**
 * Make an API call with the token
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  const url = `/api/admin-panel/${TOKEN}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url + (method === 'GET' ? `?_=${Date.now()}` : ''), options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Request failed');
  }

  return result;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

/**
 * Open modal
 */
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

/**
 * Close modal
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get event icon based on type
 */
function getEventIcon(eventType) {
  const icons = {
    siege: '🏰',
    riftstone: '💎',
    boonstone: '✨',
    wargames: '⚔️',
    warboss: '👹',
    guildevent: '🎮'
  };
  return icons[eventType] || '📅';
}

// ==========================================
// Tab Navigation
// ==========================================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show corresponding content
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Load data for the tab if needed
    loadTabData(tabId);
  });
});

async function loadTabData(tabId) {
  switch (tabId) {
    case 'parties':
      await loadEventsForParties();
      break;
    case 'events':
      await loadEvents();
      break;
    case 'items':
      await loadItemCategories();
      await loadChannels();
      await loadMembers();
      await loadWishlistedItems();
      break;
    case 'reminders':
      await loadReminderStats();
      break;
    case 'reset':
      await loadMembersForReset();
      break;
  }
}

// ==========================================
// Parties Tab
// ==========================================

document.getElementById('openStaticPartyEditor').addEventListener('click', async () => {
  try {
    const btn = document.getElementById('openStaticPartyEditor');
    btn.disabled = true;
    btn.textContent = 'Opening...';

    const result = await apiCall('/static-party-token');
    window.open(result.url, '_blank');

    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      Open Static Party Editor
    `;
  } catch (error) {
    showToast(error.message, 'error');
    document.getElementById('openStaticPartyEditor').disabled = false;
  }
});

async function loadEventsForParties() {
  const container = document.getElementById('eventPartiesList');
  container.innerHTML = '<div class="loading">Loading events...</div>';

  try {
    const result = await apiCall('/events');
    eventsData = result.events;

    // Filter to only show upcoming events that aren't closed
    const upcomingEvents = eventsData.filter(e => !e.closed && !e.isPast);

    if (upcomingEvents.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <p>No upcoming events to form parties for.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = upcomingEvents.map(event => `
      <div class="event-card">
        <div class="event-icon">${getEventIcon(event.eventType)}</div>
        <div class="event-info">
          <h4>${event.eventTypeName}${event.location ? ` - ${event.location}` : ''}</h4>
          <div class="event-time">${formatDate(event.eventTime)}</div>
          <div class="event-stats">
            ${event.rsvpAttendingCount} attending, ${event.rsvpMaybeCount} maybe
          </div>
        </div>
        <span class="event-status ${event.partiesFormed ? 'closed' : 'active'}">
          ${event.partiesFormed ? 'Parties Formed' : 'Ready'}
        </span>
        <div class="event-actions">
          <button class="btn btn-sm btn-primary" onclick="formEventParties('${event._id}')">
            Form Parties
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = `<div class="no-data">Failed to load events: ${error.message}</div>`;
  }
}

async function formEventParties(eventId) {
  try {
    const result = await apiCall(`/event-party-token/${eventId}`);
    showToast(`Parties processed! ${result.summary.partiesIntact} intact, ${result.summary.membersAvailable} available`, 'success');
    window.open(result.url, '_blank');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// Events Tab
// ==========================================

async function loadEvents() {
  const container = document.getElementById('eventsList');
  container.innerHTML = '<div class="loading">Loading events...</div>';

  try {
    const result = await apiCall('/events');
    eventsData = result.events;

    if (eventsData.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <p>No events found.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = eventsData.map(event => `
      <div class="event-card ${event.closed ? 'closed' : ''}">
        <div class="event-icon">${getEventIcon(event.eventType)}</div>
        <div class="event-info">
          <h4>${event.eventTypeName}${event.location ? ` - ${event.location}` : ''}</h4>
          <div class="event-time">${formatDate(event.eventTime)}</div>
          <div class="event-stats">
            ${event.attendeesCount} attended | +${event.bonusPoints} bonus points
          </div>
        </div>
        <span class="event-status ${event.closed ? 'closed' : event.isPast ? 'past' : 'active'}">
          ${event.closed ? 'Closed' : event.isPast ? 'Past' : 'Active'}
        </span>
        <div class="event-actions">
          <button class="btn btn-sm btn-secondary" onclick="viewEventCode('${event._id}')">
            View Code
          </button>
          ${!event.closed ? `
            <button class="btn btn-sm btn-danger" onclick="confirmCancelEvent('${event._id}', '${event.eventTypeName}')">
              Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    container.innerHTML = `<div class="no-data">Failed to load events: ${error.message}</div>`;
  }
}

async function viewEventCode(eventId) {
  try {
    const result = await apiCall(`/event-code/${eventId}`);

    const content = document.getElementById('eventCodeContent');
    content.innerHTML = `
      <div class="event-code-display">
        <div class="code">${result.code}</div>
        <div class="event-details">
          <strong>${result.eventType}</strong>
          ${result.location ? `<br>${result.location}` : ''}
          <br>${formatDate(result.eventTime)}
          <br>Bonus: +${result.bonusPoints} points
          ${result.closed ? '<br><span style="color: var(--danger-color);">Event Closed</span>' : ''}
        </div>
      </div>
    `;

    openModal('eventCodeModal');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function confirmCancelEvent(eventId, eventName) {
  document.getElementById('confirmModalTitle').textContent = 'Cancel Event';
  document.getElementById('confirmModalMessage').textContent =
    `Are you sure you want to cancel "${eventName}"? This action cannot be undone.`;

  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.onclick = async () => {
    closeModal('confirmModal');
    try {
      await apiCall('/cancel-event', 'POST', { eventId });
      showToast('Event cancelled successfully', 'success');
      await loadEvents();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  openModal('confirmModal');
}

// ==========================================
// Items Tab - Item Roll
// ==========================================

async function loadItemCategories() {
  try {
    const result = await apiCall('/item-categories');
    const select = document.getElementById('itemCategory');
    select.innerHTML = '<option value="">Select category...</option>' +
      result.categories.map(cat => `<option value="${cat.value}">${cat.label}</option>`).join('');
  } catch (error) {
    console.error('Failed to load item categories:', error);
  }
}

document.getElementById('itemCategory').addEventListener('change', async (e) => {
  const category = e.target.value;
  const subcategorySelect = document.getElementById('itemSubcategory');
  const itemSelect = document.getElementById('itemSelect');

  subcategorySelect.innerHTML = '<option value="">Select type...</option>';
  subcategorySelect.disabled = true;
  itemSelect.innerHTML = '<option value="">Select item...</option>';
  itemSelect.disabled = true;
  updateCreateRollButton();

  if (!category) return;

  try {
    const result = await apiCall(`/item-subcategories/${category}`);
    subcategorySelect.innerHTML = '<option value="">Select type...</option>' +
      result.subcategories.map(sub => `<option value="${sub.value}">${sub.label}</option>`).join('');
    subcategorySelect.disabled = false;
  } catch (error) {
    showToast('Failed to load subcategories', 'error');
  }
});

document.getElementById('itemSubcategory').addEventListener('change', async (e) => {
  const category = document.getElementById('itemCategory').value;
  const subcategory = e.target.value;
  const itemSelect = document.getElementById('itemSelect');

  itemSelect.innerHTML = '<option value="">Select item...</option>';
  itemSelect.disabled = true;
  updateCreateRollButton();

  if (!subcategory) return;

  try {
    const result = await apiCall(`/items/${category}/${subcategory}`);
    itemSelect.innerHTML = '<option value="">Select item...</option>' +
      result.items.map(item => `<option value="${item.value}">${item.label}</option>`).join('');
    itemSelect.disabled = false;
  } catch (error) {
    showToast('Failed to load items', 'error');
  }
});

document.getElementById('itemSelect').addEventListener('change', updateCreateRollButton);
document.getElementById('itemTrait').addEventListener('input', updateCreateRollButton);
document.getElementById('rollDuration').addEventListener('input', updateCreateRollButton);
document.getElementById('rollChannel').addEventListener('change', updateCreateRollButton);

function updateCreateRollButton() {
  const item = document.getElementById('itemSelect').value;
  const trait = document.getElementById('itemTrait').value.trim();
  const duration = document.getElementById('rollDuration').value;
  const channel = document.getElementById('rollChannel').value;

  document.getElementById('createItemRoll').disabled = !(item && trait && duration && channel);
}

async function loadChannels() {
  try {
    const result = await apiCall('/channels');
    channelsData = result.channels;
    const select = document.getElementById('rollChannel');
    select.innerHTML = '<option value="">Select channel...</option>' +
      channelsData.map(ch => `<option value="${ch.id}">#${ch.name}</option>`).join('');
  } catch (error) {
    console.error('Failed to load channels:', error);
  }
}

async function loadMembers() {
  try {
    const result = await apiCall('/members');
    membersData = result.members;
    renderRollUserList();
  } catch (error) {
    console.error('Failed to load members:', error);
  }
}

function renderRollUserList(filter = '') {
  const container = document.getElementById('rollUserList');
  const filtered = filter
    ? membersData.filter(m => m.displayName.toLowerCase().includes(filter.toLowerCase()))
    : membersData;

  container.innerHTML = filtered.map(member => `
    <label class="user-checkbox-item">
      <input type="checkbox" value="${member.userId}"
        ${selectedRollUsers.has(member.userId) ? 'checked' : ''}
        onchange="toggleRollUser('${member.userId}')">
      <img src="${member.avatarUrl || '/static/images/default-avatar.png'}" alt="">
      <span class="user-name">${member.displayName}</span>
    </label>
  `).join('');
}

function toggleRollUser(userId) {
  if (selectedRollUsers.has(userId)) {
    selectedRollUsers.delete(userId);
  } else {
    selectedRollUsers.add(userId);
  }
}

document.getElementById('userSearchRoll').addEventListener('input', (e) => {
  renderRollUserList(e.target.value);
});

document.getElementById('createItemRoll').addEventListener('click', async () => {
  const btn = document.getElementById('createItemRoll');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    const result = await apiCall('/create-item-roll', 'POST', {
      itemValue: document.getElementById('itemSelect').value,
      trait: document.getElementById('itemTrait').value.trim(),
      duration: document.getElementById('rollDuration').value,
      channelId: document.getElementById('rollChannel').value,
      eligibleUsers: Array.from(selectedRollUsers)
    });

    showToast('Item roll created successfully!', 'success');

    // Reset form
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemSubcategory').innerHTML = '<option value="">Select type...</option>';
    document.getElementById('itemSubcategory').disabled = true;
    document.getElementById('itemSelect').innerHTML = '<option value="">Select item...</option>';
    document.getElementById('itemSelect').disabled = true;
    document.getElementById('itemTrait').value = '';
    document.getElementById('rollDuration').value = '1';
    selectedRollUsers.clear();
    renderRollUserList();

  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v20"/>
      <path d="M2 12h20"/>
    </svg>
    Create Item Roll
  `;
  updateCreateRollButton();
});

// ==========================================
// Items Tab - Give Item
// ==========================================

async function loadWishlistedItems() {
  try {
    const result = await apiCall('/wishlisted-items');
    wishlistedItemsData = result.items;

    const select = document.getElementById('giveItemSelect');
    select.innerHTML = '<option value="">Select an item...</option>' +
      wishlistedItemsData.map(item =>
        `<option value="${item.id}">${item.name} (${item.users.length} wishlisted)</option>`
      ).join('');
  } catch (error) {
    console.error('Failed to load wishlisted items:', error);
  }
}

document.getElementById('giveItemSelect').addEventListener('change', (e) => {
  const itemId = e.target.value;
  const container = document.getElementById('giveItemUsers');

  if (!itemId) {
    container.style.display = 'none';
    return;
  }

  const item = wishlistedItemsData.find(i => i.id === itemId);
  if (!item) return;

  container.style.display = 'block';
  container.innerHTML = item.users.map(user => `
    <label class="user-checkbox-item">
      <input type="checkbox" value="${user.userId}" data-item="${itemId}"
        onchange="toggleGiveItemUser('${itemId}', '${user.userId}', this.checked)">
      <span class="user-name">${user.displayName}</span>
    </label>
  `).join('');

  updateGiveItemButton();
});

function toggleGiveItemUser(itemId, userId, checked) {
  if (!pendingDistributions.has(itemId)) {
    pendingDistributions.set(itemId, new Set());
  }

  if (checked) {
    pendingDistributions.get(itemId).add(userId);
  } else {
    pendingDistributions.get(itemId).delete(userId);
    if (pendingDistributions.get(itemId).size === 0) {
      pendingDistributions.delete(itemId);
    }
  }

  renderPendingDistributions();
  updateGiveItemButton();
}

function renderPendingDistributions() {
  const container = document.getElementById('giveItemPending');
  const list = document.getElementById('pendingList');

  if (pendingDistributions.size === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  let html = '';
  for (const [itemId, userIds] of pendingDistributions) {
    const item = wishlistedItemsData.find(i => i.id === itemId);
    if (!item) continue;

    const userNames = Array.from(userIds)
      .map(uid => item.users.find(u => u.userId === uid)?.displayName || 'Unknown')
      .join(', ');

    html += `
      <div class="pending-item">
        <span class="item-name">${item.name}</span>
        <span class="user-count">${userIds.size} user(s): ${userNames}</span>
        <button class="remove-btn" onclick="removePendingItem('${itemId}')">&times;</button>
      </div>
    `;
  }

  list.innerHTML = html;
}

function removePendingItem(itemId) {
  pendingDistributions.delete(itemId);

  // Uncheck the checkboxes
  document.querySelectorAll(`input[data-item="${itemId}"]`).forEach(cb => {
    cb.checked = false;
  });

  renderPendingDistributions();
  updateGiveItemButton();
}

function updateGiveItemButton() {
  const btn = document.getElementById('giveItemBtn');
  let totalUsers = 0;
  for (const userIds of pendingDistributions.values()) {
    totalUsers += userIds.size;
  }
  btn.disabled = totalUsers === 0;
}

document.getElementById('giveItemBtn').addEventListener('click', async () => {
  const btn = document.getElementById('giveItemBtn');
  btn.disabled = true;
  btn.textContent = 'Distributing...';

  try {
    const distributions = [];
    for (const [itemId, userIds] of pendingDistributions) {
      distributions.push({
        itemId,
        userIds: Array.from(userIds)
      });
    }

    const result = await apiCall('/give-item', 'POST', { distributions });
    showToast(result.message, 'success');

    // Reset
    pendingDistributions.clear();
    document.getElementById('giveItemSelect').value = '';
    document.getElementById('giveItemUsers').style.display = 'none';
    document.getElementById('giveItemPending').style.display = 'none';

    // Reload wishlisted items
    await loadWishlistedItems();

  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
    Give Item(s)
  `;
  updateGiveItemButton();
});

// ==========================================
// Reminders Tab
// ==========================================

async function loadReminderStats() {
  // Load members to get stats
  if (membersData.length === 0) {
    try {
      const result = await apiCall('/members');
      membersData = result.members;
    } catch (error) {
      console.error('Failed to load members:', error);
      return;
    }
  }

  const totalMembers = membersData.length;
  const withPartyInfo = membersData.filter(m => m.hasPartyInfo).length;
  const withWishlist = membersData.filter(m => m.hasWishlist).length;

  document.getElementById('partyReminderStats').innerHTML = `
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Total Members</span>
      <span class="reminder-stat-value">${totalMembers}</span>
    </div>
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Have Party Info</span>
      <span class="reminder-stat-value" style="color: var(--success-color)">${withPartyInfo}</span>
    </div>
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Missing Party Info</span>
      <span class="reminder-stat-value" style="color: var(--danger-color)">${totalMembers - withPartyInfo}</span>
    </div>
  `;

  document.getElementById('wishlistReminderStats').innerHTML = `
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Total Members</span>
      <span class="reminder-stat-value">${totalMembers}</span>
    </div>
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Have Wishlist</span>
      <span class="reminder-stat-value" style="color: var(--success-color)">${withWishlist}</span>
    </div>
    <div class="reminder-stat-row">
      <span class="reminder-stat-label">Missing Wishlist</span>
      <span class="reminder-stat-value" style="color: var(--danger-color)">${totalMembers - withWishlist}</span>
    </div>
  `;
}

document.getElementById('sendPartyReminders').addEventListener('click', async () => {
  const btn = document.getElementById('sendPartyReminders');
  btn.disabled = true;
  btn.textContent = 'Sending reminders...';

  try {
    const result = await apiCall('/remind-parties', 'POST');
    showToast(`${result.message}. ${result.failCount > 0 ? `${result.failCount} failed (DMs disabled)` : ''}`, 'success');
    await loadReminderStats();
  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
    </svg>
    Send Party Info Reminders
  `;
});

document.getElementById('sendWishlistReminders').addEventListener('click', async () => {
  const btn = document.getElementById('sendWishlistReminders');
  btn.disabled = true;
  btn.textContent = 'Sending reminders...';

  try {
    const result = await apiCall('/remind-wishlist', 'POST');
    showToast(`${result.message}. ${result.failCount > 0 ? `${result.failCount} failed (DMs disabled)` : ''}`, 'success');
    await loadReminderStats();
  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/>
    </svg>
    Send Wishlist Reminders
  `;
});

// ==========================================
// Reset Tab
// ==========================================

async function loadMembersForReset() {
  if (membersData.length === 0) {
    try {
      const result = await apiCall('/members');
      membersData = result.members;
    } catch (error) {
      console.error('Failed to load members:', error);
      return;
    }
  }

  // Party reset dropdown - only show members with party info
  const partySelect = document.getElementById('resetPartyUser');
  const membersWithParty = membersData.filter(m => m.hasPartyInfo);
  partySelect.innerHTML = '<option value="">Select a user...</option>' +
    membersWithParty.map(m => `<option value="${m.userId}">${m.displayName}</option>`).join('');

  // Wishlist reset dropdown - only show members with wishlist
  const wishlistSelect = document.getElementById('resetWishlistUser');
  const membersWithWishlist = membersData.filter(m => m.hasWishlist);
  wishlistSelect.innerHTML = '<option value="">Select a user...</option>' +
    membersWithWishlist.map(m => `<option value="${m.userId}">${m.displayName}</option>`).join('');
}

document.getElementById('resetPartyUser').addEventListener('change', (e) => {
  document.getElementById('resetPartyBtn').disabled = !e.target.value;
});

document.getElementById('resetWishlistUser').addEventListener('change', (e) => {
  document.getElementById('resetWishlistBtn').disabled = !e.target.value;
});

document.getElementById('resetPartyBtn').addEventListener('click', () => {
  const select = document.getElementById('resetPartyUser');
  const userId = select.value;
  const userName = select.options[select.selectedIndex].text;

  document.getElementById('confirmModalTitle').textContent = 'Reset Party Info';
  document.getElementById('confirmModalMessage').textContent =
    `Are you sure you want to reset party info for ${userName}? They will need to use /myinfo again.`;

  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.onclick = async () => {
    closeModal('confirmModal');

    const btn = document.getElementById('resetPartyBtn');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    try {
      const result = await apiCall('/reset-party', 'POST', { userId });
      showToast(result.message, 'success');

      // Refresh member data
      const membersResult = await apiCall('/members');
      membersData = membersResult.members;
      await loadMembersForReset();
    } catch (error) {
      showToast(error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
      Reset Party Info
    `;
  };

  openModal('confirmModal');
});

document.getElementById('resetWishlistBtn').addEventListener('click', () => {
  const select = document.getElementById('resetWishlistUser');
  const userId = select.value;
  const userName = select.options[select.selectedIndex].text;

  document.getElementById('confirmModalTitle').textContent = 'Reset Wishlist';
  document.getElementById('confirmModalMessage').textContent =
    `Are you sure you want to reset the wishlist for ${userName}? Their received items will be preserved.`;

  const confirmBtn = document.getElementById('confirmModalBtn');
  confirmBtn.onclick = async () => {
    closeModal('confirmModal');

    const btn = document.getElementById('resetWishlistBtn');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    try {
      const result = await apiCall('/reset-wishlist', 'POST', { userId });
      showToast(result.message, 'success');

      // Refresh member data
      const membersResult = await apiCall('/members');
      membersData = membersResult.members;
      await loadMembersForReset();
    } catch (error) {
      showToast(error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
      Reset Wishlist
    `;
  };

  openModal('confirmModal');
});

// ==========================================
// Initialization
// ==========================================

// Load initial data for the parties tab
document.addEventListener('DOMContentLoaded', () => {
  loadEventsForParties();
});
