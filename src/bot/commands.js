async function registerSlashCommands(client) {
  const commands = [
    { name: 'createpanel', description: 'Create a wishlist panel in this channel.' },
    { name: 'mywishlist', description: 'View your wishlist (ephemeral).' },
    { name: 'summary', description: 'Admins: View a boss-by-boss summary of finalized wishlists.' },
    {
      name: 'granttokens',
      description: 'Admins: Grant extra tokens to a user.',
      options: [
        { type: 6, name: 'user', description: 'User to grant tokens to', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to grant', required: true,
          choices: [{ name: 'weapon', value: 'weapon' },{ name: 'armor', value: 'armor' },{ name: 'accessory', value: 'accessory' }]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to grant', required: true } // INTEGER
      ]
    },
    {
      name: 'removetokens',
      description: 'Admins: Remove token grants from a user.',
      options: [
        { type: 6, name: 'user', description: 'User to remove tokens from', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to remove', required: true,
          choices: [{ name: 'weapon', value: 'weapon' },{ name: 'armor', value: 'armor' },{ name: 'accessory', value: 'accessory' }]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to remove', required: true } // INTEGER
      ]
    },
    {
      name: 'resetuser',
      description: 'Admins: Unlock a user’s wishlist for editing.',
      options: [{ type: 6, name: 'user', description: 'User to unlock', required: true }]
    }
  ];

  // Global registration (same as your current behavior)
  await client.application.commands.set(commands);
}

module.exports = { registerSlashCommands };
