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
let wishlistSubmissionsData = [];
let givenItemsData = [];
let selectedRollUsers = new Set();
let templatesData = [];
let selectedEventType = null;

// ==========================================
// Utility Functions
// ==========================================

/**
 * Make an API call with the token
 */
async function apiCall(endpoint, method = 'GET', data = null) {
  const url = `/api/admin-panel${endpoint}`;
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
    case 'history':
      await loadPartyHistory();
      break;
    case 'events':
      await Promise.all([
        loadEvents(),
        loadChannelsForEvents(),
        loadDescriptionTemplates()
      ]);
      initEventCreationForm();
      break;
    case 'items':
      await loadItemCategories();
      await loadChannels();
      await loadMembers();
      await loadWishlistSubmissions();
      await loadGivenItems();
      break;
    case 'reminders':
      await loadReminderStats();
      break;
    case 'reset':
      await loadMembersForReset();
      break;
    case 'guildsupport':
      await loadGuildSupportTab();
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
  // Find and disable the button that was clicked
  const btn = document.querySelector(`button[onclick="formEventParties('${eventId}')"]`);
  const originalText = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Loading...';
  }

  try {
    const result = await apiCall(`/event-party-token/${eventId}`);
    showToast(`Parties processed! ${result.summary.partiesIntact} intact, ${result.summary.membersAvailable} available`, 'success');
    window.open(result.url, '_blank');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
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

    // Filter to only show active events (not closed and not past)
    const activeEvents = eventsData.filter(e => !e.closed);

    if (activeEvents.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📅</div>
          <p>No active events found.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = activeEvents.map(event => `
      <div class="event-card">
        <div class="event-icon">${getEventIcon(event.eventType)}</div>
        <div class="event-info">
          <h4>${event.eventTypeName}${event.location ? ` - ${event.location}` : ''}</h4>
          <div class="event-time">${formatDate(event.eventTime)}</div>
          <div class="event-stats">
            ${event.rsvpAttendingCount} attending, ${event.rsvpMaybeCount} maybe
          </div>
        </div>
        <span class="event-status active">Active</span>
        <div class="event-actions">
          <button class="btn btn-sm btn-secondary" onclick="viewEventCode('${event._id}')">
            View Code
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmCancelEvent('${event._id}', '${event.eventTypeName}')">
            Cancel
          </button>
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
// Event Creation
// ==========================================

/**
 * Initialize event creation form
 */
function initEventCreationForm() {
  // Set default date to today
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  document.getElementById('eventDate').value = dateStr;
  document.getElementById('eventDate').min = dateStr;

  // Set default time
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(Math.ceil(today.getMinutes() / 15) * 15).padStart(2, '0');
  document.getElementById('eventTime').value = `${hours}:${minutes === '60' ? '00' : minutes}`;

  // Event type selection
  document.querySelectorAll('.event-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove selection from all
      document.querySelectorAll('.event-type-btn').forEach(b => b.classList.remove('selected'));

      // Select this one
      btn.classList.add('selected');
      selectedEventType = btn.dataset.type;

      // Show/hide location field
      const needsLocation = btn.dataset.needsLocation === 'true';
      document.getElementById('locationGroup').style.display = needsLocation ? 'block' : 'none';

      // Clear location if not needed
      if (!needsLocation) {
        document.getElementById('eventLocation').value = '';
      }

      updateCreateEventButton();
    });
  });

  // Description character counter
  const descTextarea = document.getElementById('eventDescription');
  descTextarea.addEventListener('input', () => {
    document.getElementById('descCharCount').textContent = descTextarea.value.length;
    updateCreateEventButton();
  });

  // Form field listeners
  document.getElementById('eventDate').addEventListener('change', updateCreateEventButton);
  document.getElementById('eventTime').addEventListener('change', updateCreateEventButton);
  document.getElementById('eventLocation').addEventListener('input', updateCreateEventButton);
  document.getElementById('eventBonusPoints').addEventListener('input', updateCreateEventButton);
  document.getElementById('eventChannel').addEventListener('change', updateCreateEventButton);

  // Template dropdown toggle
  document.getElementById('templateDropdownBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('templateDropdown');
    dropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('templateDropdown');
    const btn = document.getElementById('templateDropdownBtn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

  // Create event button
  document.getElementById('createEventBtn').addEventListener('click', createEvent);

  // Save template button in modal
  document.getElementById('confirmSaveTemplate').addEventListener('click', confirmSaveTemplate);
}

/**
 * Load channels for event creation
 */
async function loadChannelsForEvents() {
  try {
    const result = await apiCall('/channels');
    channelsData = result.channels;
    const select = document.getElementById('eventChannel');
    select.innerHTML = '<option value="">Select channel...</option>' +
      channelsData.map(ch => `<option value="${ch.id}">#${ch.name}</option>`).join('');
  } catch (error) {
    console.error('Failed to load channels:', error);
  }
}

/**
 * Load description templates
 */
async function loadDescriptionTemplates() {
  try {
    const result = await apiCall('/description-templates');
    templatesData = result.templates || [];
    renderTemplateList();
  } catch (error) {
    console.error('Failed to load templates:', error);
    templatesData = [];
    renderTemplateList();
  }
}

/**
 * Render template list in dropdown
 */
function renderTemplateList() {
  const container = document.getElementById('templateList');

  if (templatesData.length === 0) {
    container.innerHTML = `
      <div class="template-empty">
        No templates saved yet.<br>
        Create your first template by writing a description and clicking "Save Current".
      </div>
    `;
    return;
  }

  container.innerHTML = templatesData.map(template => `
    <div class="template-item" onclick="useTemplate('${template.id}')">
      <div class="template-item-info">
        <div class="template-item-name">${escapeHtml(template.name)}</div>
        <div class="template-item-preview">${escapeHtml(template.content.substring(0, 50))}${template.content.length > 50 ? '...' : ''}</div>
      </div>
      <button type="button" class="template-item-delete" onclick="event.stopPropagation(); deleteTemplate('${template.id}')" title="Delete template">
        &times;
      </button>
    </div>
  `).join('');
}

/**
 * Use a template
 */
function useTemplate(templateId) {
  const template = templatesData.find(t => t.id === templateId);
  if (template) {
    document.getElementById('eventDescription').value = template.content;
    document.getElementById('descCharCount').textContent = template.content.length;
    closeTemplateDropdown();
    updateCreateEventButton();
    showToast('Template applied', 'success');
  }
}

/**
 * Close template dropdown
 */
function closeTemplateDropdown() {
  document.getElementById('templateDropdown').classList.remove('show');
}

/**
 * Save current description as template
 */
function saveCurrentAsTemplate() {
  const content = document.getElementById('eventDescription').value.trim();

  if (!content) {
    showToast('Please enter a description first', 'error');
    return;
  }

  // Show save template modal
  document.getElementById('templatePreview').textContent = content;
  document.getElementById('templateName').value = '';
  closeTemplateDropdown();
  openModal('saveTemplateModal');
}

/**
 * Confirm save template
 */
async function confirmSaveTemplate() {
  const name = document.getElementById('templateName').value.trim();
  const content = document.getElementById('eventDescription').value.trim();

  if (!name) {
    showToast('Please enter a template name', 'error');
    return;
  }

  const btn = document.getElementById('confirmSaveTemplate');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await apiCall('/description-templates', 'POST', { name, content });
    showToast('Template saved successfully', 'success');
    closeModal('saveTemplateModal');
    await loadDescriptionTemplates();
  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Save Template';
}

/**
 * Delete a template
 */
async function deleteTemplate(templateId) {
  if (!confirm('Are you sure you want to delete this template?')) {
    return;
  }

  try {
    await apiCall(`/description-templates/${templateId}`, 'DELETE');
    showToast('Template deleted', 'success');
    await loadDescriptionTemplates();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Update create event button state
 */
function updateCreateEventButton() {
  const eventType = selectedEventType;
  const eventDate = document.getElementById('eventDate').value;
  const eventTime = document.getElementById('eventTime').value;
  const description = document.getElementById('eventDescription').value.trim();
  const channel = document.getElementById('eventChannel').value;
  const location = document.getElementById('eventLocation').value.trim();

  // Check if location is required for this event type
  const needsLocation = ['riftstone', 'boonstone', 'warboss', 'guildevent'].includes(eventType);

  const isValid = eventType &&
    eventDate &&
    eventTime &&
    description &&
    channel &&
    (!needsLocation || location);

  document.getElementById('createEventBtn').disabled = !isValid;
}

/**
 * Create event
 */
async function createEvent() {
  const btn = document.getElementById('createEventBtn');
  btn.disabled = true;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
      <circle cx="12" cy="12" r="10"/>
    </svg>
    Creating Event...
  `;

  try {
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    const eventDateTime = new Date(`${eventDate}T${eventTime}`);

    const eventData = {
      eventType: selectedEventType,
      location: document.getElementById('eventLocation').value.trim() || null,
      eventTime: eventDateTime.toISOString(),
      bonusPoints: parseInt(document.getElementById('eventBonusPoints').value) || 10,
      imageUrl: document.getElementById('eventImageUrl').value.trim() || null,
      message: document.getElementById('eventDescription').value.trim(),
      channelId: document.getElementById('eventChannel').value
    };

    const result = await apiCall('/create-event', 'POST', eventData);

    // Show success modal with code
    document.getElementById('newEventCode').textContent = result.password;
    openModal('eventCreatedModal');

    // Reset form
    resetEventForm();

    // Reload events list
    await loadEvents();

  } catch (error) {
    showToast(error.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="12" y1="14" x2="12" y2="18"/>
      <line x1="10" y1="16" x2="14" y2="16"/>
    </svg>
    Create Event
  `;
  updateCreateEventButton();
}

/**
 * Reset event form
 */
function resetEventForm() {
  // Deselect event type
  document.querySelectorAll('.event-type-btn').forEach(b => b.classList.remove('selected'));
  selectedEventType = null;

  // Hide location
  document.getElementById('locationGroup').style.display = 'none';
  document.getElementById('eventLocation').value = '';

  // Reset date/time to defaults
  const today = new Date();
  document.getElementById('eventDate').value = today.toISOString().split('T')[0];
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(Math.ceil(today.getMinutes() / 15) * 15).padStart(2, '0');
  document.getElementById('eventTime').value = `${hours}:${minutes === '60' ? '00' : minutes}`;

  // Reset other fields
  document.getElementById('eventBonusPoints').value = '10';
  document.getElementById('eventImageUrl').value = '';
  document.getElementById('eventDescription').value = '';
  document.getElementById('descCharCount').textContent = '0';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
// Items Tab - Wishlist Submissions
// ==========================================

async function loadWishlistSubmissions() {
  const container = document.getElementById('wishlistSubmissions');
  container.innerHTML = '<div class="loading">Loading wishlists...</div>';

  try {
    const result = await apiCall('/wishlist-submissions');
    wishlistSubmissionsData = result.submissions;
    renderWishlistSubmissions();
  } catch (error) {
    console.error('Failed to load wishlist submissions:', error);
    container.innerHTML = '<div class="no-data">Failed to load wishlists</div>';
  }
}

async function loadGivenItems() {
  const container = document.getElementById('givenItemsSection');
  container.innerHTML = '<div class="loading">Loading given items...</div>';

  try {
    const result = await apiCall('/given-items');
    givenItemsData = result.givenItems;
    renderGivenItems();
  } catch (error) {
    console.error('Failed to load given items:', error);
    container.innerHTML = '<div class="no-data">Failed to load given items</div>';
  }
}

function renderWishlistSubmissions() {
  const container = document.getElementById('wishlistSubmissions');
  const userFilter = document.getElementById('wishlistSearchUser')?.value.toLowerCase() || '';
  const itemFilter = document.getElementById('wishlistSearchItem')?.value.toLowerCase() || '';

  // Filter submissions
  let filtered = wishlistSubmissionsData.filter(sub => {
    if (userFilter && !sub.displayName.toLowerCase().includes(userFilter)) return false;
    
    if (itemFilter) {
      const allItems = [
        ...sub.archbossWeapon,
        ...sub.archbossArmor,
        ...sub.t3Weapons,
        ...sub.t3Armors,
        ...sub.t3Accessories
      ];
      if (!allItems.some(item => item.name.toLowerCase().includes(itemFilter))) return false;
    }
    
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-data">No wishlists found</div>';
    return;
  }

  container.innerHTML = filtered.map(sub => {
    const allItems = [
      { category: 'Archboss Weapons', items: sub.archbossWeapon },
      { category: 'Archboss Armor', items: sub.archbossArmor },
      { category: 'T3 Weapons', items: sub.t3Weapons },
      { category: 'T3 Armors', items: sub.t3Armors },
      { category: 'T3 Accessories', items: sub.t3Accessories }
    ].filter(cat => cat.items.length > 0);

    const totalItems = allItems.reduce((sum, cat) => sum + cat.items.length, 0);
    const receivedItems = allItems.reduce((sum, cat) => 
      sum + cat.items.filter(item => item.received).length, 0
    );

    return `
      <div class="wishlist-user-card">
        <div class="wishlist-user-header" data-user-id="${escapeHtml(sub.userId)}">
          <div class="wishlist-user-info">
            <img src="${escapeHtml(sub.avatarUrl || '/static/images/default-avatar.png')}" alt="${escapeHtml(sub.displayName)}" class="user-avatar">
            <span class="user-name">${escapeHtml(sub.displayName)}</span>
          </div>
          <div class="wishlist-stats">
            <span class="wishlist-stat">${totalItems} items</span>
            ${receivedItems > 0 ? `<span class="wishlist-stat received">${receivedItems} received</span>` : ''}
            <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
        <div class="wishlist-user-items" id="wishlist-${escapeHtml(sub.userId)}" style="display: none;">
          ${allItems.map(cat => `
            <div class="wishlist-category">
              <h4 class="wishlist-category-title">${escapeHtml(cat.category)}</h4>
              <div class="wishlist-items-grid">
                ${cat.items.map(item => `
                  <div class="wishlist-item ${item.received ? 'received' : ''}">
                    <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="wishlist-item-image">
                    <div class="wishlist-item-info">
                      <span class="wishlist-item-name">${escapeHtml(item.name)}</span>
                      ${item.received ? '<span class="received-badge">✓ Received</span>' : ''}
                    </div>
                    ${!item.received ? `
                      <button class="btn btn-sm btn-success give-item-btn" 
                        data-item-id="${escapeHtml(item.id)}" 
                        data-user-id="${escapeHtml(sub.userId)}"
                        data-user-name="${escapeHtml(sub.displayName)}"
                        data-item-name="${escapeHtml(item.name)}">
                        Give
                      </button>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Add event delegation for wishlist headers
  container.querySelectorAll('.wishlist-user-header').forEach(header => {
    header.addEventListener('click', function() {
      const userId = this.getAttribute('data-user-id');
      toggleWishlistUser(userId);
    });
  });

  // Add event delegation for give item buttons
  container.querySelectorAll('.give-item-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const itemId = this.getAttribute('data-item-id');
      const userId = this.getAttribute('data-user-id');
      const userName = this.getAttribute('data-user-name');
      const itemName = this.getAttribute('data-item-name');
      giveItemToUser(itemId, userId, userName, itemName);
    });
  });
}

function toggleWishlistUser(userId) {
  const element = document.getElementById(`wishlist-${userId}`);
  const isVisible = element.style.display !== 'none';
  element.style.display = isVisible ? 'none' : 'block';
}

async function giveItemToUser(itemId, userId, userName, itemName) {
  if (!confirm(`Give "${itemName}" to ${userName}?`)) return;

  try {
    const result = await apiCall('/give-item', 'POST', {
      distributions: [{ itemId, userIds: [userId] }]
    });

    showToast(result.message, 'success');

    // Reload data
    await loadWishlistSubmissions();
    await loadGivenItems();

  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderGivenItems() {
  const container = document.getElementById('givenItemsSection');

  if (givenItemsData.length === 0) {
    container.innerHTML = '<div class="no-data">No items have been given out yet</div>';
    return;
  }

  container.innerHTML = `
    <div class="given-items-table">
      <div class="table-header">
        <div class="table-col">User</div>
        <div class="table-col">Item</div>
        <div class="table-col">Given By</div>
        <div class="table-col">Date</div>
      </div>
      ${givenItemsData.map(item => `
        <div class="table-row">
          <div class="table-col">
            <div class="user-cell">
              <img src="${escapeHtml(item.avatarUrl || '/static/images/default-avatar.png')}" alt="${escapeHtml(item.displayName)}" class="user-avatar-small">
              <span>${escapeHtml(item.displayName)}</span>
            </div>
          </div>
          <div class="table-col">
            <div class="item-cell">
              <img src="${escapeHtml(item.itemImageUrl)}" alt="${escapeHtml(item.itemName)}" class="item-icon-small">
              <span>${escapeHtml(item.itemName)}</span>
            </div>
          </div>
          <div class="table-col">
            <span>${escapeHtml(item.givenByName)}</span>
          </div>
          <div class="table-col">
            <span>${formatDate(item.givenAt)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Event listeners for filters
document.addEventListener('DOMContentLoaded', () => {
  const userSearch = document.getElementById('wishlistSearchUser');
  const itemSearch = document.getElementById('wishlistSearchItem');
  
  if (userSearch) {
    userSearch.addEventListener('input', () => {
      if (wishlistSubmissionsData.length > 0) {
        renderWishlistSubmissions();
      }
    });
  }
  
  if (itemSearch) {
    itemSearch.addEventListener('input', () => {
      if (wishlistSubmissionsData.length > 0) {
        renderWishlistSubmissions();
      }
    });
  }
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
// Party History Tab
// ==========================================

/**
 * Determine the dominant party status based on summary statistics
 */
function getDominantPartyStatus(summary) {
  const { partiesIntact, partiesModified, partiesDisbanded } = summary;
  
  // Find the maximum value
  const maxValue = Math.max(partiesIntact, partiesModified, partiesDisbanded);
  
  // Return the status with the highest count
  if (partiesIntact === maxValue) return 'intact';
  if (partiesModified === maxValue) return 'modified';
  return 'disbanded';
}

async function loadPartyHistory() {
  const container = document.getElementById('partyHistoryList');
  container.innerHTML = '<div class="loading">Loading party history...</div>';

  try {
    const result = await apiCall('/party-history');
    const historyData = result.history;

    if (historyData.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon">📜</div>
          <p>No party history available yet.</p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">
            Party history will appear here after events have parties formed.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = historyData.map(item => {
      const statusBadge = getDominantPartyStatus(item.summary);

      return `
        <div class="history-item" onclick="showPartyDetails('${item._id}')">
          <div class="history-event-icon">${getEventIcon(item.event.eventType)}</div>
          <div class="history-event-info">
            <h4>${item.event.eventTypeName}${item.event.location ? ` - ${item.event.location}` : ''}</h4>
            <div class="history-event-time">${formatDate(item.event.eventTime)}</div>
            <div class="history-stats">
              <span class="history-stat">
                <span class="history-stat-value">${item.summary.totalAttending}</span> attending
              </span>
              <span class="history-stat">
                <span class="history-stat-value">${item.summary.partiesIntact}</span> intact
              </span>
              <span class="history-stat">
                <span class="history-stat-value">${item.summary.partiesModified}</span> modified
              </span>
              <span class="history-stat">
                <span class="history-stat-value">${item.summary.partiesDisbanded}</span> disbanded
              </span>
            </div>
          </div>
          <span class="history-badge ${statusBadge}">
            ${statusBadge === 'intact' ? 'Mostly Intact' : statusBadge === 'modified' ? 'Modified' : 'Disbanded'}
          </span>
        </div>
      `;
    }).join('');

  } catch (error) {
    container.innerHTML = `<div class="no-data">Failed to load party history: ${error.message}</div>`;
  }
}

async function showPartyDetails(eventPartyId) {
  try {
    const result = await apiCall(`/party-details/${eventPartyId}`);
    const data = result.partyData;

    const modalTitle = document.getElementById('partyDetailsTitle');
    const modalContent = document.getElementById('partyDetailsContent');

    modalTitle.textContent = `${data.event.eventTypeName}${data.event.location ? ` - ${data.event.location}` : ''}`;

    // Build the summary section
    const summaryHTML = `
      <div class="party-details-header">
        <h3>Party Formation Summary</h3>
        <div class="history-event-time">${formatDate(data.event.eventTime)}</div>
        ${data.createdAt ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          Formed on ${formatDate(data.createdAt)} by ${data.createdByName || 'Admin'}
        </div>` : ''}
      </div>

      <div class="party-summary">
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.totalAttending}</div>
          <div class="summary-stat-label">Total Attending</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.partiesIntact}</div>
          <div class="summary-stat-label">Parties Intact</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.partiesModified}</div>
          <div class="summary-stat-label">Parties Modified</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.partiesDisbanded}</div>
          <div class="summary-stat-label">Parties Disbanded</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.membersRemoved}</div>
          <div class="summary-stat-label">Members Removed</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value">${data.summary.membersAvailable}</div>
          <div class="summary-stat-label">Members Available</div>
        </div>
      </div>
    `;

    // Build the parties list
    const partiesHTML = data.processedParties.map(party => {
      const statusClass = party.status === 'intact' ? 'intact' : party.status === 'modified' ? 'modified' : 'disbanded';
      const statusText = party.status.charAt(0).toUpperCase() + party.status.slice(1);
      
      return `
        <div class="party-item">
          <div class="party-header">
            <div class="party-title">
              Party ${party.partyNumber}
              <span class="history-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="party-composition">
              ${party.composition.tank > 0 ? `<span class="comp-badge tank">${party.composition.tank}T</span>` : ''}
              ${party.composition.healer > 0 ? `<span class="comp-badge healer">${party.composition.healer}H</span>` : ''}
              ${party.composition.dps > 0 ? `<span class="comp-badge dps">${party.composition.dps}D</span>` : ''}
            </div>
          </div>
          <div class="party-members">
            ${party.members.map(member => {
              const roleIcon = member.role === 'tank' ? 'T' : member.role === 'healer' ? 'H' : 'D';
              return `
                <div class="member-item">
                  <div class="member-role-icon ${member.role}">${roleIcon}</div>
                  <div class="member-info">
                    <div class="member-name ${member.isLeader ? 'leader' : ''}">${member.displayName}</div>
                    <div class="member-details">
                      ${member.weapon1}${member.weapon2 ? ` / ${member.weapon2}` : ''} • ${member.cp} CP
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Show available members if any
    let availableHTML = '';
    if (data.availableMembers && data.availableMembers.length > 0) {
      availableHTML = `
        <div class="party-item">
          <div class="party-header">
            <div class="party-title">Available Members (Not Assigned)</div>
          </div>
          <div class="party-members">
            ${data.availableMembers.map(member => {
              const roleIcon = member.role === 'tank' ? 'T' : member.role === 'healer' ? 'H' : 'D';
              return `
                <div class="member-item">
                  <div class="member-role-icon ${member.role}">${roleIcon}</div>
                  <div class="member-info">
                    <div class="member-name">${member.displayName}</div>
                    <div class="member-details">
                      ${member.weapon1}${member.weapon2 ? ` / ${member.weapon2}` : ''} • ${member.cp} CP
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    modalContent.innerHTML = summaryHTML + '<div class="party-list">' + partiesHTML + availableHTML + '</div>';
    openModal('partyDetailsModal');

  } catch (error) {
    showToast(`Failed to load party details: ${error.message}`, 'error');
  }
}

// ==========================================
// Navigation
// ==========================================

document.getElementById('backToProfile').addEventListener('click', async (e) => {
  e.preventDefault();
  const btn = e.target;
  btn.textContent = 'Loading...';
  btn.style.pointerEvents = 'none';

  try {
    const result = await apiCall('/profile-link');
    window.location.href = result.url;
  } catch (error) {
    showToast('Failed to navigate to profile', 'error');
    btn.textContent = 'Back to Profile';
    btn.style.pointerEvents = 'auto';
  }
});

// ==========================================
// Guild Support Tab
// ==========================================

let currentFormSchema = [];
let currentRequestId = null;

/**
 * Load all Guild Support tab data
 */
async function loadGuildSupportTab() {
  await Promise.all([
    loadGuildSupportConfig(),
    loadSupportRequests(),
    loadPriorityQueue()
  ]);
  setupGuildSupportHandlers();
}

/**
 * Load guild support configuration
 */
async function loadGuildSupportConfig() {
  try {
    const response = await fetch('/api/admin/guild-support/config');
    const { config } = await response.json();

    // Load info content
    document.getElementById('supportInfoEditor').value = config.infoContent || '';

    // Load form schema
    currentFormSchema = config.requestSchema || [];
    renderFormFields();

    // Load applications open/closed state
    const applicationsOpen = config.applicationsOpen !== false;
    updateApplicationsToggleUI(applicationsOpen);
  } catch (error) {
    console.error('Error loading guild support config:', error);
    showToast('Failed to load configuration', 'error');
  }
}

/**
 * Update the applications toggle button UI based on current state
 */
function updateApplicationsToggleUI(applicationsOpen) {
  const badge = document.getElementById('applicationsStatusBadge');
  const text = document.getElementById('applicationsStatusText');
  const btn = document.getElementById('toggleApplicationsBtn');
  const btnText = document.getElementById('toggleApplicationsBtnText');

  if (!badge || !text || !btn || !btnText) return;

  if (applicationsOpen) {
    badge.className = 'applications-status-badge applications-open';
    badge.textContent = 'OPEN';
    text.textContent = 'Members can submit new support requests.';
    btn.className = 'btn btn-danger';
    btnText.textContent = 'Close Applications';
    btn.dataset.current = 'open';
  } else {
    badge.className = 'applications-status-badge applications-closed';
    badge.textContent = 'CLOSED';
    text.textContent = 'New support request submissions are disabled.';
    btn.className = 'btn btn-success';
    btnText.textContent = 'Open Applications';
    btn.dataset.current = 'closed';
  }
}

/**
 * Toggle guild support applications open/closed
 */
async function toggleApplications() {
  const btn = document.getElementById('toggleApplicationsBtn');
  if (!btn) return;

  const currentlyOpen = btn.dataset.current === 'open';
  const newState = !currentlyOpen;

  btn.disabled = true;

  try {
    const response = await fetch('/api/admin/guild-support/toggle-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationsOpen: newState })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to toggle applications');
    }

    updateApplicationsToggleUI(data.applicationsOpen);
    showToast(data.message, 'success');
  } catch (error) {
    console.error('Error toggling applications:', error);
    showToast(error.message || 'Failed to toggle applications', 'error');
  } finally {
    btn.disabled = false;
  }
}

/**
 * Render form fields in the form builder
 */
function renderFormFields() {
  const container = document.getElementById('formFieldsList');
  
  if (currentFormSchema.length === 0) {
    container.innerHTML = '<p class="text-muted">No fields configured yet. Click "Add Field" to create your first field.</p>';
    return;
  }
  
  const fieldsHtml = currentFormSchema.map((field, index) => `
    <div class="form-field-item" data-index="${index}">
      <div class="form-field-content">
        <div class="form-field-header">
          <strong>${field.label}</strong>
          <span class="field-type-badge">${field.type}</span>
          ${field.required ? '<span class="required-badge">Required</span>' : ''}
        </div>
        <div class="form-field-name">Internal name: ${field.name}</div>
        ${field.options ? `<div class="form-field-options">Options: ${field.options.join(', ')}</div>` : ''}
      </div>
      <div class="form-field-actions">
        <button class="btn-icon" onclick="moveFieldUp(${index})" ${index === 0 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button class="btn-icon" onclick="moveFieldDown(${index})" ${index === currentFormSchema.length - 1 ? 'disabled' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <button class="btn-icon btn-danger" onclick="removeField(${index})">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = fieldsHtml;
}

/**
 * Move field up in order
 */
function moveFieldUp(index) {
  if (index === 0) return;
  const temp = currentFormSchema[index];
  currentFormSchema[index] = currentFormSchema[index - 1];
  currentFormSchema[index - 1] = temp;
  renderFormFields();
}

/**
 * Move field down in order
 */
function moveFieldDown(index) {
  if (index === currentFormSchema.length - 1) return;
  const temp = currentFormSchema[index];
  currentFormSchema[index] = currentFormSchema[index + 1];
  currentFormSchema[index + 1] = temp;
  renderFormFields();
}

/**
 * Remove field from schema
 */
function removeField(index) {
  currentFormSchema.splice(index, 1);
  renderFormFields();
}

/**
 * Load support requests
 */
async function loadSupportRequests(status = '') {
  try {
    const url = status ? `/api/admin/guild-support/requests?status=${status}` : '/api/admin/guild-support/requests';
    const response = await fetch(url);
    const { requests } = await response.json();
    
    const container = document.getElementById('requestsList');
    
    if (!requests || requests.length === 0) {
      container.innerHTML = '<p class="text-muted">No support requests found.</p>';
      return;
    }
    
    const requestsHtml = requests.map(request => {
      const targetAmount = request.approvedAmount || request.totalRequested || 0;
      const fulfilledAmount = request.amountFulfilled || 0;
      const progressPercent = targetAmount > 0 ? Math.min((fulfilledAmount / targetAmount) * 100, 100) : 0;
      const hasProgress = request.status === 'approved' && targetAmount > 0;
      
      return `
      <div class="support-request-item" data-id="${request._id}">
        <div class="request-item-header">
          <div>
            <strong>${request.username}</strong>
            <span class="request-status status-${request.status}">${request.status}</span>
          </div>
          <div class="request-date">${formatDate(request.createdAt)}</div>
        </div>
        <div class="request-item-preview">
          ${Object.entries(request.formData).slice(0, 2).map(([key, value]) => 
            `<span><strong>${key}:</strong> ${Array.isArray(value) ? value.join(', ') : value}</span>`
          ).join(' • ')}
        </div>
        ${hasProgress ? `
          <div class="admin-progress-container">
            <div class="admin-progress-header">
              <span class="progress-label">Fulfillment Progress</span>
              <span class="progress-amounts">
                <span class="fulfilled">${fulfilledAmount}</span> / ${targetAmount}
              </span>
            </div>
            <div class="admin-progress-bar">
              <div class="admin-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>
        ` : ''}
        <button class="btn btn-sm btn-secondary" onclick="viewRequestDetails('${request._id}')" style="margin-top: 8px;">View Details</button>
      </div>
    `}).join('');
    
    container.innerHTML = requestsHtml;
  } catch (error) {
    console.error('Error loading support requests:', error);
    showToast('Failed to load requests', 'error');
  }
}

/**
 * View request details in modal
 */
async function viewRequestDetails(requestId) {
  try {
    currentRequestId = requestId;
    const response = await fetch(`/api/admin/guild-support/request/${requestId}`);
    const { request } = await response.json();
    
    const modalContent = document.getElementById('requestDetailsContent');
    
    const formDataHtml = Object.entries(request.formData).map(([key, value]) => `
      <div class="detail-field">
        <strong>${key}:</strong> ${Array.isArray(value) ? value.join(', ') : value}
      </div>
    `).join('');
    
    const adminNotesHtml = request.adminNotes && request.adminNotes.length > 0 
      ? request.adminNotes.map(note => `
          <div class="admin-note">
            <div class="note-meta">By Admin • ${formatDate(note.addedAt)}</div>
            <div class="note-content">${note.note}</div>
          </div>
        `).join('')
      : '<p class="text-muted">No admin notes yet.</p>';
    
    const targetAmount = request.approvedAmount || request.totalRequested || 0;
    const fulfilledAmount = request.amountFulfilled || 0;
    const progressPercent = targetAmount > 0 ? Math.min((fulfilledAmount / targetAmount) * 100, 100) : 0;
    const hasProgress = request.status === 'approved' && targetAmount > 0;
    
    modalContent.innerHTML = `
      <div class="request-details">
        <div class="detail-section">
          <h3>Request Information</h3>
          <div class="detail-field"><strong>User:</strong> ${request.username}</div>
          <div class="detail-field"><strong>Status:</strong> <span class="request-status status-${request.status}">${request.status}</span></div>
          <div class="detail-field"><strong>Submitted:</strong> ${formatDate(request.createdAt)}</div>
          ${request.totalRequested ? `<div class="detail-field"><strong>Total Requested:</strong> ${request.totalRequested}</div>` : ''}
          ${request.approvedAmount ? `<div class="detail-field"><strong>Approved Amount:</strong> ${request.approvedAmount}</div>` : ''}
          ${hasProgress ? `
            <div class="detail-field"><strong>Amount Fulfilled:</strong> ${fulfilledAmount}</div>
            <div style="margin-top: 12px;">
              <div class="admin-progress-bar">
                <div class="admin-progress-fill" style="width: ${progressPercent}%"></div>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; text-align: center;">
                ${progressPercent.toFixed(0)}% Complete
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="detail-section">
          <h3>Form Responses</h3>
          ${formDataHtml}
        </div>
        
        <div class="detail-section">
          <h3>Admin Notes</h3>
          ${adminNotesHtml}
        </div>
        
        <div class="detail-section">
          <h3>Actions</h3>
          <div class="request-actions">
            ${request.status === 'pending' ? `
              <div class="form-group">
                <label for="approvedAmount">Approved Amount</label>
                <input type="number" id="approvedAmount" class="form-control" placeholder="Enter amount" value="${request.totalRequested || ''}" min="0" step="0.01">
              </div>
              <button class="btn btn-success" onclick="approveRequest('${request._id}')">Approve</button>
              <button class="btn btn-danger" onclick="denyRequest('${request._id}')">Deny</button>
            ` : ''}
            ${request.status === 'approved' ? `
              <div class="partial-fulfill-container">
                <div class="form-group">
                  <label for="partialAmount">Add Partial Fulfillment</label>
                  <input type="number" id="partialAmount" class="form-control" placeholder="Amount to fulfill" step="0.01">
                </div>
                <button class="btn btn-primary" onclick="addPartialFulfillment('${request._id}')">Add Partial</button>
              </div>
              <button class="btn btn-success" onclick="fulfillRequest('${request._id}')" style="margin-top: 12px;">Mark as Fully Fulfilled</button>
            ` : ''}
            <div class="form-group" style="margin-top: 16px;">
              <label for="adminNote">Add Admin Note</label>
              <textarea id="adminNote" class="form-control" rows="3"></textarea>
            </div>
            <button class="btn btn-secondary" onclick="addAdminNote('${request._id}')">Add Note</button>
          </div>
        </div>
      </div>
    `;
    
    openModal('requestDetailsModal');
  } catch (error) {
    console.error('Error loading request details:', error);
    showToast('Failed to load request details', 'error');
  }
}

/**
 * Approve request
 */
async function approveRequest(requestId) {
  const approvedAmount = document.getElementById('approvedAmount')?.value;
  
  if (!approvedAmount) {
    showToast('Please enter an approved amount', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/guild-support/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', approvedAmount })
    });
    
    if (!response.ok) throw new Error('Failed to approve request');
    
    showToast('Request approved successfully', 'success');
    closeModal('requestDetailsModal');
    await loadSupportRequests();
    await loadPriorityQueue();
  } catch (error) {
    console.error('Error approving request:', error);
    showToast('Failed to approve request', 'error');
  }
}

/**
 * Deny request
 */
async function denyRequest(requestId) {
  try {
    const response = await fetch(`/api/admin/guild-support/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'denied' })
    });
    
    if (!response.ok) throw new Error('Failed to deny request');
    
    showToast('Request denied', 'success');
    closeModal('requestDetailsModal');
    await loadSupportRequests();
  } catch (error) {
    console.error('Error denying request:', error);
    showToast('Failed to deny request', 'error');
  }
}

/**
 * Fulfill request
 */
async function fulfillRequest(requestId) {
  try {
    const response = await fetch(`/api/admin/guild-support/queue/fulfill/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) throw new Error('Failed to fulfill request');
    
    showToast('Request marked as fulfilled', 'success');
    closeModal('requestDetailsModal');
    await loadSupportRequests();
    await loadPriorityQueue();
  } catch (error) {
    console.error('Error fulfilling request:', error);
    showToast('Failed to fulfill request', 'error');
  }
}

/**
 * Add partial fulfillment to a request
 */
async function addPartialFulfillment(requestId) {
  const partialAmount = document.getElementById('partialAmount').value;
  
  if (!partialAmount || partialAmount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/guild-support/request/${requestId}/fulfill-partial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(partialAmount) })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to add partial fulfillment');
    }
    
    showToast(result.message, 'success');
    
    // Refresh the view
    await viewRequestDetails(requestId);
    await loadSupportRequests();
    await loadPriorityQueue();
  } catch (error) {
    console.error('Error adding partial fulfillment:', error);
    showToast(error.message || 'Failed to add partial fulfillment', 'error');
  }
}

/**
 * Add admin note
 */
async function addAdminNote(requestId) {
  const note = document.getElementById('adminNote')?.value;
  
  if (!note || note.trim() === '') {
    showToast('Please enter a note', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/guild-support/request/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNote: note })
    });
    
    if (!response.ok) throw new Error('Failed to add note');
    
    showToast('Note added successfully', 'success');
    // Reload the request details
    await viewRequestDetails(requestId);
  } catch (error) {
    console.error('Error adding admin note:', error);
    showToast('Failed to add note', 'error');
  }
}

/**
 * Load priority queue
 * Note: Uses public queue endpoint since display format is the same for admin
 * Admin-specific actions (reorder, fulfill) use separate admin endpoints
 */
async function loadPriorityQueue() {
  try {
    const response = await fetch('/api/guild-support/queue');
    const { queue } = await response.json();
    
    const container = document.getElementById('priorityQueueList');
    
    if (!queue || queue.length === 0) {
      container.innerHTML = '<p class="text-muted">No requests in queue yet.</p>';
      return;
    }
    
    const queueHtml = queue.map(item => `
      <div class="queue-item" draggable="true" data-request-id="${item.requestId}">
        <div class="queue-handle">⋮⋮</div>
        <div class="queue-position">#${item.position}</div>
        <div class="queue-info">
          <strong>${item.username}</strong>
          <span class="queue-amount">${item.approvedAmount}</span>
        </div>
        <button class="btn btn-sm btn-success" onclick="fulfillRequest('${item.requestId}')">Fulfill</button>
      </div>
    `).join('');
    
    container.innerHTML = queueHtml;
    
    // Add drag-and-drop reordering functionality
    setupQueueDragAndDrop(container);
  } catch (error) {
    console.error('Error loading priority queue:', error);
    showToast('Failed to load queue', 'error');
  }
}

/**
 * Setup drag-and-drop for priority queue reordering
 */
function setupQueueDragAndDrop(container) {
  const items = container.querySelectorAll('.queue-item');
  let draggedItem = null;

  items.forEach(item => {
    item.addEventListener('dragstart', function(e) {
      draggedItem = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function(e) {
      this.classList.remove('dragging');
      items.forEach(i => i.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (this !== draggedItem) {
        // Get all items
        const allItems = [...container.querySelectorAll('.queue-item')];
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(this);
        
        // Add visual feedback
        items.forEach(i => i.classList.remove('drag-over'));
        this.classList.add('drag-over');
        
        // Insert before or after depending on direction
        if (draggedIndex < targetIndex) {
          this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
          this.parentNode.insertBefore(draggedItem, this);
        }
      }
    });

    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // After drop, save the new order
      saveQueueOrder();
    });
  });
}

/**
 * Save the new queue order after drag-and-drop
 */
async function saveQueueOrder() {
  try {
    const container = document.getElementById('priorityQueueList');
    const items = container.querySelectorAll('.queue-item');
    const order = Array.from(items).map(item => item.dataset.requestId);
    
    const response = await fetch('/api/admin/guild-support/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order })
    });
    
    if (!response.ok) throw new Error('Failed to reorder queue');
    
    // Update position numbers in UI
    items.forEach((item, index) => {
      const positionEl = item.querySelector('.queue-position');
      if (positionEl) {
        positionEl.textContent = `#${index + 1}`;
      }
    });
    
    showToast('Queue reordered successfully', 'success');
  } catch (error) {
    console.error('Error saving queue order:', error);
    showToast('Failed to save queue order', 'error');
    // Reload the queue to revert changes
    await loadPriorityQueue();
  }
}

/**
 * Setup Guild Support event handlers
 */
function setupGuildSupportHandlers() {
  // Save support info
  document.getElementById('saveSupportInfoBtn')?.addEventListener('click', async () => {
    const infoContent = document.getElementById('supportInfoEditor').value;
    
    try {
      const response = await fetch('/api/admin/guild-support/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ infoContent, requestSchema: currentFormSchema })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      showToast('Support information saved', 'success');
    } catch (error) {
      console.error('Error saving support info:', error);
      showToast('Failed to save information', 'error');
    }
  });
  
  // Save form schema
  document.getElementById('saveFormSchemaBtn')?.addEventListener('click', async () => {
    const infoContent = document.getElementById('supportInfoEditor').value;
    
    try {
      const response = await fetch('/api/admin/guild-support/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ infoContent, requestSchema: currentFormSchema })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      showToast('Form schema saved', 'success');
    } catch (error) {
      console.error('Error saving form schema:', error);
      showToast('Failed to save form schema', 'error');
    }
  });
  
  // Add form field
  document.getElementById('addFormFieldBtn')?.addEventListener('click', () => {
    openModal('addFieldModal');
  });
  
  // Field type change handler
  document.getElementById('fieldType')?.addEventListener('change', (e) => {
    const optionsGroup = document.getElementById('fieldOptionsGroup');
    const needsOptions = ['radio', 'select'].includes(e.target.value);
    optionsGroup.style.display = needsOptions ? 'block' : 'none';
  });
  
  // Confirm add field
  document.getElementById('confirmAddField')?.addEventListener('click', () => {
    const name = document.getElementById('fieldName').value;
    const label = document.getElementById('fieldLabel').value;
    const type = document.getElementById('fieldType').value;
    const required = document.getElementById('fieldRequired').checked;
    const optionsText = document.getElementById('fieldOptions').value;
    
    if (!name || !label) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    const field = {
      name,
      label,
      type,
      required
    };
    
    if (['radio', 'select'].includes(type) && optionsText) {
      field.options = optionsText.split('\n').filter(opt => opt.trim() !== '');
    }
    
    currentFormSchema.push(field);
    renderFormFields();
    closeModal('addFieldModal');
    
    // Clear form
    document.getElementById('fieldName').value = '';
    document.getElementById('fieldLabel').value = '';
    document.getElementById('fieldType').value = 'text';
    document.getElementById('fieldRequired').checked = false;
    document.getElementById('fieldOptions').value = '';
    document.getElementById('fieldOptionsGroup').style.display = 'none';
  });
  
  // Request status filter
  document.getElementById('requestStatusFilter')?.addEventListener('change', (e) => {
    loadSupportRequests(e.target.value);
  });
}

/**
 * Format date helper
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Make functions globally available
window.moveFieldUp = moveFieldUp;
window.moveFieldDown = moveFieldDown;
window.removeField = removeField;
window.viewRequestDetails = viewRequestDetails;
window.approveRequest = approveRequest;
window.denyRequest = denyRequest;
window.fulfillRequest = fulfillRequest;
window.addPartialFulfillment = addPartialFulfillment;
window.addAdminNote = addAdminNote;

// ==========================================
// Initialization
// ==========================================

// Load initial data for the parties tab
document.addEventListener('DOMContentLoaded', () => {
  loadEventsForParties();
});


// ==========================================
// Sidebar Toggle Functionality
// ==========================================
(function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mainContent = document.getElementById('mainContent');

  if (!sidebar || !sidebarToggle) return;

  // Toggle sidebar on button click (inside sidebar)
  sidebarToggle.addEventListener('click', () => {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // Mobile: toggle slide in/out
      sidebar.classList.toggle('mobile-open');
      sidebarOverlay.classList.toggle('active');
    } else {
      // Desktop: toggle collapsed/expanded
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('sidebar-collapsed');
    }
  });

  // Mobile menu button (outside sidebar, visible on mobile)
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      sidebarOverlay.classList.add('active');
    });
  }

  // Close sidebar when clicking overlay (mobile)
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Handle window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isMobile = window.innerWidth <= 768;
      
      if (!isMobile) {
        // Remove mobile classes on desktop
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
      } else {
        // Remove desktop collapsed state on mobile
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('sidebar-collapsed');
      }
    }, 250);
  });
})();
