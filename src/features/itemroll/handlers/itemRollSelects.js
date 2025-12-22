const { scheduleItemRollClose } = require('./itemRollButtons');

async function handleItemRollSelects({ interaction, collections }) {
  const { itemRolls } = collections;

  // User selection for eligible participants
  if (interaction.customId.startsWith('itemroll_select_users:')) {
    const tempId = interaction.customId.split(':')[1];
    const tempData = global.tempItemRollData?.[tempId];

    if (!tempData) {
      return interaction.update({
        content: '❌ Setup session expired. Please start over.',
        components: []
      });
    }

    await interaction.deferUpdate();

    const selectedUsers = interaction.values;

    if (selectedUsers.length === 0) {
      return interaction.followUp({
        content: '❌ Please select at least one user, or click "Allow Everyone" to let all members roll.',
        flags: [64]
      });
    }

    // Create the item roll with selected users
    const itemRoll = {
      ...tempData,
      eligibleUsers: selectedUsers,
      rolls: [],
      closed: false,
      createdAt: new Date()
    };

    const result = await itemRolls.insertOne(itemRoll);
    itemRoll._id = result.insertedId;

    // Delete temp data
    delete global.tempItemRollData[tempId];

    // Create and send the embed
    const { createItemRollEmbed } = require('../itemRollEmbed');
    const { embed, components } = await createItemRollEmbed(itemRoll, interaction.client, collections);

    // Create mention string for selected users
    const mentions = selectedUsers.map(id => `<@${id}>`).join(' ');

    const rollMessage = await interaction.channel.send({
      content: mentions,
      embeds: [embed],
      components,
      allowedMentions: { parse: ['users'] }
    });

    // Save message ID
    await itemRolls.updateOne(
      { _id: itemRoll._id },
      { $set: { messageId: rollMessage.id } }
    );

    // Schedule auto-close
    scheduleItemRollClose(itemRoll, interaction.client, collections);

    return interaction.editReply({
      content: `✅ **Item roll created successfully!**\n\n` +
               `🔗 [View Item Roll](${rollMessage.url})\n` +
               `⏰ Rolling will close <t:${Math.floor(itemRoll.endsAt.getTime() / 1000)}:R>\n` +
               `👥 ${selectedUsers.length} user(s) selected`,
      components: []
    });
  }
}

module.exports = { handleItemRollSelects };