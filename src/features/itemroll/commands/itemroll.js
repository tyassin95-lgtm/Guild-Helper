const { PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { getCategories } = require('../data/items');

async function handleItemRoll({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Show category selection
  const categories = getCategories();

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('itemroll_select_category')
    .setPlaceholder('Select item category')
    .addOptions(categories);

  const row = new ActionRowBuilder().addComponents(categorySelect);

  return interaction.reply({
    content: '**Step 1: Select Item Category**\n\nChoose the type of item for this roll:',
    components: [row],
    flags: [64]
  });
}

module.exports = { handleItemRoll };