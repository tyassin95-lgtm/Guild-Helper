const { PermissionFlagsBits } = require('discord.js');

async function registerSlashCommands(client) {
  const ADMIN = PermissionFlagsBits.Administrator.toString();

  const commands = [
    // ----- Admin-only commands -----
    {
      name: 'createpanel',
      description: 'Create a wishlist panel in this channel.',
      default_member_permissions: ADMIN
    },
    {
      name: 'summary',
      description: 'Admins: View a boss-by-boss summary of finalized wishlists.',
      default_member_permissions: ADMIN
    },
    {
      name: 'summarylive',
      description: 'Admins: Create or clear a live-updating summary panel in this channel.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to do',
          required: true,
          choices: [
            { name: 'set (create/update here)', value: 'set' },
            { name: 'clear', value: 'clear' }
          ]
        }
      ]
    },
    {
      name: 'stats',
      description: 'Admins: View wishlist statistics and popularity data.',
      default_member_permissions: ADMIN
    },
    {
      name: 'granttokens',
      description: 'Admins: Grant extra tokens to a user.',
      default_member_permissions: ADMIN,
      options: [
        { type: 6, name: 'user', description: 'User to grant tokens to', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to grant', required: true, // STRING
          choices: [
            { name: 'weapon', value: 'weapon' },
            { name: 'armor', value: 'armor' },
            { name: 'accessory', value: 'accessory' }
          ]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to grant', required: true } // INTEGER
      ]
    },
    {
      name: 'removetokens',
      description: 'Admins: Remove token grants from a user.',
      default_member_permissions: ADMIN,
      options: [
        { type: 6, name: 'user', description: 'User to remove tokens from', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to remove', required: true, // STRING
          choices: [
            { name: 'weapon', value: 'weapon' },
            { name: 'armor', value: 'armor' },
            { name: 'accessory', value: 'accessory' }
          ]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to remove', required: true } // INTEGER
      ]
    },
    {
      name: 'resetuser',
      description: 'Admins: Unlock a user\'s wishlist for editing.',
      default_member_permissions: ADMIN,
      options: [
        { type: 6, name: 'user', description: 'User to unlock', required: true } // USER
      ]
    },
    {
      name: 'resetall',
      description: 'Admins: Reset all users with a specific role (DANGEROUS!).',
      default_member_permissions: ADMIN,
      options: [
        { type: 8, name: 'role', description: 'Role to reset (all members with this role will be reset)', required: true } // ROLE
      ]
    },
    {
      name: 'freeze',
      description: 'Admins: Freeze or unfreeze wishlist modifications.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'Freeze or unfreeze wishlists',
          required: true,
          choices: [
            { name: 'freeze (prevent changes)', value: 'freeze' },
            { name: 'unfreeze (allow changes)', value: 'unfreeze' }
          ]
        }
      ]
    },
    {
      name: 'freezestatus',
      description: 'Admins: Check if wishlists are currently frozen.',
      default_member_permissions: ADMIN
    },
    {
      name: 'remind',
      description: 'Admins: Send a DM reminder to all users who haven\'t submitted wishlists.',
      default_member_permissions: ADMIN
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
      name: 'autoassign',
      description: 'Admins: Manage automatic party assignment system.',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to do',
          required: true,
          choices: [
            { name: 'enable', value: 'enable' },
            { name: 'disable', value: 'disable' },
            { name: 'rebalance', value: 'rebalance' },
            { name: 'status', value: 'status' },
            { name: 'max-parties', value: 'max-parties' }
          ]
        },
        {
          type: 4, // INTEGER
          name: 'value',
          description: 'Value for max-parties (1-10)',
          required: false,
          min_value: 1,
          max_value: 10
        }
      ]
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
      name: 'excluderole',
      description: 'Admins: Exclude/include roles from wishlist tracking.',
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
      name: 'remindparty',
      description: 'Admins: Send a DM to users who haven\'t set up their party info.',
      default_member_permissions: ADMIN
    },
    {
      name: 'viewreserve',
      description: 'Admins: View players in the reserve pool.',
      default_member_permissions: ADMIN
    },
    // PvP Commands
    {
      name: 'pvpevent',
      description: 'Admins: Create a PvP event with attendance tracking.',
      default_member_permissions: ADMIN
    },
    {
      name: 'resetbonuses',
      description: 'Admins: Reset all PvP bonuses (DANGEROUS!).',
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

    // ----- Everyone -----
    {
      name: 'mywishlist',
      description: 'View your wishlist (ephemeral).'
    },
    {
      name: 'myinfo',
      description: 'View and manage your party information.'
    },
    {
      name: 'viewparties',
      description: 'View all static parties.'
    }
  ];

  await client.application.commands.set(commands);
}

module.exports = { registerSlashCommands };