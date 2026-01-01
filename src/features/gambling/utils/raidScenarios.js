/**
 * Throne and Liberty Gambling Raid Scenarios
 * 10 interactive scenarios with 3-5 decision points each
 */

const RAID_SCENARIOS = [
  // Scenario 1: Talus Takedown
  {
    id: 'talus_takedown',
    title: 'TALUS TAKEDOWN',
    emoji: '🐉',
    intro: `Your raiding party has tracked the massive stone dragon Talus to his lair in the Crimson Mountains. The guild vault is running low, and Talus guards a fortune in Sollant and rare materials. Intelligence reports he's vulnerable during his feeding cycle - but only for a limited window. Your crew must act fast and smart to claim the treasure before other guilds arrive.`,
    steps: [
      {
        text: `You approach Talus's lair at dusk. The dragon is distracted, gnawing on a massive prey. Three paths present themselves:`,
        choices: [
          {
            label: 'Frontal Assault',
            emoji: '⚔️',
            result: `Your party charges in with weapons drawn! Talus roars in fury, tail sweeping across the rocks. Two raiders are knocked back but you press forward. The dragon's attention is fully on you now - for better or worse.`
          },
          {
            label: 'Morph & Sneak',
            emoji: '🦅',
            result: `You morph into small creatures and glide into the lair undetected. Talus continues his meal, unaware. You spot the treasure hoard glittering in the back of the cave. Perfect positioning achieved!`
          },
          {
            label: 'Wait for Weakness',
            emoji: '⏳',
            result: `You wait in the shadows as Talus finishes eating. Soon, the dragon's eyelids grow heavy. This is the moment! He's vulnerable but not fully asleep - timing will be critical.`
          }
        ]
      },
      {
        text: `You're inside the lair now. Talus shifts position, his massive form creating tremors. How do you reach the treasure?`,
        choices: [
          {
            label: 'Grappling Hook Rush',
            emoji: '🪝',
            result: `You fire grappling hooks to swing over Talus's body! The movement is risky but fast. One raider's hook snags on a scale - Talus stirs slightly but doesn't wake. You land near the hoard!`
          },
          {
            label: 'Slow Crawl',
            emoji: '🐌',
            result: `You crawl along the cave wall, inch by inch. It takes forever but you make zero noise. Talus's breathing remains steady. You're almost there... just a bit further...`
          },
          {
            label: 'Levitation Spell',
            emoji: '✨',
            result: `Your mage casts mass levitation! The party floats silently toward the treasure. But magical energy fills the air - Talus's eyes flicker. The spell is working but you've drawn attention!`
          }
        ]
      },
      {
        text: `You reach the treasure pile! Sollant, gems, enchanted gear - it's all here. But you hear voices outside - another guild! What's your exit strategy?`,
        choices: [
          {
            label: 'Grab Everything',
            emoji: '💎',
            result: `You stuff bags with as much loot as possible! The weight slows you down but the haul is MASSIVE. Talus's eyes snap open as coins clatter. He roars! You run, weighed down by riches!`
          },
          {
            label: 'Take Only Sollant',
            emoji: '💰',
            result: `You grab only the lightweight Sollant pouches - easy to carry, pure profit. You move swiftly and silently. Talus remains asleep. Smart play - you can escape quickly!`
          },
          {
            label: 'Set Trap for Guild',
            emoji: '🪤',
            result: `You rig the cave entrance with explosives before looting. The rival guild enters just as you slip out the back. BOOM! The explosion seals them in with an angry Talus. Genius move!`
          }
        ]
      },
      {
        text: `You're exiting the lair when Talus ROARS and takes flight! His shadow covers the mountainside. The rival guild is in pursuit from below. Final escape plan?`,
        choices: [
          {
            label: 'Glider Escape',
            emoji: '🦅',
            result: `You deploy gliders and leap off the cliff! Talus swoops after you but you split up, diving through canyons. The dragon can't track all of you. The rival guild watches helplessly from below!`
          },
          {
            label: 'Portal Scroll',
            emoji: '🌀',
            result: `Your mage unfurls an emergency portal scroll! Purple energy crackles as the gateway opens. You dive through just as Talus's claws slam the ground. You teleport directly to the guild hall!`
          },
          {
            label: 'Stand & Fight',
            emoji: '⚔️',
            result: `You turn and face Talus head-on! The dragon is surprised by your audacity. You coordinate perfectly - stuns, damage, heals - and actually manage to drive him back! Legendary!`
          }
        ]
      }
    ],
    outro: `The raid party returns to the guild hall, adrenaline pumping and treasure secured! Word spreads across the server of your daring Talus heist. One raider's luck shines brightest tonight - they get to keep the biggest prize!`
  },

  // Scenario 2: Castle Siege Chaos
  {
    id: 'castle_siege',
    title: 'CASTLE SIEGE CHAOS',
    emoji: '🏰',
    intro: `The enemy guild "Crimson Legion" controls Stonegard Castle and its treasure vault. Tonight is Siege Night - but your small squad isn't here for glory, you're here for GOLD. While the main armies clash at the gates, you'll infiltrate the vault during the chaos. The Legion expects a frontal assault, not thieves in the shadows. Time to exploit the mayhem.`,
    steps: [
      {
        text: `The siege begins! Catapults fire, armies clash at the gates. You need entry into the castle. Where do you enter?`,
        choices: [
          {
            label: 'Sewer Entrance',
            emoji: '🕳️',
            result: `You wade through disgusting sewage beneath the castle. It's gross but effective - no guards patrol down here. You emerge inside the castle walls, dripping but undetected. The vault is two floors up.`
          },
          {
            label: 'Scale the Walls',
            emoji: '🧗',
            result: `You use grappling hooks to scale the outer wall during the battle chaos. Arrows fly overhead but you're in the blind spot. One raider slips but catches themselves. You're in!`
          },
          {
            label: 'Disguise as Legion',
            emoji: '🎭',
            result: `You loot armor from fallen Legion soldiers and disguise yourselves! A passing guard gives you a nod - you blend perfectly. This gives you free passage... for now.`
          }
        ]
      },
      {
        text: `You're inside the castle. The vault is in the central keep, but guards are everywhere despite the siege. How do you bypass security?`,
        choices: [
          {
            label: 'Create Diversion',
            emoji: '💥',
            result: `You set fire to the armory! Guards rush to put it out, abandoning their posts. Alarms blare but everyone assumes it's siege damage. The vault hallway is clear!`
          },
          {
            label: 'Bribe a Guard',
            emoji: '💰',
            result: `You approach a nervous-looking guard and offer them 10,000 Sollant to "look the other way." They hesitate... then pocket the coin and walk off. Corruption works!`
          },
          {
            label: 'Stealth Takedowns',
            emoji: '🗡️',
            result: `You systematically take out guards one by one - silently, efficiently. You drag bodies into closets. No alarms, no witnesses. Professional work.`
          }
        ]
      },
      {
        text: `You reach the vault door! It's massive, enchanted, and locked. But the siege is causing magical interference. What's your approach?`,
        choices: [
          {
            label: 'Lockpick Expert',
            emoji: '🔓',
            result: `Your rogue steps forward with specialized tools. Click... click... CLICK! The enchanted lock disengages! They grin - "Still got it." The vault door swings open silently.`
          },
          {
            label: 'Explosive Entry',
            emoji: '💣',
            result: `You plant charges on the hinges and stand back. BOOM! The explosion echoes through the keep. The vault is open but now everyone knows you're here! Grab and go!`
          },
          {
            label: 'Wait for Siege Breach',
            emoji: '⏰',
            result: `You wait until the main gate falls to attackers. In the chaos, guards rush to defend - leaving the vault unguarded. You slip in during the confusion. Patience pays off!`
          }
        ]
      },
      {
        text: `The vault is open! Mountains of Sollant, weapons, resources. But you hear footsteps - Legion reinforcements incoming! How much do you take?`,
        choices: [
          {
            label: 'Fill Every Bag',
            emoji: '💎',
            result: `You grab EVERYTHING you can carry! Your inventory is maxed out. The weight is crushing but the value is insane. You'll be rich but mobility is compromised!`
          },
          {
            label: 'High-Value Only',
            emoji: '👑',
            result: `You grab only the most valuable items - rare gems, enchanted gear. You leave the bulk Sollant. Smart choices mean you stay mobile and fast!`
          },
          {
            label: 'Sabotage First',
            emoji: '🔥',
            result: `You plant bombs in the vault before looting! When Legion arrives, the vault explodes - destroying their economy. You grab what you can in the chaos. Maximum damage!`
          }
        ]
      },
      {
        text: `You're escaping through the castle as it falls to attackers. Three armies clash around you - complete chaos! Final escape route?`,
        choices: [
          {
            label: 'Join Attacking Army',
            emoji: '⚔️',
            result: `You blend in with the attacking forces and "victoriously" exit with them! No one questions the heavily loaded bags - everyone's looting. You vanish in the crowd outside!`
          },
          {
            label: 'Glide from Tower',
            emoji: '🦅',
            result: `You sprint to the highest tower and deploy gliders! You soar over the battlefield below, loot secured. The setting sun makes for a cinematic escape!`
          },
          {
            label: 'Stealth Exit',
            emoji: '🌙',
            result: `You morph into small animals and sneak through the chaos. No one notices a few rats and birds carrying tiny bags. You reassemble outside the combat zone. Flawless!`
          }
        ]
      }
    ],
    outro: `The siege ends with the castle changing hands, but your squad cares only about the overflowing bags of loot. Back at your guild hall, you divide the spoils - and one lucky raider gets the biggest share!`
  },

  // Scenario 3: Moonlight Heist
  {
    id: 'moonlight_heist',
    title: 'MOONLIGHT HEIST',
    emoji: '🌙',
    intro: `Stonegard's noble district is where the wealthy keep their fortunes. Lord Vexor's mansion is rumored to contain a small treasury - payment from corrupt trade deals. It's midnight, the streets are empty, and your crew has inside information: the guards change shifts at moonrise. You have a 30-minute window to rob a noble's estate. The night is yours.`,
    steps: [
      {
        text: `You approach Lord Vexor's mansion under the full moon. The estate is guarded but vulnerable. What's your entry point?`,
        choices: [
          {
            label: 'Front Gate Charm',
            emoji: '💋',
            result: `Your charismatic rogue sweet-talks the gate guard with promises of "later." The guard blushes and "forgets" to lock the gate. You slip through while they daydream!`
          },
          {
            label: 'Roof Access',
            emoji: '🏠',
            result: `You scale the neighboring building and leap across rooftops! You land on Vexor's roof tiles silently. The skylight is unlocked - amateurs! You're inside!`
          },
          {
            label: 'Servant Disguise',
            emoji: '👔',
            result: `You dress as noble servants and walk right through the trade entrance! A real servant gives you a weird look but says nothing. You're in the estate proper!`
          }
        ]
      },
      {
        text: `Inside the mansion, you hear voices - Lord Vexor is hosting a late dinner party! The treasury is in the east wing. How do you navigate?`,
        choices: [
          {
            label: 'Blend with Party',
            emoji: '🎭',
            result: `You grab champagne glasses and mingle with guests! Nobles are too drunk to notice unfamiliar faces. You laugh at bad jokes while slowly moving toward the east wing!`
          },
          {
            label: 'Servant Passages',
            emoji: '🚪',
            result: `You find hidden servant corridors! These secret passages let you move unseen. You navigate the maze-like halls, emerging exactly where you need to be!`
          },
          {
            label: 'Rooftop Route',
            emoji: '🌙',
            result: `You climb back onto the roof and move across the tiles. Through windows you see the party below. You reach the east wing from above and descend through a window!`
          }
        ]
      },
      {
        text: `You've located the treasury room! But there's a magical alarm ward on the door. Triggering it means guards instantly. What's your move?`,
        choices: [
          {
            label: 'Dispel Magic',
            emoji: '✨',
            result: `Your mage channels a dispel! The ward flickers... and dies. But the magical discharge creates a faint glow. You have seconds before someone investigates!`
          },
          {
            label: 'Trigger & Hide',
            emoji: '🚨',
            result: `You trigger the alarm then immediately hide in the room! Guards rush in, find nothing, and assume malfunction. They leave muttering about "old enchantments." Risky but it worked!`
          },
          {
            label: 'Pick the Lock',
            emoji: '🔓',
            result: `You carefully pick the physical lock WITHOUT touching the magical ward! It takes forever but you manage to open the door mechanically. The ward never activates!`
          }
        ]
      },
      {
        text: `The treasury is open! Sollant, jewelry, ledgers of corruption. But you hear footsteps - Vexor himself is coming to check his vault! Hide or confront?`,
        choices: [
          {
            label: 'Ambush Vexor',
            emoji: '🗡️',
            result: `You jump Vexor when he enters! He tries to scream but you gag him. You tie him up with expensive curtains. He glares furiously but can't stop you from looting!`
          },
          {
            label: 'Hide in Shadows',
            emoji: '👥',
            result: `You press against the walls in darkness! Vexor enters, checks his gold, and leaves - never seeing you. Your heart pounds but you're undiscovered!`
          },
          {
            label: 'Bluff as Guards',
            emoji: '🛡️',
            result: `You pretend to BE guards investigating the alarm! Vexor thanks you for "checking" and leaves. The man is an idiot. You return to looting immediately!`
          }
        ]
      },
      {
        text: `Bags loaded with Vexor's fortune, you need to exit before shift change. The moon is setting - time's almost up! Escape route?`,
        choices: [
          {
            label: 'Balcony Glide',
            emoji: '🦅',
            result: `You rush to the balcony and glide into the night! Moonlight catches your wings as you soar over Stonegard's rooftops. By the time the alarm is raised, you're gone!`
          },
          {
            label: 'Carriage Exit',
            emoji: '🐴',
            result: `You steal Vexor's personal carriage! The driver thinks you're nobles leaving the party. You ride out the front gate waving at guards. Absolutely brazen!`
          },
          {
            label: 'Sewer Escape',
            emoji: '🕳️',
            result: `You find a basement grate leading to sewers. You drop into the filth with your loot bags. Disgusting but effective - the trail ends at the estate!`
          }
        ]
      }
    ],
    outro: `Dawn breaks over Stonegard as Lord Vexor discovers his treasury ransacked. Your guild celebrates the heist of the century - and one raider's luck determines who gets the biggest cut of noble gold!`
  },

  // Scenario 4: Conflict Zone Ambush
  {
    id: 'conflict_zone',
    title: 'CONFLICT ZONE AMBUSH',
    emoji: '⚔️',
    intro: `The Wraith Wastes are in permanent Conflict mode - PvP death is guaranteed here. But that's exactly why merchant caravans hire heavy escorts to cross the zone. Your squad has intel on a Sollant transport moving through tonight. The convoy is strong but overconfident. You'll hit them hard, take the Sollant, and escape before reinforcements arrive. High risk, high reward.`,
    steps: [
      {
        text: `The caravan enters the Wastes at dusk. Twelve guards, three wagons of Sollant. Where do you spring the ambush?`,
        choices: [
          {
            label: 'Narrow Canyon',
            emoji: '🏔️',
            result: `You wait in the canyon chokepoint! The caravan is forced into single file. Perfect ambush position! You rain arrows from the cliffs. They can't maneuver!`
          },
          {
            label: 'Open Plains',
            emoji: '🌾',
            result: `You attack on flat ground - risky but allows retreat routes! The guards see you coming and form defensive positions. This will be a straight fight!`
          },
          {
            label: 'Bridge Collapse',
            emoji: '🌉',
            result: `You sabotage the bridge ahead of time! The lead wagon crosses then - CRACK - the bridge collapses! The convoy is split in half. Divide and conquer!`
          }
        ]
      },
      {
        text: `Combat erupts! The guards are well-trained and fighting back hard. How does your squad engage?`,
        choices: [
          {
            label: 'Focus Healers First',
            emoji: '💉',
            result: `You identify and burn down their healers immediately! Without support, the guards' health drops fast. Smart tactics! But they're rallying for a counter-attack!`
          },
          {
            label: 'Tank & Spank',
            emoji: '🛡️',
            result: `Your tank holds aggro while DPS melts them! It's working but your tank is taking heavy damage. The healer struggles to keep them up!`
          },
          {
            label: 'Hit & Run',
            emoji: '🏃',
            result: `You strike fast and retreat! The guards chase but you kite them perfectly. They're frustrated and making mistakes. Guerrilla tactics for the win!`
          }
        ]
      },
      {
        text: `You've downed half the guards! But you hear war horns - the caravan called for backup! A rival PvP guild is incoming. What now?`,
        choices: [
          {
            label: 'Grab & Run',
            emoji: '💨',
            result: `You break off combat and grab the Sollant wagons! The remaining guards can't stop you. You're moving before reinforcements arrive - barely!`
          },
          {
            label: 'Finish the Fight',
            emoji: '⚔️',
            result: `You commit to killing all the guards first! It's close but you wipe them just as the rival guild appears. Now you face fresh enemies while wounded!`
          },
          {
            label: 'Set Trap',
            emoji: '🪤',
            result: `You rig the wagons with explosives and retreat! When the rival guild arrives, they investigate the cargo - BOOM! You return to loot the wreckage!`
          }
        ]
      },
      {
        text: `Sollant secured, but the Conflict Zone is swarming with enemies now! Multiple guilds are converging on your position. Escape plan?`,
        choices: [
          {
            label: 'Morphed Stealth',
            emoji: '🦊',
            result: `You morph into wolves and foxes! Enemies run right past you searching for "raiders." You slip through their lines as wildlife. Brilliant!`
          },
          {
            label: 'Portal Scroll',
            emoji: '🌀',
            result: `You activate emergency portal scrolls! The rival guild sees the portal forming and charges - but you jump through just in time! Clean escape!`
          },
          {
            label: 'Fight Through',
            emoji: '⚔️',
            result: `You decide to fight your way out! It's chaos - you take damage but keep moving. Your healer is clutch, keeping everyone alive. You break through the enemy lines!`
          }
        ]
      }
    ],
    outro: `You exit the Conflict Zone battered but victorious, wagons full of stolen Sollant! Word spreads of your daring ambush. The caravan company posts bounties on your heads - but you're already celebrating. One raider gets the lion's share of the loot!`
  },

  // Scenario 5: Glider Infiltration
  {
    id: 'glider_infiltration',
    title: 'GLIDER INFILTRATION',
    emoji: '🦅',
    intro: `The Skyreach Fortress floats above the clouds, home to an ancient order of mages who hoard magical artifacts. Ground access is impossible - the only way in is from above. Your squad has stolen military-grade gliders and plans to literally drop into the fortress during a lightning storm. The mages trust their altitude for security. Time to prove them wrong.`,
    steps: [
      {
        text: `You launch from the mountain peak at dawn. Storm clouds swirl around Skyreach. How do you approach?`,
        choices: [
          {
            label: 'Storm Cover',
            emoji: '⛈️',
            result: `You fly directly through the storm! Lightning cracks around you - terrifying but you're invisible to lookouts. You emerge from the clouds right above the fortress!`
          },
          {
            label: 'Wide Circle',
            emoji: '🔄',
            result: `You circle around to approach from the blind side. It takes longer but you avoid detection. You glide in from the sunset - guards are looking the other way!`
          },
          {
            label: 'Speed Dive',
            emoji: '💨',
            result: `You fold wings and dive at terminal velocity! The rush is insane. You pull up at the last second and crash-land on the fortress roof. Rough but FAST!`
          }
        ]
      },
      {
        text: `You're on the fortress roof! Below, mages patrol the courtyards. The artifact vault is in the central tower. How do you descend?`,
        choices: [
          {
            label: 'Rappel Down',
            emoji: '🪢',
            result: `You secure ropes and rappel down the tower wall! Your movements are controlled and silent. You reach a window and peer inside - the vault level!`
          },
          {
            label: 'Morph & Fly',
            emoji: '🦅',
            result: `You morph into birds and fly down through the open-air courtyard! Mages see birds and ignore them. You land in a quiet corner and shift back to human form!`
          },
          {
            label: 'Ventilation Shaft',
            emoji: '🌬️',
            result: `You find air vents and climb inside! The metal shafts echo your movements but no one's listening. You crawl through the fortress interior like rats!`
          }
        ]
      },
      {
        text: `You've reached the artifact vault floor! But it's protected by an arcane barrier that vaporizes intruders. How do you bypass it?`,
        choices: [
          {
            label: 'Stolen Mage Robes',
            emoji: '🧙',
            result: `You don mage robes stolen from laundry! The barrier scans you and... accepts the disguise! You walk right through. The robes even have pockets!`
          },
          {
            label: 'Counterspell',
            emoji: '✨',
            result: `Your mage channels a powerful counterspell! The barrier flickers and creates a brief gap. You dive through before it re-energizes! Risky but successful!`
          },
          {
            label: 'Dimensional Slip',
            emoji: '🌀',
            result: `You use a rare dimensional scroll to phase through the barrier! For a moment you exist between planes. The barrier can't detect you. Expensive but effective!`
          }
        ]
      },
      {
        text: `The vault is full of artifacts - staffs, tomes, enchanted jewelry! But you trigger a silent alarm by accident. Mages are coming! What do you take?`,
        choices: [
          {
            label: 'Legendary Staff',
            emoji: '🪄',
            result: `You grab the Legendary Staff of Storms! It's powerful but HUGE - hard to carry. The staff crackles with energy. This single item is worth a fortune!`
          },
          {
            label: 'Enchanted Rings',
            emoji: '💍',
            result: `You grab every enchanted ring you can fit! Small, portable, valuable. You pocket dozens of them. Smart choice for a quick escape!`
          },
          {
            label: 'Ancient Tome',
            emoji: '📖',
            result: `You take the Tome of Forbidden Magic! The knowledge inside is priceless. The book is heavy but your mage insists it's worth more than gold!`
          }
        ]
      },
      {
        text: `Mages flood the hallway! Combat spells light up the corridor. You need to reach the roof for extraction! How do you escape?`,
        choices: [
          {
            label: 'Fight Through',
            emoji: '⚔️',
            result: `You battle your way out! Swords clash with magic shields. Your tank holds the line while you retreat up the stairs. Wounded but moving!`
          },
          {
            label: 'Smoke Bomb',
            emoji: '💨',
            result: `You deploy smoke bombs and vanish into the haze! The mages cast blindly. You sprint through the confusion and reach the stairwell!`
          },
          {
            label: 'Levitation Spell',
            emoji: '✨',
            result: `Your mage casts mass levitation and you float straight up through the tower! The mages watch in shock as you rise through multiple floors!`
          }
        ]
      }
    ],
    outro: `You burst onto the fortress roof, deploy gliders, and leap into the sky! The mages fire spells but you're already diving into cloud cover. You glide back to solid ground, artifacts secured. One raider's luck determines who gets the best loot!`
  },

  // Scenario 6: Sollant Smuggling
  {
    id: 'sollant_smuggling',
    title: 'SOLLANT SMUGGLING',
    emoji: '💎',
    intro: `A merchant caravan is transporting 500,000 Sollant from Stonegard to Vienta through the Forest of Shadows. Your informant says the cargo manifest is fake - it's actually a black market smuggling operation for a corrupt noble. Which means no official protection. Your squad plans to intercept the caravan, take the Sollant, and vanish before anyone realizes what happened. It's not stealing if they were criminals too, right?`,
    steps: [
      {
        text: `The caravan enters the Forest of Shadows at noon. Sunlight barely penetrates the canopy. Where do you set up the ambush?`,
        choices: [
          {
            label: 'Fallen Tree Blockade',
            emoji: '🌲',
            result: `You drag a massive tree across the road! The caravan stops, drivers confused. Perfect moment to strike - they're sitting ducks!`
          },
          {
            label: 'Bridge Toll "Scam"',
            emoji: '🌉',
            result: `You dress as fake toll collectors! The caravan actually PAYS you first, then you rob them anyway. Double profit! They realize too late!`
          },
          {
            label: 'False Bandit Attack',
            emoji: '🎭',
            result: `You stage a fake bandit attack from the left! While guards defend that side, you steal the cargo from the right. Classic misdirection!`
          }
        ]
      },
      {
        text: `The guards realize it's a robbery! They're fighting back. But one guard looks nervous - possibly an insider. What's your play?`,
        choices: [
          {
            label: 'Intimidate All',
            emoji: '😈',
            result: `You go full aggressive on everyone! The guards see you mean business and several drop weapons. The nervous one runs entirely. Intimidation successful!`
          },
          {
            label: 'Bribe the Insider',
            emoji: '💰',
            result: `You pull the nervous guard aside and offer him a cut! He tells you the cargo is in wagon #2 and which guards are the most dangerous. Insider trading!`
          },
          {
            label: 'Target Leaders',
            emoji: '🎯',
            result: `You identify and take down the captain and sergeants! With leadership gone, the regular guards panic and scatter. Decapitation strategy works!`
          }
        ]
      },
      {
        text: `You've secured the Sollant wagon! But you hear hoofbeats - reinforcements are coming from Stonegard! How do you move the cargo?`,
        choices: [
          {
            label: 'Take Original Wagon',
            emoji: '🐴',
            result: `You hijack the cargo wagon with its horses! It's slow but you have ALL the Sollant. You whip the horses into a gallop down a side trail!`
          },
          {
            label: 'Transfer to Packs',
            emoji: '🎒',
            result: `You quickly transfer Sollant into portable packs! You abandon the wagon and split up into the forest. Harder to track six individuals than one wagon!`
          },
          {
            label: 'Hide & Wait',
            emoji: '🌳',
            result: `You hide the wagon in thick underbrush and camouflage it! Reinforcements rush past your position. When they're gone, you calmly drive away!`
          }
        ]
      },
      {
        text: `You're deep in the forest now, Sollant secured. But the Forest of Shadows has ACTUAL dangers - you hear growling. Forest beasts! Deal with them or avoid?`,
        choices: [
          {
            label: 'Fight the Beasts',
            emoji: '🐺',
            result: `You stand your ground and fight! Your party makes quick work of the forest predators. You even loot some beast materials - bonus profit!`
          },
          {
            label: 'Tame & Ride',
            emoji: '🦌',
            result: `Your ranger tames a few beasts! You actually RIDE them out of the forest. The creatures know secret paths. Unexpected ally!`
          },
          {
            label: 'Morph & Hide',
            emoji: '🦊',
            result: `You morph into forest creatures yourselves! The beasts ignore you as fellow wildlife. You slip past their territory completely unharmed!`
          }
        ]
      }
    ],
    outro: `You emerge from the Forest of Shadows with the smuggled Sollant, leaving the corrupt merchant and their hired guards empty-handed! The noble who ordered the shipment can't report it stolen without admitting to smuggling. Perfect crime! One raider takes home the biggest cut!`
  },

  // Scenario 7: Guild Vault Raid
  {
    id: 'guild_vault',
    title: 'GUILD VAULT RAID',
    emoji: '👑',
    intro: `You're members of "Crimson Raiders" guild, but there's a problem - your guild leader has been hoarding loot and not distributing it fairly. The vault is full while members struggle. Tonight, several of you have decided to "liberate" what you're owed. It's technically your own guild vault... but the leader doesn't see it that way. This is mutiny, betrayal, and the biggest heist you'll ever pull. Your guildmates sleep soundly, trusting you. Time to break that trust.`,
    steps: [
      {
        text: `It's 2 AM. The guild hall is quiet. You need access to the vault room. How do you get there?`,
        choices: [
          {
            label: 'Stolen Officer Key',
            emoji: '🔑',
            result: `You pickpocketed an officer's key earlier! It unlocks the restricted wing. You slip through silently. Your hands shake - this is actual betrayal!`
          },
          {
            label: 'Ventilation Crawl',
            emoji: '🌬️',
            result: `You crawl through air vents like a spy movie! It's cramped and dusty but you avoid all cameras and guards. You drop into the vault hallway!`
          },
          {
            label: 'Bribe Night Guard',
            emoji: '💰',
            result: `You approach the night guard with a bag of personal Sollant. They hesitate... then take it. "I saw nothing," they mutter. Corruption exists everywhere!`
          }
        ]
      },
      {
        text: `You reach the vault! Your guild leader's personal treasure hoard is behind this door. But it has the GUILD MASTER lock - only they can open it. What's your plan?`,
        choices: [
          {
            label: 'Bypass Mechanism',
            emoji: '🔧',
            result: `You studied the vault mechanism for weeks! You manually override the locking pins. It takes 20 minutes of careful work but - CLICK - it opens! Genius!`
          },
          {
            label: 'Explosives',
            emoji: '💣',
            result: `You plant small charges on the door hinges! BOOM - quiet but effective explosion. The door swings open... and an alarm starts blaring! You have minutes!`
          },
          {
            label: 'Copied Biometrics',
            emoji: '👁️',
            result: `You secretly scanned the guild leader's fingerprints and retina! You use fake biometrics. The vault THINKS the leader is here. It opens!`
          }
        ]
      },
      {
        text: `The vault is open! Inside: millions of Sollant, rare gear, materials that should've been distributed. But one of your co-conspirators gets greedy and wants ALL of it. Civil war in your squad?`,
        choices: [
          {
            label: 'Stick to Plan',
            emoji: '🤝',
            result: `You convince them to stick to the fair split plan! Everyone gets their share. You're thieves but not monsters. Honor among traitors!`
          },
          {
            label: 'Knock Them Out',
            emoji: '👊',
            result: `The greedy one tries to take control - you punch them unconscious! They'll wake up later with nothing. You can't trust someone who betrays the betrayers!`
          },
          {
            label: 'Let Them Take It',
            emoji: '🎭',
            result: `You let them think they won... then follow them and steal it back later! They take the risk of carrying the loot, you take the reward. Brilliant!`
          }
        ]
      },
      {
        text: `Loot secured, but you hear footsteps - the guild leader woke up! They're coming to check the vault. Do you confront or hide?`,
        choices: [
          {
            label: 'Confront Leader',
            emoji: '⚔️',
            result: `You face them directly! You list every grievance, every unfair distribution. They're shocked and furious. You fight your own guild leader and win!`
          },
          {
            label: 'Hide & Ambush',
            emoji: '🗡️',
            result: `You hide behind vault shelves! When the leader enters and sees the empty vault, you knock them out from behind. They never see who did it!`
          },
          {
            label: 'Frame Someone Else',
            emoji: '🎭',
            result: `You plant evidence pointing to a different guild member! The leader will think THEY did it. You watch the chaos unfold from hiding!`
          }
        ]
      },
      {
        text: `The guild hall is waking up - alarms blaring! You need to escape with the loot before the whole guild catches you. Exit strategy?`,
        choices: [
          {
            label: 'Portal Scroll',
            emoji: '🌀',
            result: `You activate emergency portals! Purple energy engulfs you as the guild rushes in. You vanish before they can act. Clean getaway!`
          },
          {
            label: 'Bluff as Defenders',
            emoji: '🛡️',
            result: `You claim you were DEFENDING the vault from intruders! The guild believes you in the chaos. You "secure" the loot as evidence and leave with it!`
          },
          {
            label: 'Fight Out',
            emoji: '⚔️',
            result: `You fight your former guildmates! It's brutal and emotional but you break through. You'll never return - bridges burned, loot secured!`
          }
        ]
      }
    ],
    outro: `You escape the guild hall as former members shout your names in anger. You've betrayed your guild, stolen their vault, and burned every bridge. But you're also rich beyond measure. One raider gets the biggest share of the stolen fortune. New guild, new life!`
  },

  // Scenario 8: Dimensional Dungeon Dash
  {
    id: 'dimensional_dungeon',
    title: 'DIMENSIONAL DUNGEON DASH',
    emoji: '🗡️',
    intro: `The Forgotten Crypt is a cursed dimensional dungeon that appears only during lunar eclipses. Inside, time moves differently and the dead walk. But the crypt also contains treasures from a thousand years ago - Sollant from an ancient empire. Your squad has exactly 30 real-time minutes before the eclipse ends and the dungeon vanishes. If you're inside when it closes, you're trapped forever. Speed run this death trap or lose everything.`,
    steps: [
      {
        text: `The eclipse begins! The dungeon entrance materializes in reality. You rush inside - the walls are crawling with dark energy. First chamber: three paths. Which way?`,
        choices: [
          {
            label: 'Left - Trapped Path',
            emoji: '🪤',
            result: `You choose left and immediately trigger spike traps! Your tank blocks them with their shield. Dangerous but you can see treasure ahead through the spikes!`
          },
          {
            label: 'Center - Undead Horde',
            emoji: '💀',
            result: `You charge center into a room of zombies! Combat begins instantly. Your AoE specialist goes wild - corpses explode everywhere! Fighting through!`
          },
          {
            label: 'Right - Puzzle Door',
            emoji: '🧩',
            result: `You take right and find an ancient puzzle! Your scholar quickly solves it. The door opens to a shortcut! Smart choice saves time!`
          }
        ]
      },
      {
        text: `Deeper in the crypt, you find a room with three treasure chests. But the dungeon is unstable - you only have time for ONE chest. Which do you open?`,
        choices: [
          {
            label: 'Golden Chest',
            emoji: '👑',
            result: `You open the golden chest! Inside: enchanted weapons and armor. High value but heavy! Your movement speed drops but the gear is incredible!`
          },
          {
            label: 'Silver Chest',
            emoji: '💰',
            result: `You open silver! It's full of pure Sollant coins. Lightweight and liquid - perfect for a speed run! You pocket the coins and keep moving!`
          },
          {
            label: 'Black Chest',
            emoji: '🎲',
            result: `You open the cursed black chest! It contains either massive treasure or a powerful curse. The lock clicks open... it's TREASURE! Risky but it paid off!`
          }
        ]
      },
      {
        text: `15 minutes left! You reach the main vault - but it's guarded by a Lich! An undead sorcerer of immense power. Fight or bypass?`,
        choices: [
          {
            label: 'Full Combat',
            emoji: '⚔️',
            result: `You engage the Lich in combat! Dark magic flies everywhere. Your healer works overtime. It's close but you defeat the ancient evil! The vault is yours!`
          },
          {
            label: 'Stealth Past',
            emoji: '🌙',
            result: `You use the dungeon's darkness to sneak around the Lich! It's channeling a spell and doesn't notice. You slip into the vault silently!`
          },
          {
            label: 'Banish Ritual',
            emoji: '✨',
            result: `Your mage performs a banishment ritual! The Lich screams as it's pulled into another dimension. Quick thinking! The vault door swings open!`
          }
        ]
      },
      {
        text: `The vault is full of ancient Sollant and relics! But the dungeon is COLLAPSING - 5 minutes until it vanishes! How much do you take?`,
        choices: [
          {
            label: 'Everything Possible',
            emoji: '💎',
            result: `You grab EVERYTHING! Your bags are overflowing. You're slow but rich! Running for the exit with maximum loot!`
          },
          {
            label: 'Valuable Only',
            emoji: '👑',
            result: `You grab only the most valuable items! Relics and rare Sollant. You leave the bulk behind. Smart choices keep you mobile!`
          },
          {
            label: 'One Big Item',
            emoji: '🏺',
            result: `You spot an Ancient Relic worth more than everything else combined! You grab ONLY that. Minimal weight, maximum value!`
          }
        ]
      },
      {
        text: `2 minutes left! You're running back through the dungeon but walls are phasing in and out of reality. The exit is ahead but unstable! Final sprint?`,
        choices: [
          {
            label: 'Full Sprint',
            emoji: '💨',
            result: `You drop everything not essential and RUN! You reach the exit with 10 seconds to spare! You collapse outside as the dungeon vanishes behind you!`
          },
          {
            label: 'Portal Scroll',
            emoji: '🌀',
            result: `You activate a portal scroll! Reality tears open. You dive through as the dungeon collapses! The portal closes - you made it by seconds!`
          },
          {
            label: 'Ghost Morph',
            emoji: '👻',
            result: `You morph into ghost form and phase through the collapsing walls! You literally walk through the destruction. You rematerialize outside safely!`
          }
        ]
      }
    ],
    outro: `The lunar eclipse ends and the Forgotten Crypt vanishes from reality for another cycle. Your squad made it out alive with ancient treasures! One raider's incredible luck means they get the biggest share of the dimensional loot!`
  },

  // Scenario 9: Archboss Assassination
  {
    id: 'archboss_assassination',
    title: 'ARCHBOSS ASSASSINATION',
    emoji: '🏹',
    intro: `Kowazan the Flame Drake spawns tonight in the Volcanic Highlands - a world boss worth millions in materials. But three major guilds are already camping the spawn point, ready to clash. Your small squad can't compete in a guild war... but you CAN snipe the boss at the last second and steal the kill. It's called "griefing" by some, "smart play" by others. You're about to become the most hated and richest squad on the server.`,
    steps: [
      {
        text: `You arrive at the Volcanic Highlands. Three guilds (80+ players) are already in position around the spawn point. How do you set up?`,
        choices: [
          {
            label: 'High Ground Snipe',
            emoji: '🏔️',
            result: `You climb to the highest cliff overlooking the arena! Perfect sniper position. The guilds below are focused on each other - no one looks up!`
          },
          {
            label: 'Morph & Hide',
            emoji: '🦅',
            result: `You morph into birds and perch on nearby rocks! The guilds completely ignore wildlife. You're invisible in plain sight!`
          },
          {
            label: 'Join Fake Guild',
            emoji: '🎭',
            result: `You infiltrate one of the guilds pretending to be new members! They accept you for numbers. You're literally inside the enemy!`
          }
        ]
      },
      {
        text: `Kowazan spawns! The drake roars and three-way guild combat erupts! Chaos everywhere - heals flying, AOEs exploding. When do you strike?`,
        choices: [
          {
            label: 'Wait for 10% HP',
            emoji: '⏰',
            result: `You wait patiently as guilds burn the boss down! At 10% HP you strike - perfect timing! The boss is almost dead and guilds are exhausted!`
          },
          {
            label: 'Snipe Early',
            emoji: '🎯',
            result: `You start damage EARLY! You build up DPS while guilds fight each other. Risky but when the boss dies, YOUR damage secured the kill!`
          },
          {
            label: 'Last Second Burst',
            emoji: '💥',
            result: `You wait until 1% HP then unleash EVERYTHING! Your burst combo is perfectly timed. The boss dies to YOUR damage! Calculated!`
          }
        ]
      },
      {
        text: `YOU GOT THE KILL! Kowazan drops legendary loot! But all three guilds just realized what happened. They're turning on YOU! What's your move?`,
        choices: [
          {
            label: 'Grab & Portal',
            emoji: '🌀',
            result: `You grab the loot and activate emergency portals! Angry players charge but you vanish in purple light! They scream in global chat!`
          },
          {
            label: 'Stealth Vanish',
            emoji: '🌙',
            result: `You go invisible and morph! The guilds search frantically but you're a bird flying away with loot in your talons! They'll never catch you!`
          },
          {
            label: 'Decoy & Run',
            emoji: '🎭',
            result: `You throw a decoy spell that looks like you running one way! Everyone chases it. You calmly walk the OTHER direction with the loot!`
          }
        ]
      },
      {
        text: `You escaped with Kowazan's loot! But global chat is EXPLODING - bounties posted, your names everywhere. How do you lay low?`,
        choices: [
          {
            label: 'Change Appearances',
            emoji: '🎭',
            result: `You use appearance change scrolls! New hair, new faces. You walk through town and no one recognizes you! Disguise master!`
          },
          {
            label: 'Hide in Remote Zone',
            emoji: '🏔️',
            result: `You flee to a remote corner of the map! You set up camp in the wilderness. They'll never search this far out!`
          },
          {
            label: 'Bribe Silence',
            emoji: '💰',
            result: `You pay off influential players to not reveal your location! Corruption works. They take the money and spread false information!`
          }
        ]
      }
    ],
    outro: `You successfully sniped one of the rarest world bosses on the server! Three major guilds are furious but you have the loot. Your names are infamous. The materials sell for millions of Sollant! One lucky squad member gets the biggest cut!`
  },

  // Scenario 10: Peace Zone Heist
  {
    id: 'peace_zone_heist',
    title: 'PEACE ZONE HEIST',
    emoji: '🕊️',
    intro: `Stonegard Market District is a Peace Zone - PvP is disabled and guards instantly execute anyone who breaks the law. It's the safest place in the game... which makes it the perfect target. Merchants store massive amounts of Sollant in "secure" warehouses, trusting the Peace Zone to protect them. But you've found a loophole: if you steal WITHOUT attacking players, the peace status remains. Tonight, you'll rob the central warehouse without firing a single shot.`,
    steps: [
      {
        text: `The market district bustles with players trading. The warehouse is in the center, guarded but not expecting thieves. How do you get inside?`,
        choices: [
          {
            label: 'Fake Merchant ID',
            emoji: '📜',
            result: `You forge merchant credentials! The warehouse guard scans your papers and waves you through. You're literally walking in the front door!`
          },
          {
            label: 'Sewer Access',
            emoji: '🕳️',
            result: `You enter through the sewers beneath the warehouse! It's disgusting but effective. You emerge in the storage basement undetected!`
          },
          {
            label: 'Morph & Infiltrate',
            emoji: '🐀',
            result: `You morph into rats and scurry through cracks in the wall! Guards don't even notice rodents. You're inside the warehouse!`
          }
        ]
      },
      {
        text: `Inside, you see mountains of trade goods and Sollant! But there are merchant NPCs working here. They'll report you if they see theft. What's your approach?`,
        choices: [
          {
            label: 'Distract with Fire',
            emoji: '🔥',
            result: `You set a small fire in the corner! NPCs panic and evacuate. No one's watching the Sollant now! You have the warehouse to yourself!`
          },
          {
            label: 'Bribe NPCs',
            emoji: '💰',
            result: `You offer NPCs personal cuts! They're programmed to be greedy. They accept and "didn't see anything." Corruption in code form!`
          },
          {
            label: 'Night Shift Wait',
            emoji: '🌙',
            result: `You hide and wait for night shift change! During the transition, the warehouse is empty for 5 minutes. You move during the gap!`
          }
        ]
      },
      {
        text: `You're loading Sollant into bags when you hear footsteps - a PLAYER merchant is coming to check inventory! If they see you, they'll report it. What do you do?`,
        choices: [
          {
            label: 'Hide in Crates',
            emoji: '📦',
            result: `You dive into shipping crates! The merchant walks past your hiding spot. Your heart pounds but they don't check inside. Stealth successful!`
          },
          {
            label: 'Pretend to Work',
            emoji: '🧹',
            result: `You grab a broom and pretend to be cleaning! The merchant nods at you - just another worker. They check their inventory and leave!`
          },
          {
            label: 'Bribe the Player',
            emoji: '💎',
            result: `You offer them a cut of the heist! They're shocked but... actually interested. They help you load cargo! Honor among thieves!`
          }
        ]
      },
      {
        text: `Bags full, you need to exit without triggering alarms. The front door is watched. How do you get the Sollant out?`,
        choices: [
          {
            label: 'Delivery Cart',
            emoji: '🛒',
            result: `You load Sollant into a merchant delivery cart! You wheel it right out the front door. Guards think it's legitimate cargo. Bold!`
          },
          {
            label: 'Sewer Return',
            emoji: '🕳️',
            result: `You haul bags back through the sewers! It's exhausting but safe. You emerge outside the Peace Zone with the loot!`
          },
          {
            label: 'Portal Inside',
            emoji: '🌀',
            result: `You activate a portal INSIDE the warehouse! Guards run in but you're already stepping through with the Sollant. Clean escape!`
          }
        ]
      },
      {
        text: `You're outside the Peace Zone with the stolen Sollant! But merchant guild members are posting bounties in global chat. How do you cover your tracks?`,
        choices: [
          {
            label: 'Frame Another Guild',
            emoji: '🎭',
            result: `You plant evidence pointing to a rival guild! Merchant guild declares war on THEM. You watch the chaos while counting your money!`
          },
          {
            label: 'Launder Through Auction',
            emoji: '🏛️',
            result: `You sell the Sollant through auction house using alt accounts! The money is clean and untraceable. Money laundering success!`
          },
          {
            label: 'Split & Hide',
            emoji: '🌍',
            result: `You split the Sollant and each hide in different zones! They can't track all of you. You'll reunite later to divide the spoils!`
          }
        ]
      }
    ],
    outro: `You pulled off the impossible - a heist in a Peace Zone without breaking any combat rules! The merchant guild is furious but can't prove anything. Your squad celebrates the perfect crime. One raider gets the lion's share of the stolen Sollant!`
  }
];

/**
 * Get a random scenario
 */
function getRandomScenario() {
  return RAID_SCENARIOS[Math.floor(Math.random() * RAID_SCENARIOS.length)];
}

/**
 * Get scenario by ID
 */
function getScenarioById(scenarioId) {
  return RAID_SCENARIOS.find(s => s.id === scenarioId);
}

module.exports = {
  RAID_SCENARIOS,
  getRandomScenario,
  getScenarioById
};