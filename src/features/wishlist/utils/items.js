// Item database for wishlist system
// All items categorized by type with their icon URLs

const WISHLIST_ITEMS = {
  archbossWeapons: [
    {
      id: 'bellandir_blade',
      name: "Queen Bellandir's Languishing Blade",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00034.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'deluzhnoa_edge',
      name: "Deluzhnoa's Edge of Eternal Frost",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00052.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'cordy_warblade',
      name: "Cordy's Warblade of Creeping Doom",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00052.webp',
      category: 'Greatsword'
    },
    {
      id: 'tevent_warblade',
      name: "Tevent's Warblade of Despair",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00036.webp',
      category: 'Greatsword'
    },
    {
      id: 'tevent_fangs',
      name: "Tevent's Fangs of Fury",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00035.webp',
      category: 'Daggers'
    },
    {
      id: 'deluzhnoa_razors',
      name: "Deluzhnoa's Permafrost Razors",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00052.webp',
      category: 'Daggers'
    },
    {
      id: 'tevent_arc',
      name: "Tevent's Arc of Wailing Death",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00018.webp',
      category: 'Bow'
    },
    {
      id: 'deluzhnoa_arc',
      name: "Deluzhnoa's Arc of Frozen Death",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00017.webp',
      category: 'Bow'
    },
    {
      id: 'bellandir_crossbow',
      name: "Queen Bellandir's Toxic Spine Throwers",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00033.webp',
      category: 'Crossbow'
    },
    {
      id: 'cordy_crossbow',
      name: "Cordy's Stormspore Spike Slingers",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00030.webp',
      category: 'Crossbow'
    },
    {
      id: 'tevent_wand',
      name: "Tevent's Grasp of Withering",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00011.webp',
      category: 'Wand'
    },
    {
      id: 'cordy_wand',
      name: "Cordy's Grasp of Manipulation",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00015.webp',
      category: 'Wand'
    },
    {
      id: 'bellandir_staff',
      name: "Queen Bellandir's Hivemind Staff",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00019.webp',
      category: 'Staff'
    },
    {
      id: 'deluzhnoa_staff',
      name: "Deluzhnoa's Ancient Petrified Staff",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00018A.webp',
      category: 'Staff'
    },
    {
      id: 'deluzhnoa_spear',
      name: "Deluzhnoa's Serrated Shard",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00026.webp',
      category: 'Spear'
    },
    {
      id: 'bellandir_spear',
      name: "Queen Bellandir's Serrated Spike",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00018.webp',
      category: 'Spear'
    },
    {
      id: 'tevent_orb',
      name: "Tevent's Omniscient Eye",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00014.webp',
      category: 'Orb'
    },
    {
      id: 'cordy_orb',
      name: "Cordy's Source of Contagion",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00019.webp',
      category: 'Orb'
    }
  ],

  archbossArmors: [
    {
      id: 'crimson_chestplate',
      name: 'Crimson Lotus Chestplate',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_TS_00019B.webp',
      type: 'Chest Armor'
    },
    {
      id: 'veiled_gloves',
      name: 'Veiled Concord Gloves',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_GL_00024.webp',
      type: 'Gloves'
    },
    {
      id: 'errant_brim',
      name: 'Errant Scion Brim',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_HM_00022A.webp',
      type: 'Helmet'
    },
    {
      id: 'umbral_pants',
      name: 'Umbral Astarch Pants',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_PT_00030.webp',
      type: 'Pants'
    },
    {
      id: 'blood_moon_cloak',
      name: 'Cloak of the Blood Moon',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_M_CA_00032.webp',
      type: 'Cloak'
    },
    {
      id: 'piercing_ice_cloak',
      name: 'Cloak of Piercing Ice',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_M_CA_00029.webp',
      type: 'Cloak'
    }
  ],

  t3Weapons: [
    {
      id: 'daigon_stormblade',
      name: "Daigon's Stormblade",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00017A.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'chernobog_blade',
      name: "Chernobog's Cauterizing Blade",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00033A.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'cornelius_blade',
      name: "Cornelius's Blade of Dancing Flame",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00008B.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'nirma_sword',
      name: "Nirma's Sword of Falling Ash",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00035A.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'ahzreil_sword',
      name: "Ahzreil's Soulless Sword",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword_00026B.webp',
      category: 'Sword & Shield'
    },
    {
      id: 'naru_greatblade',
      name: "Naru's Frenzied Greatblade",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00034.webp',
      category: 'Greatsword'
    },
    {
      id: 'morokai_greatblade',
      name: "Morokai's Soulfire Greatblade",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00027A.webp',
      category: 'Greatsword'
    },
    {
      id: 'adentus_greatsword',
      name: "Adentus's Cinderhulk Greatsword",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00028A.webp',
      category: 'Greatsword'
    },
    {
      id: 'junobote_blade',
      name: "Junobote's Blade of the Red Colossus",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Sword2h_00039A.webp',
      category: 'Greatsword'
    },
    {
      id: 'leviathan_tendrils',
      name: "Leviathan's Bladed Tendrils",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00051.webp',
      category: 'Daggers'
    },
    {
      id: 'kowazan_daggers',
      name: "Kowazan's Daggers of the Blood Moon",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00037A.webp',
      category: 'Daggers'
    },
    {
      id: 'minzerok_daggers',
      name: "Minzerok's Daggers of Flaying",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Dagger_00039A.webp',
      category: 'Daggers'
    },
    {
      id: 'leviathan_longbow',
      name: "Leviathan's Bloodstorm Longbow",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00051.webp',
      category: 'Bow'
    },
    {
      id: 'aelon_longbow',
      name: "Grand Aelon's Longbow of Blight",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Bow_00034A.webp',
      category: 'Bow'
    },
    {
      id: 'akman_crossbows',
      name: "Akman's Bloodletting Crossbows",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00031.webp',
      category: 'Crossbow'
    },
    {
      id: 'malakar_crossbows',
      name: "Malakar's Flamespike Crossbows",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00034A.webp',
      category: 'Crossbow'
    },
    {
      id: 'kowazan_crossbows',
      name: "Kowazan's Crossbows of the Eclipse",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Crossbow_00035A.webp',
      category: 'Crossbow'
    },
    {
      id: 'deckman_scepter',
      name: "Deckman's Balefire Scepter",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00003C.webp',
      category: 'Wand'
    },
    {
      id: 'excavator_scepter',
      name: "Excavator's Radiant Scepter",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Wand_00012A.webp',
      category: 'Wand'
    },
    {
      id: 'daigon_emberstaff',
      name: "Daigon's Charred Emberstaff",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_staff_00036.webp',
      category: 'Staff'
    },
    {
      id: 'talus_staff',
      name: "Talus's Incandescent Staff",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00032A.webp',
      category: 'Staff'
    },
    {
      id: 'aridus_voidstaff',
      name: "Aridus's Immolated Voidstaff",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Staff_00033A.webp',
      category: 'Staff'
    },
    {
      id: 'naru_spear',
      name: "Naru's Sawfang Spear",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00030.webp',
      category: 'Spear'
    },
    {
      id: 'junobote_ranseur',
      name: "Junobote's Extra Smoldering Ranseur",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Spear_00021A.webp',
      category: 'Spear'
    },
    {
      id: 'manticus_core',
      name: 'Manticus Fraternal Core',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00016.webp',
      category: 'Orb'
    },
    {
      id: 'talus_core',
      name: "Talus's Transcendent Core",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Weapon/IT_P_Orb_00009A.webp',
      category: 'Orb'
    }
  ],

  t3Armors: [
    {
      id: 'fallen_helmet',
      name: 'Fallen Dynasty Helmet',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_PL_M_HM_00018B.webp',
      type: 'Helmet'
    },
    {
      id: 'fallen_plate',
      name: 'Fallen Dynasty Plate Armor',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_PL_M_TS_00013A.webp',
      type: 'Chest Armor'
    },
    {
      id: 'fallen_legs',
      name: 'Fallen Dynasty Leg Plates',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_PT_00010B.webp',
      type: 'Pants'
    },
    {
      id: 'fallen_sabatons',
      name: 'Fallen Dynasty Sabatons',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_PL_M_BT_00017A.webp',
      type: 'Boots'
    },
    {
      id: 'blood_hood',
      name: 'Blood Hunter Hood',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_HM_05002A.webp',
      type: 'Helmet'
    },
    {
      id: 'blood_garb',
      name: 'Blood Hunter Garb',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Part_LE_M_TS_00018A.webp',
      type: 'Chest Armor'
    },
    {
      id: 'blood_guards',
      name: 'Blood Hunter Hand Guards',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_GL_00022C.webp',
      type: 'Gloves'
    },
    {
      id: 'blood_boots',
      name: 'Blood Hunter Boots',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_LE_M_BT_00015A.webp',
      type: 'Boots'
    },
    {
      id: 'twilight_pants',
      name: 'Twilight Embrace Pants',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_PT_00008C.webp',
      type: 'Pants'
    },
    {
      id: 'twilight_robes',
      name: 'Twilight Embrace Robes',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_TS_00005C.webp',
      type: 'Chest Armor'
    },
    {
      id: 'twilight_gloves',
      name: 'Twilight Embrace Gloves',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_GL_00001D.webp',
      type: 'Gloves'
    },
    {
      id: 'twilight_shoes',
      name: 'Twilight Embrace Shoes',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Armor/P_Set_FA_M_BT_00005C.webp',
      type: 'Boots'
    }
  ],

  t3Accessories: [
    {
      id: 'two_moons_earrings',
      name: 'Earrings of the Two Moons',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Earring_00027.webp',
      type: 'Earring'
    },
    {
      id: 'venelux_earrings',
      name: "Venelux Scholar's Earrings",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Earring_00028.webp',
      type: 'Earring'
    },
    {
      id: 'steadfast_belt',
      name: 'Belt of the Steadfast Pledge',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Belt_00055.webp',
      type: 'Belt'
    },
    {
      id: 'rustling_sash',
      name: 'Sash of Rustling Leaves',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Belt_00049.webp',
      type: 'Belt'
    },
    {
      id: 'unregretted_locket',
      name: 'Locket of Unregretted Sin',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Necklace_00054.webp',
      type: 'Necklace'
    },
    {
      id: 'cold_revenge_wristlet',
      name: 'Wristlet of Cold Revenge',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Bracelet_00051.webp',
      type: 'Bracelet'
    },
    {
      id: 'endless_breeze_bracelet',
      name: 'Endless Breeze Bracelet',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Bracelet_00049.webp',
      type: 'Bracelet'
    },
    {
      id: 'davinci_ring',
      name: "DaVinci's Signet Ring",
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Ring_00063.webp',
      type: 'Ring'
    },
    {
      id: 'brutal_agony_band',
      name: 'Band of Brutal Agony',
      icon: 'https://cdn.questlog.gg/throne-and-liberty/assets/Game/Image/Icon/Item_128/Equip/Acc/IT_P_Ring_00060.webp',
      type: 'Ring'
    }
  ]
};

// Helper function to get item by ID
function getItemById(itemId) {
  for (const category of Object.values(WISHLIST_ITEMS)) {
    const item = category.find(i => i.id === itemId);
    if (item) return item;
  }
  return null;
}

// Helper function to get all items in a category
function getItemsByCategory(categoryName) {
  return WISHLIST_ITEMS[categoryName] || [];
}

module.exports = {
  WISHLIST_ITEMS,
  getItemById,
  getItemsByCategory
};