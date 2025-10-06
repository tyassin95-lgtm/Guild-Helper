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
      description: 'Admins: Unlock a user’s wishlist for editing.',
      default_member_permissions: ADMIN,
      options: [
        { type: 6, name: 'user', description: 'User to unlock', required: true } // USER
      ]
    },

    // ----- Everyone -----
    {
      name: 'mywishlist',
      description: 'View your wishlist (ephemeral).'
    }
  ];

  await client.application.commands.set(commands);
}

module.exports = { registerSlashCommands };
