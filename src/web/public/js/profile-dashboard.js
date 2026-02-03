/**
 * Profile Dashboard JavaScript
 * Modular JavaScript for the guild profile dashboard
 */

// ==========================================
// Configuration & Constants
// ==========================================
const WEAPONS = [
  { name: 'Orb', emoji: '' },
  { name: 'Wand', emoji: '' },
  { name: 'SnS', emoji: '' },
  { name: 'Greatsword', emoji: '' },
  { name: 'Staff', emoji: '' },
  { name: 'Bow', emoji: '' },
  { name: 'Crossbows', emoji: '' },
  { name: 'Daggers', emoji: '' },
  { name: 'Spear', emoji: '' }
];

// Day names in English (not localized)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Event type configuration
const EVENT_TYPE_ICONS = {
  siege: '🏰',
  riftstone: '💎',
  boonstone: '🔮',
  wargames: '⚔️',
  warboss: '👹',
  guildevent: '🎪'
};

const EVENT_TYPE_NAMES = {
  siege: 'Siege',
  riftstone: 'Riftstone',
  boonstone: 'Boonstone',
  wargames: 'Wargames',
  warboss: 'War Boss',
  guildevent: 'Guild Event'
};

// Item database
const WISHLIST_ITEMS = {
  archbossWeapons: [
    { id: 'bellandir_blade', name: "Queen Bellandir's Languishing Blade", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00034.webp', category: 'Sword & Shield' },
    { id: 'deluzhnoa_edge', name: "Deluzhnoa's Edge of Eternal Frost", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00052.webp', category: 'Sword & Shield' },
    { id: 'cordy_warblade', name: "Cordy's Warblade of Creeping Doom", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00052.webp', category: 'Greatsword' },
    { id: 'tevent_warblade', name: "Tevent's Warblade of Despair", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00036.webp', category: 'Greatsword' },
    { id: 'tevent_fangs', name: "Tevent's Fangs of Fury", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00035.webp', category: 'Daggers' },
    { id: 'deluzhnoa_razors', name: "Deluzhnoa's Permafrost Razors", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00052.webp', category: 'Daggers' },
    { id: 'tevent_arc', name: "Tevent's Arc of Wailing Death", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00018.webp', category: 'Bow' },
    { id: 'deluzhnoa_arc', name: "Deluzhnoa's Arc of Frozen Death", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00017.webp', category: 'Bow' },
    { id: 'bellandir_crossbow', name: "Queen Bellandir's Toxic Spine Throwers", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00033.webp', category: 'Crossbow' },
    { id: 'cordy_crossbow', name: "Cordy's Stormspore Spike Slingers", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00030.webp', category: 'Crossbow' },
    { id: 'tevent_wand', name: "Tevent's Grasp of Withering", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00011.webp', category: 'Wand' },
    { id: 'cordy_wand', name: "Cordy's Grasp of Manipulation", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00015.webp', category: 'Wand' },
    { id: 'bellandir_staff', name: "Queen Bellandir's Hivemind Staff", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00019.webp', category: 'Staff' },
    { id: 'deluzhnoa_staff', name: "Deluzhnoa's Ancient Petrified Staff", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00018A.webp', category: 'Staff' },
    { id: 'deluzhnoa_spear', name: "Deluzhnoa's Serrated Shard", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00026.webp', category: 'Spear' },
    { id: 'bellandir_spear', name: "Queen Bellandir's Serrated Spike", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00018.webp', category: 'Spear' },
    { id: 'tevent_orb', name: "Tevent's Omniscient Eye", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00014.webp', category: 'Orb' },
    { id: 'cordy_orb', name: "Cordy's Source of Contagion", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00019.webp', category: 'Orb' }
  ],
  archbossArmors: [
    { id: 'crimson_chestplate', name: 'Crimson Lotus Chestplate', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_TS_00019B.webp', type: 'Chest Armor' },
    { id: 'veiled_gloves', name: 'Veiled Concord Gloves', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_GL_00024.webp', type: 'Gloves' },
    { id: 'errant_brim', name: 'Errant Scion Brim', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_HM_00022A.webp', type: 'Helmet' },
    { id: 'umbral_pants', name: 'Umbral Astarch Pants', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_PT_00030.webp', type: 'Pants' },
    { id: 'blood_moon_cloak', name: 'Cloak of the Blood Moon', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_M_CA_00032.webp', type: 'Cloak' },
    { id: 'piercing_ice_cloak', name: 'Cloak of Piercing Ice', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_M_CA_00029.webp', type: 'Cloak' }
  ],
  t3Weapons: [
    { id: 'daigon_stormblade', name: "Daigon's Stormblade", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00017A.webp', category: 'Sword & Shield' },
    { id: 'chernobog_blade', name: "Chernobog's Cauterizing Blade", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00033A.webp', category: 'Sword & Shield' },
    { id: 'cornelius_blade', name: "Cornelius's Blade of Dancing Flame", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00008B.webp', category: 'Sword & Shield' },
    { id: 'nirma_sword', name: "Nirma's Sword of Falling Ash", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00035A.webp', category: 'Sword & Shield' },
    { id: 'ahzreil_sword', name: "Ahzreil's Soulless Sword", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00026B.webp', category: 'Sword & Shield' },
    { id: 'naru_greatblade', name: "Naru's Frenzied Greatblade", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00034.webp', category: 'Greatsword' },
    { id: 'morokai_greatblade', name: "Morokai's Soulfire Greatblade", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00027A.webp', category: 'Greatsword' },
    { id: 'adentus_greatsword', name: "Adentus's Cinderhulk Greatsword", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00028A.webp', category: 'Greatsword' },
    { id: 'junobote_blade', name: "Junobote's Blade of the Red Colossus", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00039A.webp', category: 'Greatsword' },
    { id: 'leviathan_tendrils', name: "Leviathan's Bladed Tendrils", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00051.webp', category: 'Daggers' },
    { id: 'kowazan_daggers', name: "Kowazan's Daggers of the Blood Moon", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00037A.webp', category: 'Daggers' },
    { id: 'minzerok_daggers', name: "Minzerok's Daggers of Flaying", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00039A.webp', category: 'Daggers' },
    { id: 'leviathan_longbow', name: "Leviathan's Bloodstorm Longbow", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00051.webp', category: 'Bow' },
    { id: 'aelon_longbow', name: "Grand Aelon's Longbow of Blight", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00034A.webp', category: 'Bow' },
    { id: 'akman_crossbows', name: "Akman's Bloodletting Crossbows", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00031.webp', category: 'Crossbow' },
    { id: 'malakar_crossbows', name: "Malakar's Flamespike Crossbows", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00034A.webp', category: 'Crossbow' },
    { id: 'kowazan_crossbows', name: "Kowazan's Crossbows of the Eclipse", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00035A.webp', category: 'Crossbow' },
    { id: 'deckman_scepter', name: "Deckman's Balefire Scepter", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00003C.webp', category: 'Wand' },
    { id: 'excavator_scepter', name: "Excavator's Radiant Scepter", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00012A.webp', category: 'Wand' },
    { id: 'daigon_emberstaff', name: "Daigon's Charred Emberstaff", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_staff_00036.webp', category: 'Staff' },
    { id: 'talus_staff', name: "Talus's Incandescent Staff", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00032A.webp', category: 'Staff' },
    { id: 'aridus_voidstaff', name: "Aridus's Immolated Voidstaff", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00033A.webp', category: 'Staff' },
    { id: 'naru_spear', name: "Naru's Sawfang Spear", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00030.webp', category: 'Spear' },
    { id: 'junobote_ranseur', name: "Junobote's Extra Smoldering Ranseur", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00021A.webp', category: 'Spear' },
    { id: 'manticus_core', name: 'Manticus Fraternal Core', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00016.webp', category: 'Orb' },
    { id: 'talus_core', name: "Talus's Transcendent Core", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00009A.webp', category: 'Orb' }
  ],
  t3Armors: [
    { id: 'fallen_helmet', name: 'Fallen Dynasty Helmet', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_PL_M_HM_00018B.webp', type: 'Helmet' },
    { id: 'fallen_plate', name: 'Fallen Dynasty Plate Armor', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_PL_M_TS_00013A.webp', type: 'Chest Armor' },
    { id: 'fallen_legs', name: 'Fallen Dynasty Leg Plates', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_PT_00010B.webp', type: 'Pants' },
    { id: 'fallen_sabatons', name: 'Fallen Dynasty Sabatons', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_BT_00017A.webp', type: 'Boots' },
    { id: 'blood_hood', name: 'Blood Hunter Hood', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_HM_05002A.webp', type: 'Helmet' },
    { id: 'blood_garb', name: 'Blood Hunter Garb', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_LE_M_TS_00018A.webp', type: 'Chest Armor' },
    { id: 'blood_guards', name: 'Blood Hunter Hand Guards', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_GL_00022C.webp', type: 'Gloves' },
    { id: 'blood_boots', name: 'Blood Hunter Boots', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_BT_00015A.webp', type: 'Boots' },
    { id: 'twilight_pants', name: 'Twilight Embrace Pants', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_PT_00008C.webp', type: 'Pants' },
    { id: 'twilight_robes', name: 'Twilight Embrace Robes', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_TS_00005C.webp', type: 'Chest Armor' },
    { id: 'twilight_gloves', name: 'Twilight Embrace Gloves', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_GL_00001D.webp', type: 'Gloves' },
    { id: 'twilight_shoes', name: 'Twilight Embrace Shoes', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_BT_00005C.webp', type: 'Boots' }
  ],
  t3Accessories: [
    { id: 'two_moons_earrings', name: 'Earrings of the Two Moons', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Earring_00027.webp', type: 'Earring' },
    { id: 'venelux_earrings', name: "Venelux Scholar's Earrings", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Earring_00028.webp', type: 'Earring' },
    { id: 'steadfast_belt', name: 'Belt of the Steadfast Pledge', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Belt_00055.webp', type: 'Belt' },
    { id: 'rustling_sash', name: 'Sash of Rustling Leaves', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Belt_00049.webp', type: 'Belt' },
    { id: 'unregretted_locket', name: 'Locket of Unregretted Sin', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Necklace_00054.webp', type: 'Necklace' },
    { id: 'cold_revenge_wristlet', name: 'Wristlet of Cold Revenge', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Bracelet_00051.webp', type: 'Bracelet' },
    { id: 'endless_breeze_bracelet', name: 'Endless Breeze Bracelet', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Bracelet_00049.webp', type: 'Bracelet' },
    { id: 'davinci_ring', name: "DaVinci's Signet Ring", icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Ring_00063.webp', type: 'Ring' },
    { id: 'brutal_agony_band', name: 'Band of Brutal Agony', icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Ring_00060.webp', type: 'Ring' }
  ]
};

const WISHLIST_LIMITS = {
  archbossWeapon: 1,
  archbossArmor: 1,
  t3Weapons: 1,
  t3Armors: 4,
  t3Accessories: 2
};

// ==========================================
// State Management
// ==========================================
let profileData = null;
let eventsData = null;
let wishlistData = null;
let currentAttendanceEventId = null;
let itemRollsData = null;
let rosterData = null;
let rosterSortField = 'name';
let rosterSortAscending = true;

// Profile form change tracking
let originalProfileData = null;
let hasProfileChanges = false;

// Wishlist state
let pendingWishlist = null;
let hasUnsavedChanges = false;

// Spam prevention
const processingEvents = new Set();
const rsvpCooldowns = new Map();
let isSubmittingAttendance = false;
let isSavingProfile = false;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadProfileData();
  loadEventsData();
  loadWishlistData();
  loadRosterData();
  loadItemRollsData();
  checkAdminAccess();
});

// ==========================================
// Admin Panel Access
// ==========================================
async function checkAdminAccess() {
  try {
    const response = await fetch(`${API_BASE}/admin-access?_=${Date.now()}`, {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      if (data.hasAccess) {
        const adminBtn = document.getElementById('adminPanelBtn');
        adminBtn.style.display = 'flex';
        adminBtn.addEventListener('click', openAdminPanel);
      }
    }
  } catch (error) {
    console.error('Error checking admin access:', error);
  }
}

async function openAdminPanel() {
  const btn = document.getElementById('adminPanelBtn');
  btn.disabled = true;
  btn.textContent = 'Opening...';

  try {
    const response = await fetch(`${API_BASE}/admin-panel-link?_=${Date.now()}`, {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      window.open(data.url, '_blank');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to open admin panel', 'error');
    }
  } catch (error) {
    console.error('Error opening admin panel:', error);
    showToast('Failed to open admin panel', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    Admin Panel
  `;
}

// ==========================================
// Tab Navigation
// ==========================================
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update buttons
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');

      // Refresh data when switching tabs
      switch (tab) {
        case 'info':
          loadProfileData();
          break;
        case 'events':
          loadEventsData();
          break;
        case 'wishlist':
          loadWishlistData();
          break;
        case 'roster':
          loadRosterData();
          break;
        case 'itemrolls':
          loadItemRollsData();
          break;
      }
    });
  });
}

// ==========================================
// API Communication
// ==========================================
async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    cache: 'no-store',
    credentials: 'include' // Include cookies for OAuth sessions
  };
  if (data) options.body = JSON.stringify(data);

  const separator = endpoint.includes('?') ? '&' : '?';
  // Use API_BASE which is set based on auth method (OAuth or token)
  const url = `${API_BASE}/${endpoint}${separator}_t=${Date.now()}`;

  console.log('[API Debug] Calling:', method, url);
  console.log('[API Debug] IS_OAUTH:', IS_OAUTH, 'API_BASE:', API_BASE);

  const response = await fetch(url, options);

  console.log('[API Debug] Response status:', response.status);

  // Handle authentication errors
  if (response.status === 401 && IS_OAUTH) {
    console.log('[API Debug] 401 - Session expired, redirecting to login');
    // Session expired, redirect to login
    window.location.href = '/';
    return;
  }

  const result = await response.json();
  console.log('[API Debug] Response data:', result);

  if (!response.ok) {
    throw new Error(result.error || 'Request failed');
  }

  return result;
}

// ==========================================
// Date/Time Formatting (English only)
// ==========================================
function formatDateWithDay(date) {
  const dayName = DAY_NAMES[date.getDay()];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${month}/${day}/${year}`;
}

function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function getNextEventOccurrence(dayOfWeek, hour, minute) {
  const now = new Date();
  const currentDay = now.getDay();

  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  const nextEvent = new Date(now);
  nextEvent.setDate(now.getDate() + daysUntil);
  nextEvent.setUTCHours(hour, minute, 0, 0);

  if (daysUntil === 0 && nextEvent < now) {
    nextEvent.setDate(nextEvent.getDate() + 7);
  }

  return nextEvent;
}

// ==========================================
// Profile Info Module
// ==========================================
async function loadProfileData() {
  try {
    profileData = await apiCall('data');
    renderProfileInfo();
    renderStats();
  } catch (error) {
    console.error('Error loading profile:', error);
    document.getElementById('info-content').innerHTML = '<p class="error">Failed to load profile data</p>';
  }
}

function renderProfileInfo() {
  const info = profileData.playerInfo;
  const roleClass = info.role ? `role-${info.role}` : '';
  const hasParty = profileData.partyNumber != null;

  // Store original data for change detection
  originalProfileData = {
    weapon1: info.weapon1 || '',
    weapon2: info.weapon2 || '',
    cp: info.cp || '',
    buildLink: info.buildLink || '',
    gearScreenshotUrl: info.gearScreenshotUrl || ''
  };
  hasProfileChanges = false;

  const html = `
    <div class="info-grid">
      <div class="info-item">
        <label>Role</label>
        <div class="value ${roleClass}">${info.role ? info.role.charAt(0).toUpperCase() + info.role.slice(1) : 'Not Set'}</div>
      </div>
      <div class="info-item">
        <label>Primary Weapon</label>
        <div class="value">${info.weapon1 || 'Not Set'}</div>
      </div>
      <div class="info-item">
        <label>Secondary Weapon</label>
        <div class="value">${info.weapon2 || 'Not Set'}</div>
      </div>
      <div class="info-item">
        <label>Combat Power</label>
        <div class="value">${info.cp ? info.cp.toLocaleString() : 'Not Set'}</div>
      </div>
      <div class="info-item ${hasParty ? 'clickable' : ''}" ${hasParty ? `onclick="showPartyMembers()"` : ''}>
        <label>Static Party</label>
        <div class="value">${hasParty ? 'Party ' + profileData.partyNumber : 'Not Assigned'}</div>
        ${hasParty ? '<div class="click-hint">Click to view party members</div>' : ''}
      </div>
    </div>

    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
      <h3 style="font-size: 16px; margin-bottom: 16px;">Edit Information</h3>
      <form id="info-form" onsubmit="saveProfileInfo(event)">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div class="form-group">
            <label>Primary Weapon</label>
            <select class="form-control" id="edit-weapon1" onchange="checkProfileChanges()">
              <option value="">Select Weapon</option>
              ${WEAPONS.map(w => `<option value="${w.name}" ${info.weapon1 === w.name ? 'selected' : ''}>${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Secondary Weapon</label>
            <select class="form-control" id="edit-weapon2" onchange="checkProfileChanges()">
              <option value="">Select Weapon</option>
              ${WEAPONS.map(w => `<option value="${w.name}" ${info.weapon2 === w.name ? 'selected' : ''}>${w.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Combat Power</label>
            <input type="number" class="form-control" id="edit-cp" value="${info.cp || ''}" min="0" max="10000000" placeholder="Enter CP" oninput="checkProfileChanges()">
          </div>
          <div class="form-group">
            <label>Build Link</label>
            <input type="url" class="form-control" id="edit-buildlink" value="${info.buildLink || ''}" placeholder="https://..." oninput="checkProfileChanges()">
          </div>
        </div>
        <button type="submit" class="btn btn-primary" id="save-profile-btn" style="margin-top: 16px;" disabled>No Changes</button>
      </form>
    </div>

    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color);">
      <h3 style="font-size: 16px; margin-bottom: 16px;">Gear Screenshot</h3>
      ${info.gearScreenshotUrl ? `
        <img src="${info.gearScreenshotUrl}" alt="Gear Screenshot" class="gear-screenshot" style="margin-bottom: 16px;">
      ` : `
        <p style="color: var(--text-secondary); margin-bottom: 16px;">No gear screenshot uploaded yet.</p>
      `}
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <input type="file" id="gear-file-input" accept="image/png,image/jpg,image/jpeg,image/webp,image/gif" style="display: none;">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('gear-file-input').click()">
          ${info.gearScreenshotUrl ? 'Update Screenshot' : 'Upload Screenshot'}
        </button>
        <span id="gear-upload-status" style="color: var(--text-secondary); font-size: 13px;"></span>
      </div>
    </div>
  `;

  document.getElementById('info-content').innerHTML = html;
  document.getElementById('gear-file-input').addEventListener('change', handleGearFileSelect);
}

function checkProfileChanges() {
  const currentData = {
    weapon1: document.getElementById('edit-weapon1')?.value || '',
    weapon2: document.getElementById('edit-weapon2')?.value || '',
    cp: document.getElementById('edit-cp')?.value || '',
    buildLink: document.getElementById('edit-buildlink')?.value || ''
  };

  hasProfileChanges =
    currentData.weapon1 !== originalProfileData.weapon1 ||
    currentData.weapon2 !== originalProfileData.weapon2 ||
    currentData.cp !== String(originalProfileData.cp || '') ||
    currentData.buildLink !== originalProfileData.buildLink;

  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.disabled = !hasProfileChanges;
    saveBtn.textContent = hasProfileChanges ? 'Save Changes' : 'No Changes';
  }
}

async function saveProfileInfo(e) {
  e.preventDefault();

  if (isSavingProfile || !hasProfileChanges) return;

  const saveBtn = document.getElementById('save-profile-btn');
  if (!saveBtn) return;

  isSavingProfile = true;
  const originalText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  saveBtn.style.opacity = '0.6';
  saveBtn.style.cursor = 'not-allowed';

  const data = {
    weapon1: document.getElementById('edit-weapon1').value || undefined,
    weapon2: document.getElementById('edit-weapon2').value || undefined,
    cp: document.getElementById('edit-cp').value ? parseInt(document.getElementById('edit-cp').value) : undefined,
    buildLink: document.getElementById('edit-buildlink').value || undefined
  };

  try {
    await apiCall('update-info', 'POST', data);
    showToast('Profile updated successfully', 'success');
    await loadProfileData();
  } catch (error) {
    showToast(error.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
    saveBtn.style.opacity = '';
    saveBtn.style.cursor = '';
  } finally {
    isSavingProfile = false;
  }
}

async function handleGearFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const validTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    showToast('Please select a valid image file (PNG, JPG, WEBP, GIF)', 'error');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast('Image is too large. Maximum size is 8MB.', 'error');
    return;
  }

  const statusEl = document.getElementById('gear-upload-status');
  statusEl.textContent = 'Uploading...';
  statusEl.style.color = 'var(--text-secondary)';

  try {
    const reader = new FileReader();
    reader.onload = async function(event) {
      const imageData = event.target.result;
      try {
        await apiCall('upload-gear', 'POST', { imageData });
        showToast('Gear screenshot uploaded successfully!', 'success');
        statusEl.textContent = '';
        await loadProfileData();
      } catch (error) {
        showToast(error.message, 'error');
        statusEl.textContent = 'Upload failed';
        statusEl.style.color = 'var(--danger-color)';
      }
    };
    reader.onerror = function() {
      showToast('Failed to read file', 'error');
      statusEl.textContent = 'Upload failed';
      statusEl.style.color = 'var(--danger-color)';
    };
    reader.readAsDataURL(file);
  } catch (error) {
    showToast('Failed to upload screenshot', 'error');
    statusEl.textContent = 'Upload failed';
    statusEl.style.color = 'var(--danger-color)';
  }
}

// ==========================================
// Party Members Modal
// ==========================================
async function showPartyMembers() {
  if (!profileData.partyNumber) return;

  const modal = document.getElementById('party-members-modal');
  const content = document.getElementById('party-members-content');

  content.innerHTML = '<div class="loading">Loading party members...</div>';
  modal.classList.add('show');

  try {
    const data = await apiCall('party-members');
    renderPartyMembers(data.members);
  } catch (error) {
    content.innerHTML = '<p style="color: var(--danger-color);">Failed to load party members</p>';
  }
}

function renderPartyMembers(members) {
  const content = document.getElementById('party-members-content');

  if (!members || members.length === 0) {
    content.innerHTML = '<p style="color: var(--text-secondary);">No other members in your party</p>';
    return;
  }

  const roleOrder = { tank: 0, healer: 1, dps: 2 };
  const sortedMembers = [...members].sort((a, b) => {
    const roleA = roleOrder[a.role] ?? 3;
    const roleB = roleOrder[b.role] ?? 3;
    if (roleA !== roleB) return roleA - roleB;
    return (b.cp || 0) - (a.cp || 0);
  });

  const html = `
    <div class="party-members-list">
      ${sortedMembers.map(member => {
        const roleEmoji = member.role === 'tank' ? '🛡️' : member.role === 'healer' ? '💚' : '⚔️';
        const isCurrentUser = member.isCurrentUser;
        return `
          <div class="party-member-row ${isCurrentUser ? 'current-user' : ''}">
            ${member.avatarUrl ? `<img src="${member.avatarUrl}" alt="" class="party-member-avatar">` : '<div class="party-member-avatar" style="background: var(--bg-card);"></div>'}
            <div class="party-member-info">
              <div class="party-member-name">${roleEmoji} ${member.displayName}${isCurrentUser ? ' (You)' : ''}</div>
              <div class="party-member-weapons">${member.weapon1 || '?'} / ${member.weapon2 || '?'}</div>
            </div>
            <div class="party-member-cp">${formatCP(member.cp)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  content.innerHTML = html;
}

function closePartyMembersModal() {
  document.getElementById('party-members-modal').classList.remove('show');
}

// ==========================================
// Statistics Module
// ==========================================
function renderStats() {
  const bonuses = profileData.bonuses;
  const weeklyAttendance = profileData.weeklyTotalEvents > 0
    ? Math.round((bonuses.eventsAttended / profileData.weeklyTotalEvents) * 100)
    : 0;

  let wishlistHtml = '';
  let receivedHtml = '';

  if (wishlistData) {
    const submission = wishlistData.submission || {};
    const givenItems = wishlistData.givenItems || [];

    const wishlistedIds = [
      ...(submission.archbossWeapon || []),
      ...(submission.archbossArmor || []),
      ...(submission.t3Weapons || []),
      ...(submission.t3Armors || []),
      ...(submission.t3Accessories || [])
    ];

    const wishlistedItems = wishlistedIds.map(id => getItemById(id)).filter(Boolean);
    const receivedItemIds = givenItems.map(gi => gi.itemId);
    const receivedItems = receivedItemIds.map(id => getItemById(id)).filter(Boolean);

    if (wishlistedItems.length > 0) {
      wishlistHtml = `
        <div class="stats-wishlist-section">
          <div class="stats-wishlist-title">Your Wishlist</div>
          <div class="stats-wishlist-items">
            ${wishlistedItems.map(item => {
              const isReceived = receivedItemIds.includes(item.id);
              return `
                <div class="stats-wishlist-item ${isReceived ? 'received' : ''}">
                  <img src="${item.icon}" alt="${item.name}" loading="lazy">
                  <div class="stats-wishlist-item-info">
                    <span class="stats-wishlist-item-name" title="${item.name}">${item.name}</span>
                    <span class="stats-wishlist-item-category">${item.category || item.type}</span>
                  </div>
                  ${isReceived ? '<span class="stats-wishlist-item-badge received">RECEIVED</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      wishlistHtml = `
        <div class="stats-wishlist-section">
          <div class="stats-wishlist-title">Your Wishlist</div>
          <div class="stats-wishlist-empty">No items wishlisted yet. Visit the Wishlist tab to select items.</div>
        </div>
      `;
    }

    const receivedNotInWishlist = receivedItems.filter(item => !wishlistedIds.includes(item.id));
    if (receivedNotInWishlist.length > 0) {
      receivedHtml = `
        <div class="stats-wishlist-section" style="margin-top: 16px; padding-top: 16px;">
          <div class="stats-wishlist-title">Other Received Items</div>
          <div class="stats-wishlist-items">
            ${receivedNotInWishlist.map(item => `
              <div class="stats-wishlist-item received">
                <img src="${item.icon}" alt="${item.name}" loading="lazy">
                <div class="stats-wishlist-item-info">
                  <span class="stats-wishlist-item-name" title="${item.name}">${item.name}</span>
                  <span class="stats-wishlist-item-category">${item.category || item.type}</span>
                </div>
                <span class="stats-wishlist-item-badge received">RECEIVED</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  const html = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${profileData.totalEvents}</div>
        <div class="stat-label">Total PvP Events</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${bonuses.eventsAttended || 0}</div>
        <div class="stat-label">Weekly Attendance</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${bonuses.bonusCount || 0}</div>
        <div class="stat-label">Weekly Bonus</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${weeklyAttendance}%</div>
        <div class="stat-label">Attendance Rate</div>
      </div>
    </div>
    ${wishlistHtml}
    ${receivedHtml}
  `;

  document.getElementById('stats-content').innerHTML = html;
}

// ==========================================
// Events Module
// ==========================================
async function loadEventsData() {
  try {
    eventsData = await apiCall('events');
    renderEvents();
    renderStaticEvents();
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-content').innerHTML = '<p class="error">Failed to load events</p>';
  }
}

function renderEvents() {
  if (!eventsData.events || eventsData.events.length === 0) {
    document.getElementById('events-content').innerHTML = `
      <div class="no-events">
        <div class="no-events-icon">📅</div>
        <p>No upcoming events</p>
      </div>
    `;
    return;
  }

  const html = `
    <div class="events-list">
      ${eventsData.events.map(event => {
        const eventDate = new Date(event.eventTime);

        let statusClass = '';
        let statusText = '';

        if (event.isClosed) {
          statusClass = 'not-attending';
          statusText = 'Closed';
        } else if (event.hasRecordedAttendance) {
          statusClass = 'recorded';
          statusText = 'Attended';
        } else if (event.signupStatus === 'attending') {
          statusClass = 'attending';
          statusText = 'Going';
        } else if (event.signupStatus === 'not_attending') {
          statusClass = 'not-attending';
          statusText = 'Not Going';
        } else if (event.signupStatus === 'maybe') {
          statusClass = 'maybe';
          statusText = 'Maybe';
        }

        return `
          <div class="event-card">
            <div class="event-card-header">
              <div class="event-icon">${EVENT_TYPE_ICONS[event.eventType] || '📅'}</div>
              <div class="event-info">
                <h3>${EVENT_TYPE_NAMES[event.eventType] || event.eventType}${event.location ? ' - ' + event.location : ''}</h3>
                <div class="event-time">${formatDateWithDay(eventDate)} at ${formatTime(eventDate)}</div>
              </div>
              ${statusText ? `<span class="event-status ${statusClass}">${statusText}</span>` : ''}
            </div>
            <div class="event-card-body">
              <div style="display: flex; gap: 16px; margin-bottom: 12px; color: var(--text-secondary); font-size: 13px;">
                <span>+${event.bonusPoints} bonus</span>
                <span>${event.rsvpAttendingCount} attending</span>
                <span>${event.attendeesCount} recorded</span>
              </div>
              ${!event.isClosed && !event.hasRecordedAttendance ? `
                <div class="event-actions">
                  ${!event.signupsClosed ? `
                    <button class="btn ${event.signupStatus === 'attending' ? 'btn-success' : 'btn-secondary'}"
                            onclick="updateRsvp('${event._id}', 'attending', this)"
                            ${event.signupStatus === 'attending' ? 'disabled style="cursor: default; opacity: 1;"' : ''}>
                      ${event.signupStatus === 'attending' ? '✓ ' : ''}Going
                    </button>
                    <button class="btn ${event.signupStatus === 'maybe' ? 'btn-warning' : 'btn-secondary'}"
                            onclick="updateRsvp('${event._id}', 'maybe', this)"
                            ${event.signupStatus === 'maybe' ? 'disabled style="cursor: default; opacity: 1;"' : ''}>
                      ${event.signupStatus === 'maybe' ? '✓ ' : ''}Maybe
                    </button>
                    <button class="btn ${event.signupStatus === 'not_attending' ? 'btn-danger' : 'btn-secondary'}"
                            onclick="updateRsvp('${event._id}', 'not_attending', this)"
                            ${event.signupStatus === 'not_attending' ? 'disabled style="cursor: default; opacity: 1;"' : ''}>
                      ${event.signupStatus === 'not_attending' ? '✓ ' : ''}Not Going
                    </button>
                  ` : `
                    <span style="color: var(--text-muted); font-size: 13px;">Signups closed (20 min before event)</span>
                  `}
                </div>
                ${event.canRecordAttendance ? `
                  <div class="attendance-section">
                    <div class="attendance-code-panel">
                      <div class="attendance-code-label">Enter the 4-digit code to record your attendance:</div>
                      <div class="code-input-container">
                        <input type="text" class="code-digit-input" maxlength="1" data-event-id="${event._id}" data-index="0" oninput="handleCodeInput(this)" onkeydown="handleCodeKeydown(event, this)" placeholder="0">
                        <input type="text" class="code-digit-input" maxlength="1" data-event-id="${event._id}" data-index="1" oninput="handleCodeInput(this)" onkeydown="handleCodeKeydown(event, this)" placeholder="0">
                        <input type="text" class="code-digit-input" maxlength="1" data-event-id="${event._id}" data-index="2" oninput="handleCodeInput(this)" onkeydown="handleCodeKeydown(event, this)" placeholder="0">
                        <input type="text" class="code-digit-input" maxlength="1" data-event-id="${event._id}" data-index="3" oninput="handleCodeInput(this)" onkeydown="handleCodeKeydown(event, this)" placeholder="0">
                      </div>
                      <div class="attendance-submit-row">
                        <button class="btn btn-primary" onclick="submitAttendanceCode('${event._id}')" id="submit-attendance-${event._id}">Record Attendance</button>
                      </div>
                    </div>
                  </div>
                ` : ''}
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('events-content').innerHTML = html;
}

function renderStaticEvents() {
  if (!eventsData.staticEvents || eventsData.staticEvents.length === 0) {
    document.getElementById('static-events-content').innerHTML = '<p style="color: var(--text-secondary);">No recurring events scheduled</p>';
    return;
  }

  const sortedEvents = [...eventsData.staticEvents].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const html = sortedEvents.map(event => {
    const nextEvent = getNextEventOccurrence(event.dayOfWeek, event.hour, event.minute);
    const localTime = formatTime(nextEvent);
    // Use English day name directly
    const localDay = DAY_NAMES[nextEvent.getDay()];

    return `
      <div class="static-event-card">
        <div class="static-event-day">${localDay}</div>
        <div>
          <strong>${event.title || 'Untitled Event'}</strong>
          <br>
          <span style="color: var(--text-secondary); font-size: 13px;">${localTime} (Your Time)</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('static-events-content').innerHTML = html;
}

// ==========================================
// Attendance Code Input Handling
// ==========================================
function handleCodeInput(input) {
  // Only allow digits
  input.value = input.value.replace(/[^0-9]/g, '');

  if (input.value.length === 1) {
    const index = parseInt(input.dataset.index);
    const eventId = input.dataset.eventId;

    // Move to next input
    if (index < 3) {
      const nextInput = document.querySelector(`input.code-digit-input[data-event-id="${eventId}"][data-index="${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  }
}

function handleCodeKeydown(e, input) {
  const index = parseInt(input.dataset.index);
  const eventId = input.dataset.eventId;

  if (e.key === 'Backspace' && input.value === '' && index > 0) {
    const prevInput = document.querySelector(`input.code-digit-input[data-event-id="${eventId}"][data-index="${index - 1}"]`);
    if (prevInput) {
      prevInput.focus();
      prevInput.value = '';
    }
  } else if (e.key === 'ArrowLeft' && index > 0) {
    const prevInput = document.querySelector(`input.code-digit-input[data-event-id="${eventId}"][data-index="${index - 1}"]`);
    if (prevInput) prevInput.focus();
  } else if (e.key === 'ArrowRight' && index < 3) {
    const nextInput = document.querySelector(`input.code-digit-input[data-event-id="${eventId}"][data-index="${index + 1}"]`);
    if (nextInput) nextInput.focus();
  } else if (e.key === 'Enter') {
    submitAttendanceCode(eventId);
  }
}

async function submitAttendanceCode(eventId) {
  // Gather the code from all 4 inputs
  const inputs = document.querySelectorAll(`input.code-digit-input[data-event-id="${eventId}"]`);
  let code = '';
  inputs.forEach(input => { code += input.value; });

  if (code.length !== 4) {
    showToast('Please enter all 4 digits', 'error');
    return;
  }

  // Prevent spam
  if (processingEvents.has('attend_' + eventId)) return;
  processingEvents.add('attend_' + eventId);

  const submitBtn = document.getElementById(`submit-attendance-${eventId}`);
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording...';
    submitBtn.style.opacity = '0.6';
  }

  try {
    await apiCall('event-attendance', 'POST', { eventId, code });
    showToast('Attendance recorded!', 'success');
    await loadEventsData();
    await loadProfileData();
  } catch (error) {
    showToast(error.message, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Record Attendance';
      submitBtn.style.opacity = '';
    }
  } finally {
    processingEvents.delete('attend_' + eventId);
  }
}

// ==========================================
// RSVP Handling
// ==========================================
async function updateRsvp(eventId, status, buttonEl) {
  if (buttonEl?.disabled) return;

  const cooldownEnd = rsvpCooldowns.get(eventId);
  if (cooldownEnd && Date.now() < cooldownEnd) {
    const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
    showToast(`Please wait ${remaining}s before changing RSVP`, 'error');
    return;
  }

  if (processingEvents.has(eventId)) return;
  processingEvents.add(eventId);

  rsvpCooldowns.set(eventId, Date.now() + 15000);

  const eventCard = buttonEl?.closest('.event-card');
  const rsvpButtons = eventCard?.querySelectorAll('.event-actions .btn');
  rsvpButtons?.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  });

  try {
    await apiCall('event-rsvp', 'POST', { eventId, status });
    showToast('RSVP updated', 'success');
    await loadEventsData();
    setTimeout(() => applyRsvpCooldown(eventId), 100);
  } catch (error) {
    showToast(error.message, 'error');
    rsvpCooldowns.delete(eventId);
    rsvpButtons?.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
    });
  } finally {
    processingEvents.delete(eventId);
  }
}

function applyRsvpCooldown(eventId) {
  const cooldownEnd = rsvpCooldowns.get(eventId);
  if (!cooldownEnd || Date.now() >= cooldownEnd) {
    rsvpCooldowns.delete(eventId);
    return;
  }

  const remaining = cooldownEnd - Date.now();

  const eventCards = document.querySelectorAll('.event-card');
  eventCards.forEach(card => {
    const rsvpButtons = card.querySelectorAll('.event-actions .btn');
    rsvpButtons.forEach(btn => {
      const onclick = btn.getAttribute('onclick');
      if (onclick && onclick.includes(eventId)) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
      }
    });
  });

  setTimeout(() => {
    rsvpCooldowns.delete(eventId);
    if (eventsData) renderEvents();
  }, remaining);
}

// ==========================================
// Wishlist Module
// ==========================================
async function loadWishlistData() {
  try {
    wishlistData = await apiCall('wishlist');
    pendingWishlist = null;
    hasUnsavedChanges = false;
    renderWishlistStatus();
    renderWishlist();
    if (profileData) {
      renderStats();
    }
  } catch (error) {
    console.error('Error loading wishlist:', error);
    document.getElementById('wishlist-content').innerHTML = '<p class="error">Failed to load wishlist</p>';
  }
}

function renderWishlistStatus() {
  let statusHtml = '';

  if (wishlistData.isFrozen) {
    statusHtml = '<div style="padding: 12px; background: var(--dps-bg); border-radius: 8px; margin-bottom: 20px; color: var(--dps-color);">Wishlists are currently frozen. You cannot make changes.</div>';
  } else if (wishlistData.hasSubmitted) {
    statusHtml = '<div style="padding: 12px; background: var(--healer-bg); border-radius: 8px; margin-bottom: 20px; color: var(--healer-color);">Your wishlist has been submitted. Contact an admin to make changes.</div>';
  }

  document.getElementById('wishlist-status').innerHTML = statusHtml;
}

function getItemById(itemId) {
  for (const category of Object.values(WISHLIST_ITEMS)) {
    const item = category.find(i => i.id === itemId);
    if (item) return item;
  }
  return null;
}

function isItemReceived(itemId) {
  return wishlistData.givenItems.some(gi => gi.itemId === itemId);
}

function initPendingWishlist() {
  if (!wishlistData) return;
  const submission = wishlistData.submission || {};
  pendingWishlist = {
    archbossWeapon: [...(submission.archbossWeapon || [])],
    archbossArmor: [...(submission.archbossArmor || [])],
    t3Weapons: [...(submission.t3Weapons || [])],
    t3Armors: [...(submission.t3Armors || [])],
    t3Accessories: [...(submission.t3Accessories || [])]
  };
  hasUnsavedChanges = false;
}

function renderWishlist() {
  if (!pendingWishlist) {
    initPendingWishlist();
  }

  const canEdit = !wishlistData.isFrozen && !wishlistData.hasSubmitted;

  const sections = [
    { key: 'archbossWeapon', title: 'Archboss Weapons', items: WISHLIST_ITEMS.archbossWeapons, limit: WISHLIST_LIMITS.archbossWeapon, selected: pendingWishlist?.archbossWeapon || [] },
    { key: 'archbossArmor', title: 'Archboss Armor', items: WISHLIST_ITEMS.archbossArmors, limit: WISHLIST_LIMITS.archbossArmor, selected: pendingWishlist?.archbossArmor || [] },
    { key: 't3Weapons', title: 'T3 Weapons', items: WISHLIST_ITEMS.t3Weapons, limit: WISHLIST_LIMITS.t3Weapons, selected: pendingWishlist?.t3Weapons || [] },
    { key: 't3Armors', title: 'T3 Armors', items: WISHLIST_ITEMS.t3Armors, limit: WISHLIST_LIMITS.t3Armors, selected: pendingWishlist?.t3Armors || [] },
    { key: 't3Accessories', title: 'T3 Accessories', items: WISHLIST_ITEMS.t3Accessories, limit: WISHLIST_LIMITS.t3Accessories, selected: pendingWishlist?.t3Accessories || [] }
  ];

  const html = sections.map(section => `
    <div class="wishlist-section">
      <div class="wishlist-section-title">
        ${section.title}
        <span class="limit">${section.selected.length}/${section.limit}</span>
      </div>
      <div class="wishlist-items">
        ${section.items.map(item => {
          const isSelected = section.selected.includes(item.id);
          const received = isItemReceived(item.id);
          const disabled = !canEdit || received;

          return `
            <div class="wishlist-item ${isSelected ? 'selected' : ''} ${received ? 'received' : ''} ${disabled && !received ? 'disabled' : ''}"
                 onclick="${!disabled ? `toggleWishlistItem('${section.key}', '${item.id}')` : ''}">
              <img src="${item.icon}" alt="${item.name}" loading="lazy">
              <div class="item-name">${item.name}</div>
              <div class="item-category">${item.category || item.type}</div>
              ${received ? '<div class="received-badge">Received</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  const actionsHtml = canEdit ? `
    <div class="wishlist-actions">
      <button class="btn btn-secondary" onclick="clearWishlist()">Clear All</button>
      <button class="btn btn-primary" onclick="saveWishlist()" id="save-wishlist-btn" ${!hasUnsavedChanges ? 'disabled style="opacity: 0.5;"' : ''}>
        ${hasUnsavedChanges ? 'Save Changes' : 'Saved'}
      </button>
      <button class="btn btn-success" onclick="submitWishlist()">Submit Wishlist</button>
    </div>
    ${hasUnsavedChanges ? '<p style="color: var(--warning-color); font-size: 12px; margin-top: 8px;">You have unsaved changes</p>' : ''}
  ` : '';

  document.getElementById('wishlist-content').innerHTML = html + actionsHtml;
}

function toggleWishlistItem(category, itemId) {
  if (wishlistData.isFrozen || wishlistData.hasSubmitted) return;
  if (!pendingWishlist) initPendingWishlist();

  let items = pendingWishlist[category] || [];
  const limit = WISHLIST_LIMITS[category];

  const index = items.indexOf(itemId);
  if (index > -1) {
    items.splice(index, 1);
  } else {
    if (items.length >= limit) {
      items.shift();
    }
    items.push(itemId);
  }

  pendingWishlist[category] = items;
  hasUnsavedChanges = true;
  renderWishlist();
}

async function saveWishlist() {
  if (wishlistData.isFrozen || wishlistData.hasSubmitted) return;
  if (!hasUnsavedChanges) return;

  const saveBtn = document.getElementById('save-wishlist-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    await apiCall('update-wishlist', 'POST', {
      archbossWeapon: pendingWishlist.archbossWeapon || [],
      archbossArmor: pendingWishlist.archbossArmor || [],
      t3Weapons: pendingWishlist.t3Weapons || [],
      t3Armors: pendingWishlist.t3Armors || [],
      t3Accessories: pendingWishlist.t3Accessories || []
    });
    hasUnsavedChanges = false;
    showToast('Wishlist saved', 'success');
    wishlistData.submission = { ...pendingWishlist };
    renderWishlist();
    if (profileData) renderStats();
  } catch (error) {
    showToast(error.message, 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  }
}

function clearWishlist() {
  if (wishlistData.isFrozen || wishlistData.hasSubmitted) return;

  pendingWishlist = {
    archbossWeapon: [],
    archbossArmor: [],
    t3Weapons: [],
    t3Armors: [],
    t3Accessories: []
  };
  hasUnsavedChanges = true;
  renderWishlist();
}

async function submitWishlist() {
  if (wishlistData.isFrozen || wishlistData.hasSubmitted) return;

  if (!pendingWishlist ||
      (!pendingWishlist.archbossWeapon?.length &&
       !pendingWishlist.archbossArmor?.length &&
       !pendingWishlist.t3Weapons?.length &&
       !pendingWishlist.t3Armors?.length &&
       !pendingWishlist.t3Accessories?.length)) {
    showToast('Please select at least one item', 'error');
    return;
  }

  if (!confirm('Are you sure you want to submit your wishlist? You will not be able to change it without admin help.')) {
    return;
  }

  try {
    await apiCall('update-wishlist', 'POST', {
      archbossWeapon: pendingWishlist.archbossWeapon || [],
      archbossArmor: pendingWishlist.archbossArmor || [],
      t3Weapons: pendingWishlist.t3Weapons || [],
      t3Armors: pendingWishlist.t3Armors || [],
      t3Accessories: pendingWishlist.t3Accessories || [],
      submit: true
    });
    showToast('Wishlist submitted!', 'success');
    hasUnsavedChanges = false;
    await loadWishlistData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ==========================================
// Roster Module
// ==========================================
async function loadRosterData() {
  try {
    rosterData = await apiCall('roster');
    renderRoster();
    setupRosterSortButtons();
  } catch (error) {
    console.error('Error loading roster:', error);
    document.getElementById('roster-content').innerHTML = '<p class="error">Failed to load roster</p>';
  }
}

function setupRosterSortButtons() {
  const sortSelect = document.getElementById('roster-sort-field');
  if (sortSelect) {
    sortSelect.value = rosterSortField;
    sortSelect.addEventListener('change', () => {
      rosterSortField = sortSelect.value;
      renderRoster();
    });
  }

  const ascBtn = document.getElementById('sort-asc-btn');
  const descBtn = document.getElementById('sort-desc-btn');

  if (ascBtn) {
    ascBtn.addEventListener('click', () => {
      rosterSortAscending = true;
      ascBtn.classList.add('active');
      descBtn.classList.remove('active');
      renderRoster();
    });
  }

  if (descBtn) {
    descBtn.addEventListener('click', () => {
      rosterSortAscending = false;
      descBtn.classList.add('active');
      ascBtn.classList.remove('active');
      renderRoster();
    });
  }
}

function sortRosterPlayers(players) {
  const sorted = [...players];
  const roleOrder = { tank: 0, healer: 1, dps: 2 };

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (rosterSortField) {
      case 'name':
        comparison = a.displayName.localeCompare(b.displayName);
        break;
      case 'cp':
        comparison = a.cp - b.cp;
        break;
      case 'role':
        comparison = roleOrder[a.role] - roleOrder[b.role];
        if (comparison === 0) comparison = a.displayName.localeCompare(b.displayName);
        break;
      case 'classes':
        const aWeapons = `${a.weapon1}/${a.weapon2}`;
        const bWeapons = `${b.weapon1}/${b.weapon2}`;
        comparison = aWeapons.localeCompare(bWeapons);
        break;
      case 'totalEvents':
        comparison = a.totalEvents - b.totalEvents;
        break;
      case 'attendance':
        comparison = a.attendancePercent - b.attendancePercent;
        break;
      default:
        comparison = 0;
    }

    return rosterSortAscending ? comparison : -comparison;
  });

  return sorted;
}

function formatCP(cp) {
  if (!cp || cp === 0) return '0';
  if (cp >= 1000000) return `${(cp / 1000000).toFixed(1)}M`;
  if (cp >= 1000) return `${(cp / 1000).toFixed(1)}K`;
  return cp.toString();
}

function getAttendanceClass(percent) {
  if (percent >= 70) return 'roster-attendance-good';
  if (percent >= 40) return 'roster-attendance-medium';
  return 'roster-attendance-low';
}

function renderRoster() {
  if (!rosterData || !rosterData.players || rosterData.players.length === 0) {
    document.getElementById('roster-content').innerHTML = `
      <div class="no-events">
        <div class="no-events-icon">👥</div>
        <p>No players in the roster yet</p>
      </div>
    `;
    return;
  }

  const summary = rosterData.summary;
  const sortedPlayers = sortRosterPlayers(rosterData.players);

  const summaryHtml = `
    <div class="roster-summary">
      <div class="roster-summary-item">
        <div class="roster-summary-value">${summary.totalPlayers}</div>
        <div class="roster-summary-label">Players</div>
      </div>
      <div class="roster-summary-item">
        <div class="roster-summary-value">${formatCP(summary.totalCP)}</div>
        <div class="roster-summary-label">Total CP</div>
      </div>
      <div class="roster-summary-item">
        <div class="roster-summary-value" style="color: var(--tank-color);">${summary.tanks}</div>
        <div class="roster-summary-label">Tanks</div>
      </div>
      <div class="roster-summary-item">
        <div class="roster-summary-value" style="color: var(--healer-color);">${summary.healers}</div>
        <div class="roster-summary-label">Healers</div>
      </div>
      <div class="roster-summary-item">
        <div class="roster-summary-value" style="color: var(--dps-color);">${summary.dps}</div>
        <div class="roster-summary-label">DPS</div>
      </div>
    </div>
  `;

  const tableHtml = `
    <div style="overflow-x: auto;">
      <table class="roster-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>Weapons</th>
            <th>CP</th>
            <th>Total Events</th>
            <th>Attendance</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPlayers.map(player => {
            const roleClass = `roster-role-${player.role}`;
            const roleEmoji = player.role === 'tank' ? '🛡️' : player.role === 'healer' ? '💚' : '⚔️';
            const roleDisplay = player.role.charAt(0).toUpperCase() + player.role.slice(1);
            const attendanceClass = getAttendanceClass(player.attendancePercent);

            return `
              <tr>
                <td>
                  <div class="roster-player-name">
                    ${player.avatarUrl ? `<img src="${player.avatarUrl}" alt="" class="roster-avatar">` : ''}
                    <span>${player.displayName}</span>
                  </div>
                </td>
                <td>
                  <span class="roster-role-badge ${roleClass}">
                    ${roleEmoji} ${roleDisplay}
                  </span>
                </td>
                <td class="roster-weapons">${player.weapon1} / ${player.weapon2}</td>
                <td class="roster-cp">${formatCP(player.cp)}</td>
                <td class="roster-stat">${player.totalEvents}</td>
                <td class="roster-stat ${attendanceClass}">${player.attendancePercent}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('roster-content').innerHTML = summaryHtml + tableHtml;
}

// ==========================================
// Item Rolls Module
// ==========================================
async function loadItemRollsData() {
  try {
    itemRollsData = await apiCall('item-rolls');
    renderActiveRolls();
    renderRollHistory();
  } catch (error) {
    console.error('Error loading item rolls:', error);
    document.getElementById('active-rolls-content').innerHTML = '<p class="error">Failed to load item rolls</p>';
    document.getElementById('roll-history-content').innerHTML = '';
  }
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = date - now;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diff > 0) {
    if (days > 0) return `Ends in ${days}d ${hours % 24}h`;
    if (hours > 0) return `Ends in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `Ends in ${minutes}m`;
    return `Ends in ${seconds}s`;
  } else {
    if (days > 0) return `Ended ${days}d ago`;
    if (hours > 0) return `Ended ${hours}h ago`;
    if (minutes > 0) return `Ended ${minutes}m ago`;
    return `Ended just now`;
  }
}

function renderActiveRolls() {
  if (!itemRollsData || !itemRollsData.activeRolls || itemRollsData.activeRolls.length === 0) {
    document.getElementById('active-rolls-content').innerHTML = `
      <div class="no-rolls">
        <div class="no-rolls-icon">🎲</div>
        <p>No active item rolls</p>
        <p style="font-size: 13px; margin-top: 8px;">Check Discord for item roll announcements</p>
      </div>
    `;
    return;
  }

  const html = itemRollsData.activeRolls.map(roll => renderRollCard(roll, true)).join('');
  document.getElementById('active-rolls-content').innerHTML = html;
}

function renderRollHistory() {
  if (!itemRollsData || !itemRollsData.rollHistory || itemRollsData.rollHistory.length === 0) {
    document.getElementById('roll-history-content').innerHTML = `
      <div class="no-rolls">
        <div class="no-rolls-icon">📜</div>
        <p>No roll history yet</p>
        <p style="font-size: 13px; margin-top: 8px;">Your past rolls will appear here</p>
      </div>
    `;
    return;
  }

  const html = itemRollsData.rollHistory.map(roll => renderRollCard(roll, false)).join('');
  document.getElementById('roll-history-content').innerHTML = html;
}

function renderRollCard(roll, isActive) {
  const userId = CURRENT_USER_ID;
  const userRoll = roll.rolls.find(r => r.userId === userId);
  const userPassed = roll.passes.some(p => p.userId === userId);
  const isWinner = roll.winnerId === userId;
  const isEligible = roll.eligibleUsers.length === 0 || roll.eligibleUsers.includes(userId);

  const sortedRolls = [...roll.rolls].sort((a, b) => b.total - a.total);
  const allParticipants = [
    ...sortedRolls,
    ...roll.passes.map(p => ({ ...p, isPassed: true }))
  ];

  let userStatusHtml = '';
  if (userRoll) {
    userStatusHtml = `
      <div class="item-roll-your-status">
        <div class="item-roll-your-status-label">Your Roll</div>
        <div class="item-roll-your-status-value">
          🎲 ${userRoll.total} (Base: ${userRoll.baseRoll} + Bonus: ${userRoll.bonus})
          ${isWinner ? ' — Winner!' : ''}
        </div>
      </div>
    `;
  } else if (userPassed) {
    userStatusHtml = `
      <div class="item-roll-your-status">
        <div class="item-roll-your-status-label">Your Status</div>
        <div class="item-roll-your-status-value">⏭️ Passed</div>
      </div>
    `;
  } else if (isActive && isEligible) {
    userStatusHtml = `
      <div class="item-roll-your-status">
        <div class="item-roll-your-status-label">Your Status</div>
        <div class="item-roll-your-status-value">⏳ Waiting for your roll (use Discord to roll)</div>
      </div>
    `;
  } else if (!isEligible) {
    userStatusHtml = `
      <div class="item-roll-your-status">
        <div class="item-roll-your-status-label">Your Status</div>
        <div class="item-roll-your-status-value">❌ Not eligible for this roll</div>
      </div>
    `;
  }

  let statusClass = isActive ? 'active' : (isWinner ? 'won' : 'closed');
  let statusText = isActive ? 'Active' : (isWinner ? 'You Won!' : 'Closed');
  if (roll.closed && roll.winnerId && roll.winnerId !== userId) {
    const winner = allParticipants.find(p => p.userId === roll.winnerId);
    statusText = winner ? `Won by ${winner.displayName || 'Unknown'}` : 'Closed';
  }

  const participantsHtml = allParticipants.slice(0, 5).map((p, index) => {
    const isParticipantWinner = p.userId === roll.winnerId;
    const isYou = p.userId === userId;
    const classes = [
      'item-roll-participant',
      isParticipantWinner ? 'winner' : '',
      isYou ? 'you' : ''
    ].filter(Boolean).join(' ');

    if (p.isPassed) {
      return `
        <div class="${classes}">
          <div class="item-roll-participant-name">
            ${p.avatarUrl ? `<img src="${p.avatarUrl}" class="item-roll-participant-avatar">` : ''}
            <span>${p.displayName || 'Unknown'}${isYou ? ' (You)' : ''}</span>
          </div>
          <span class="item-roll-participant-score passed">Passed</span>
        </div>
      `;
    }

    return `
      <div class="${classes}">
        <div class="item-roll-participant-name">
          ${index === 0 && !isActive && roll.winnerId ? '👑 ' : ''}
          ${p.avatarUrl ? `<img src="${p.avatarUrl}" class="item-roll-participant-avatar">` : ''}
          <span>${p.displayName || 'Unknown'}${isYou ? ' (You)' : ''}</span>
        </div>
        <span class="item-roll-participant-score">${p.total} (${p.baseRoll}+${p.bonus})</span>
      </div>
    `;
  }).join('');

  const moreCount = allParticipants.length - 5;
  const moreHtml = moreCount > 0 ? `<div style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 8px;">+${moreCount} more participant${moreCount > 1 ? 's' : ''}</div>` : '';

  const cardClass = [
    'item-roll-card',
    !isActive ? 'closed' : '',
    isWinner ? 'won' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClass}">
      <div class="item-roll-header">
        ${roll.imageUrl ? `<img src="${roll.imageUrl}" alt="${roll.itemName}" class="item-roll-image">` : ''}
        <div class="item-roll-info">
          <div class="item-roll-name">${roll.itemName}</div>
          <div class="item-roll-trait">Trait: ${roll.trait}</div>
          <span class="item-roll-status ${statusClass}">${statusText}</span>
          <div class="item-roll-time">${formatRelativeTime(isActive ? roll.endsAt : roll.closedAt || roll.endsAt)}</div>
        </div>
      </div>
      ${userStatusHtml}
      ${allParticipants.length > 0 ? `
        <div class="item-roll-participants">
          <div class="item-roll-participants-title">Participants (${allParticipants.length})</div>
          ${participantsHtml}
          ${moreHtml}
        </div>
      ` : ''}
    </div>
  `;
}

// ==========================================
// Toast Notifications
// ==========================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==========================================
// Attendance Modal (Legacy - kept for compatibility)
// ==========================================
function openAttendanceModal(eventId) {
  currentAttendanceEventId = eventId;
  document.getElementById('attendance-code').value = '';
  document.getElementById('attendance-modal').classList.add('show');
}

function closeAttendanceModal() {
  document.getElementById('attendance-modal').classList.remove('show');
  currentAttendanceEventId = null;
}

async function submitAttendance() {
  if (isSubmittingAttendance) return;

  const code = document.getElementById('attendance-code').value;
  if (!code || code.length !== 4) {
    showToast('Please enter a 4-digit code', 'error');
    return;
  }

  isSubmittingAttendance = true;
  const submitBtn = document.querySelector('#attendance-modal .btn-primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    submitBtn.style.opacity = '0.6';
  }

  try {
    await apiCall('event-attendance', 'POST', {
      eventId: currentAttendanceEventId,
      code
    });
    showToast('Attendance recorded!', 'success');
    closeAttendanceModal();
    await loadEventsData();
    await loadProfileData();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    isSubmittingAttendance = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      submitBtn.style.opacity = '';
    }
  }
}
