const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

async function handleItemRoll({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Show modal to collect item roll information
  const modal = new ModalBuilder()
    .setCustomId('itemroll_create_modal')
    .setTitle('Create Item Roll');

  const itemNameInput = new TextInputBuilder()
    .setCustomId('item_name')
    .setLabel('Item Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Epic Sword of Destiny')
    .setRequired(true)
    .setMaxLength(100);

  const traitInput = new TextInputBuilder()
    .setCustomId('trait')
    .setLabel('Item Trait')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., +15% Attack Speed')
    .setRequired(true)
    .setMaxLength(200);

  const imageInput = new TextInputBuilder()
    .setCustomId('image_url')
    .setLabel('Image URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://i.imgur.com/example.png')
    .setRequired(false);

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Roll Duration (in minutes)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5, 10, 15')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  modal.addComponents(
    new ActionRowBuilder().addComponents(itemNameInput),
    new ActionRowBuilder().addComponents(traitInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(durationInput)
  );

  return interaction.showModal(modal);
}

module.exports = { handleItemRoll };