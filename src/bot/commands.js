const { PermissionFlagsBits } = require('discord.js');

async function registerSlashCommands(client) {
  const ADMIN = PermissionFlagsBits.Administrator.toString();

  const commands = [
    // ----- Admin-only commands -----
    {
      name: 'excluderole',
      description: 'Admins: Exclude/include roles from tracking.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to do',
          required: true,
          choices: [
            { name: 'add (exclude role)', value: 'add' },
            { name: 'remove (include role)', value: 'remove' },
            { name: 'list (show excluded roles)', value: 'list' }
          ]
        },
        {
          type: 8, // ROLE
          name: 'role',
          description: 'Role to exclude/include',
          required: false
        }
      ]
    },
    {
      name: 'playerlist',
      description: 'Admins: View all players and their party info.',
      default_member_permissions: ADMIN
    },
    {
      name: 'partiespanel',
      description: 'Admins: Create a stylized parties panel in this channel.',
      default_member_permissions: ADMIN
    },
    {
      name: 'resetparties',
      description: 'Admins: Reset party system data (DANGEROUS!).',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to reset',
          required: true,
          choices: [
            { name: 'all (delete everything)', value: 'all' },
            { name: 'user (reset single user)', value: 'user' }
          ]
        },
        {
          type: 6, // USER
          name: 'target',
          description: 'User to reset (required if action is user)',
          required: false
        }
      ]
    },
    {
      name: 'remindparty',
      description: 'Admins: Send a DM to users who haven\'t set up their party info.',
      default_member_permissions: ADMIN
    },
    // NEW: Screenshot storage command
    {
      name: 'screenshot',
      description: 'Admins: Manage gear screenshot storage system.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'Action to perform',
          required: true,
          choices: [
            { name: 'Set Storage Channel', value: 'set_channel' },
            { name: 'Clean Old Storage', value: 'clean_storage' },
            { name: 'Storage Info', value: 'info' }
          ]
        },
        {
          type: 7, // CHANNEL
          name: 'channel',
          description: 'Channel to use for storage (for set_channel)',
          required: false
        },
        {
          type: 4, // INTEGER
          name: 'older_than_days',
          description: 'Delete screenshots older than X days (default: 90)',
          required: false,
          min_value: 1,
          max_value: 365
        },
        {
          type: 5, // BOOLEAN
          name: 'confirm',
          description: 'Confirm deletion (for clean_storage)',
          required: false
        }
      ]
    },
    // PvP Commands
    {
      name: 'pvpevent',
      description: 'Admins: Create a PvP event with attendance tracking.',
      default_member_permissions: ADMIN
    },
    {
      name: 'pvpcalendar',
      description: 'Admins: Create a PvP calendar showing upcoming events.',
      default_member_permissions: ADMIN
    },
    {
      name: 'resetbonuses',
      description: 'Admins: Reset all PvP bonuses (DANGEROUS!).',
      default_member_permissions: ADMIN
    },
    {
      name: 'itemroll',
      description: 'Admins: Create an item roll event where players can roll for loot.',
      default_member_permissions: ADMIN
    },
    // Raid Commands
    {
      name: 'createraid',
      description: 'Admins: Create a raid event with attendance tracking.',
      default_member_permissions: ADMIN
    },
    {
      name: 'deleteraid',
      description: 'Admins: Delete a raid event.',
      default_member_permissions: ADMIN
    },
    {
      name: 'closeraid',
      description: 'Admins: Close or reopen a raid event.',
      default_member_permissions: ADMIN
    },
    // Application System Commands
    {
      name: 'createapplication',
      description: 'Admins: Create a new application panel.',
      default_member_permissions: ADMIN
    },
    {
      name: 'deleteapplication',
      description: 'Admins: Delete an application panel.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'panel_id',
          description: 'The ID of the panel to delete',
          required: true
        }
      ]
    },
    {
      name: 'editapplication',
      description: 'Admins: Edit an existing application panel.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'panel_id',
          description: 'The ID of the panel to edit',
          required: true
        }
      ]
    },
    {
      name: 'applicationstats',
      description: 'Admins: View application statistics.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'panel_id',
          description: 'Specific panel ID (optional)',
          required: false
        }
      ]
    },
    {
      name: 'applicationhistory',
      description: 'Admins: View application history for a user.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User to check history for',
          required: true
        }
      ]
    },
    {
      name: 'blacklist',
      description: 'Admins: Manage application blacklist.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to do',
          required: true,
          choices: [
            { name: 'add', value: 'add' },
            { name: 'remove', value: 'remove' },
            { name: 'list', value: 'list' }
          ]
        },
        {
          type: 6, // USER
          name: 'user',
          description: 'User to add/remove from blacklist',
          required: false
        },
        {
          type: 3, // STRING
          name: 'reason',
          description: 'Reason for blacklisting',
          required: false
        }
      ]
    },
    {
      name: 'clearoldtickets',
      description: 'Admins: Clean up old closed application tickets.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 4, // INTEGER
          name: 'days',
          description: 'Delete tickets older than this many days (default: 30)',
          required: false,
          min_value: 1,
          max_value: 365
        }
      ]
    },
    // Gambling Commands (Admin)
    {
      name: 'givegamblingmoney',
      description: 'Admins: Grant gambling coins to a user.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User to give money to',
          required: true
        },
        {
          type: 4, // INTEGER
          name: 'amount',
          description: 'Amount of coins to give',
          required: true,
          min_value: 1,
          max_value: 1000000
        }
      ]
    },
    // Broadcast Commands (Admin)
    {
      name: 'startbroadcast',
      description: 'Admins: Start broadcasting selected users as an audio stream.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 7, // CHANNEL
          name: 'source_channel',
          description: 'Voice channel to monitor (leadership channel)',
          required: true,
          channel_types: [2] // Voice channel only
        }
      ]
    },
    {
      name: 'stopbroadcast',
      description: 'Admins: Stop active broadcast stream.',
      default_member_permissions: ADMIN
    },
    {
      name: 'addbroadcaster',
      description: 'Admins: Add user to broadcast list (their voice will be streamed).',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User whose voice should be broadcast',
          required: true
        }
      ]
    },
    {
      name: 'removebroadcaster',
      description: 'Admins: Remove user from broadcast list.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User to remove from broadcast',
          required: true
        }
      ]
    },
    {
      name: 'listbroadcasters',
      description: 'Admins: View all users being broadcast.',
      default_member_permissions: ADMIN
    },
    {
      name: 'broadcaststatus',
      description: 'Admins: View current broadcast status and stream URL.',
      default_member_permissions: ADMIN
    },
    // Wishlist Commands (Admin)
    {
      name: 'wishlists',
      description: 'Admins: Create an auto-updating wishlist panel in this channel.',
      default_member_permissions: ADMIN
    },
    {
      name: 'resetuserwishlist',
      description: 'Admins: Reset a specific user\'s wishlist.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User whose wishlist to reset',
          required: true
        }
      ]
    },
    {
      name: 'freezewishlists',
      description: 'Admins: Freeze or unfreeze wishlist submissions.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'Freeze or unfreeze wishlists',
          required: true,
          choices: [
            { name: 'ON (freeze wishlists)', value: 'on' },
            { name: 'OFF (unfreeze wishlists)', value: 'off' }
          ]
        }
      ]
    },
    {
      name: 'wishlistreminder',
      description: 'Admins: Send DM reminders to users without submitted wishlists.',
      default_member_permissions: ADMIN
    },
    {
      name: 'giveitem',
      description: 'Admins: Mark wishlisted items as given/distributed.',
      default_member_permissions: ADMIN
    },
    // Poll Commands
    {
      name: 'guildpoll',
      description: 'Admins: Create a guild-wide poll with voting options.',
      default_member_permissions: ADMIN
    },
    // AutoMod Commands
    {
      name: 'automod',
      description: 'Admins: Configure automatic moderation system.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 1, // SUB_COMMAND
          name: 'setup',
          description: 'Initial AutoMod setup'
        },
        {
          type: 1, // SUB_COMMAND
          name: 'toggle',
          description: 'Enable or disable AutoMod',
          options: [
            {
              type: 3, // STRING
              name: 'action',
              description: 'Enable or disable',
              required: true,
              choices: [
                { name: 'ON (Enable AutoMod)', value: 'on' },
                { name: 'OFF (Disable AutoMod)', value: 'off' }
              ]
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'channels',
          description: 'Manage monitored channels',
          options: [
            {
              type: 3, // STRING
              name: 'action',
              description: 'What to do',
              required: true,
              choices: [
                { name: 'add (monitor channel)', value: 'add' },
                { name: 'remove (stop monitoring)', value: 'remove' },
                { name: 'list (show monitored)', value: 'list' }
              ]
            },
            {
              type: 7, // CHANNEL
              name: 'channel',
              description: 'Channel to add/remove',
              required: false
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'exempt',
          description: 'Manage exempt roles',
          options: [
            {
              type: 3, // STRING
              name: 'action',
              description: 'What to do',
              required: true,
              choices: [
                { name: 'add (exempt role)', value: 'add' },
                { name: 'remove (unexempt role)', value: 'remove' },
                { name: 'list (show exempt)', value: 'list' }
              ]
            },
            {
              type: 8, // ROLE
              name: 'role',
              description: 'Role to add/remove',
              required: false
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'logchannel',
          description: 'Set channel for moderation logs',
          options: [
            {
              type: 7, // CHANNEL
              name: 'channel',
              description: 'Channel for logs',
              required: true
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'timeout',
          description: 'Set timeout duration',
          options: [
            {
              type: 4, // INTEGER
              name: 'minutes',
              description: 'Timeout duration in minutes (1-1440)',
              required: true,
              min_value: 1,
              max_value: 1440
            }
          ]
        },
        {
          type: 1, // SUB_COMMAND
          name: 'status',
          description: 'View AutoMod configuration'
        }
      ]
    },

    // ----- Everyone -----
    {
      name: 'myinfo',
      description: 'View and manage your party information.'
    },
    {
      name: 'viewparties',
      description: 'View all static parties.'
    },
    {
      name: 'guildroster',
      description: 'Admins: Create/update an auto-updating guild roster in this channel.',
      default_member_permissions: ADMIN
    },
    // Wishlist Commands (Everyone)
    {
      name: 'mywishlist',
      description: 'Setup and manage your item wishlist.'
    },
    // Gambling Commands (Everyone)
    {
      name: 'gamblingbalance',
      description: 'Check your or another user\'s gambling balance.',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User to check balance for (optional)',
          required: false
        }
      ]
    },
    {
      name: 'gamblingdaily',
      description: 'Claim your daily gambling reward (500 coins, +streak bonuses).'
    },
    {
      name: 'blackjack',
      description: 'Play blackjack and bet your gambling coins!',
      options: [
        {
          type: 4, // INTEGER
          name: 'bet',
          description: 'Amount to bet (10-5,000,000 coins)',
          required: true,
          min_value: 10,
          max_value: 5000000
        }
      ]
    },
    {
      name: 'coinflip',
      description: 'Flip a coin and bet on the outcome!',
      options: [
        {
          type: 4, // INTEGER
          name: 'bet',
          description: 'Amount to bet (10-5,000,000 coins)',
          required: true,
          min_value: 10,
          max_value: 5000000
        },
        {
          type: 3, // STRING
          name: 'choice',
          description: 'Heads or Tails?',
          required: true,
          choices: [
            { name: 'Heads 🦅', value: 'heads' },
            { name: 'Tails 🌊', value: 'tails' }
          ]
        }
      ]
    },
    {
      name: 'trivia',
      description: 'Answer trivia questions to earn coins! (50 per correct, 250 bonus for 10/10)'
    },
    {
      name: 'rob',
      description: 'Attempt to rob another user (8 hour cooldown, risky!)',
      options: [
        {
          type: 6, // USER
          name: 'target',
          description: 'User to rob',
          required: true
        }
      ]
    },
    {
      name: 'kill',
      description: 'Attempt to eliminate a user - winner takes ALL (12h cooldown, 50% chance)',
      options: [
        {
          type: 6, // USER
          name: 'target',
          description: 'User to eliminate',
          required: true
        }
      ]
    },
    {
      name: 'send',
      description: 'Send coins to another user',
      options: [
        {
          type: 6, // USER
          name: 'user',
          description: 'User to send coins to',
          required: true
        },
        {
          type: 4, // INTEGER
          name: 'amount',
          description: 'Amount of coins to send',
          required: true,
          min_value: 10,
          max_value: 5000000
        }
      ]
    },
    {
      name: 'leaderboard',
      description: 'View the server gambling leaderboard.',
      options: [
        {
          type: 3, // STRING
          name: 'type',
          description: 'Type of leaderboard to view',
          required: false,
          choices: [
            { name: '💰 Balance (Current Coins)', value: 'balance' },
            { name: '📈 Net Profit (Total Won - Lost)', value: 'profit' },
            { name: '✅ Total Winnings', value: 'wins' },
            { name: '🎰 Games Played', value: 'games' },
            { name: '💀 Most Kills', value: 'kills' },
            { name: '🗡️ Total Stolen (Kills)', value: 'stolen' }
          ]
        }
      ]
    }
  ];

  await client.application.commands.set(commands);
}

module.exports = { registerSlashCommands };