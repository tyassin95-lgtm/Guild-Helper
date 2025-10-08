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
            { name: 'status', value: 'status' }
          ]
        }
      ]
    },
    {
      name: 'resetparties',
      description: 'Admins: Reset all party system data (DANGEROUS!).',
      default_member_permissions: ADMIN,
      options: [
        {
          type: 3, // STRING
          name: 'action',
          description: 'What to reset',
          required: true,
          choices: [
            { name: 'all (delete everything)', value: 'all' }
          ]
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
