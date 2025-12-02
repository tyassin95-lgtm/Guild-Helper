const { PermissionFlagsBits } = require('discord.js');
const { scheduleLiveSummaryUpdate } = require('../liveSummary');

async function handleResetUser({ interaction, collections }) {
  const { wishlists, tokenRegenerations } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to reset wishlists.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user');

  const pendingRegens = await tokenRegenerations.find({
    userId: targetUser.id,
    guildId: interaction.guildId,
    notified: false
  }).toArray();

  const regenCounts = {
    weapon: 0,
    armor: 0,
    accessory: 0
  };

  for (const regen of pendingRegens) {
    if (regenCounts[regen.tokenType] !== undefined) {
      regenCounts[regen.tokenType]++;
    }
  }

  const startingTokens = {
    weapon: Math.max(0, 1 - regenCounts.weapon),
    armor: Math.max(0, 4 - regenCounts.armor),
    accessory: Math.max(0, 1 - regenCounts.accessory)
  };

  const result = await wishlists.updateOne(
    { userId: targetUser.id, guildId: interaction.guildId },
    { 
      $set: { 
        finalized: false,
        weapons: [],
        armor: [],
        accessories: [],
        tokensUsed: {
          weapon: 1 - startingTokens.weapon,
          armor: 4 - startingTokens.armor,
          accessory: 1 - startingTokens.accessory
        },
        tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
        timestamps: {}
      } 
    }
  );

  if (result.matchedCount === 0) {
    return interaction.reply({ content: '❌ User has no wishlist.', flags: [64] });
  }

  await scheduleLiveSummaryUpdate(interaction, collections);

  let message = `✅ ${targetUser.tag} has been reset:\n`;
  message += `• Wishlist cleared and unlocked for editing\n`;
  message += `• Moved back to "Not Submitted" status\n`;

  if (pendingRegens.length > 0) {
    message += `• Tokens adjusted for ${pendingRegens.length} pending regeneration(s):\n`;
    message += `  - ${startingTokens.weapon} weapon token(s) (${regenCounts.weapon} regenerating)\n`;
    message += `  - ${startingTokens.armor} armor token(s) (${regenCounts.armor} regenerating)\n`;
    message += `  - ${startingTokens.accessory} accessory token(s) (${regenCounts.accessory} regenerating)\n`;
  } else {
    message += `• All tokens reset to default (1 weapon, 4 armor, 1 accessory)\n`;
  }

  message += `• Items received history **preserved**\n`;
  message += `• Handed-out records **preserved**\n`;
  message += `• Token regenerations **preserved**`;

  return interaction.reply({ content: message, flags: [64] });
}

module.exports = { handleResetUser };