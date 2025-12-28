const { ObjectId } = require("mongodb");
const { updateItemRollEmbed } = require("../itemRollEmbed");

async function handleItemRollButtons({ interaction, collections }) {
  const { itemRolls, pvpBonuses } = collections;

  // Roll button
  if (interaction.customId.startsWith("itemroll_roll:")) {
    const rollId = interaction.customId.split(":")[1];

    await interaction.deferReply({ flags: [64] });

    const itemRoll = await itemRolls.findOne({ _id: new ObjectId(rollId) });

    if (!itemRoll) {
      return interaction.editReply({ content: "❌ Item roll not found." });
    }

    if (itemRoll.closed) {
      return interaction.editReply({ content: "❌ This item roll has ended." });
    }

    // Check if roll has expired
    if (new Date() > itemRoll.endsAt) {
      return interaction.editReply({ content: "❌ This item roll has ended." });
    }

    // Check if user is eligible
    if (
      itemRoll.eligibleUsers.length > 0 &&
      !itemRoll.eligibleUsers.includes(interaction.user.id)
    ) {
      return interaction.editReply({
        content: "❌ You are not eligible to roll for this item.",
      });
    }

    // Check if user already rolled
    if (itemRoll.rolls.some((r) => r.userId === interaction.user.id)) {
      return interaction.editReply({
        content: "❌ You have already rolled for this item.",
      });
    }

    // Get user's PvP bonus
    const bonusData = await pvpBonuses.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const bonus = bonusData ? bonusData.bonusCount : 0;

    // Generate random roll (1-100)
    const baseRoll = Math.floor(Math.random() * 100) + 1;
    const total = baseRoll + bonus;

    // Add roll to database
    await itemRolls.updateOne(
      { _id: new ObjectId(rollId) },
      {
        $push: {
          rolls: {
            userId: interaction.user.id,
            baseRoll,
            bonus,
            total,
            timestamp: new Date(),
          },
        },
      },
    );

    // Update the embed
    const updatedRoll = await itemRolls.findOne({ _id: new ObjectId(rollId) });
    await updateItemRollEmbed(interaction, updatedRoll, collections);

    return interaction.editReply({
      content:
        `🎲 **You rolled!**\n\n` +
        `**Base Roll:** ${baseRoll}\n` +
        `**PvP Bonus:** +${bonus}\n` +
        `**Total:** ${total}`,
    });
  }

  // Everyone button (during setup)
  if (interaction.customId.startsWith("itemroll_everyone:")) {
    const tempId = interaction.customId.split(":")[1];
    const tempData = global.tempItemRollData?.[tempId];

    if (!tempData) {
      return interaction.update({
        content: "❌ Setup session expired. Please start over.",
        components: [],
      });
    }

    await interaction.deferUpdate();

    // Create the item roll with empty eligibleUsers (everyone)
    const itemRoll = {
      ...tempData,
      eligibleUsers: [],
      rolls: [],
      closed: false,
      createdAt: new Date(),
    };

    const result = await itemRolls.insertOne(itemRoll);
    itemRoll._id = result.insertedId;

    // Delete temp data
    delete global.tempItemRollData[tempId];

    // Create and send the embed
    const { createItemRollEmbed } = require("../itemRollEmbed");
    const { embed, components } = await createItemRollEmbed(
      itemRoll,
      interaction.client,
      collections,
    );

    const rollMessage = await interaction.channel.send({
      content: "@everyone",
      embeds: [embed],
      components,
      allowedMentions: { parse: ["everyone"] },
    });

    // Save message ID
    await itemRolls.updateOne(
      { _id: itemRoll._id },
      { $set: { messageId: rollMessage.id } },
    );

    // Schedule auto-close
    scheduleItemRollClose(itemRoll, interaction.client, collections);

    return interaction.editReply({
      content:
        `✅ **Item roll created successfully!**\n\n` +
        `🔗 [View Item Roll](${rollMessage.url})\n` +
        `⏰ Rolling will close <t:${Math.floor(itemRoll.endsAt.getTime() / 1000)}:R>`,
      components: [],
    });
  }
}

/**
 * Schedule automatic closing of item roll when time expires
 */
function scheduleItemRollClose(itemRoll, client, collections) {
  const timeUntilClose = itemRoll.endsAt.getTime() - Date.now();

  if (timeUntilClose <= 0) {
    // Already expired, close immediately
    closeItemRoll(itemRoll._id, client, collections);
    return;
  }

  setTimeout(() => {
    closeItemRoll(itemRoll._id, client, collections);
  }, timeUntilClose);
}

/**
 * Close an item roll and determine winner (or create tiebreaker)
 */
async function closeItemRoll(rollId, client, collections) {
  const { itemRolls } = collections;

  try {
    const itemRoll = await itemRolls.findOne({ _id: new ObjectId(rollId) });

    if (!itemRoll || itemRoll.closed) {
      return;
    }

    // No rolls at all
    if (itemRoll.rolls.length === 0) {
      await itemRolls.updateOne(
        { _id: new ObjectId(rollId) },
        {
          $set: {
            closed: true,
            winnerId: null,
            closedAt: new Date(),
          },
        },
      );

      const updatedRoll = await itemRolls.findOne({
        _id: new ObjectId(rollId),
      });
      await updateItemRollEmbedOnClose(client, updatedRoll, collections);

      try {
        const channel = await client.channels.fetch(updatedRoll.channelId);
        if (channel) {
          await channel.send({
            content: `⏰ **Item Roll Ended**\n\nNo one rolled for **${updatedRoll.itemName}**.`,
          });
        }
      } catch (err) {
        console.error("Failed to send no-rolls message:", err);
      }

      return;
    }

    // Sort rolls by total (descending)
    const sortedRolls = itemRoll.rolls.sort((a, b) => b.total - a.total);
    const highestScore = sortedRolls[0].total;

    // Find all users with the highest score
    const tiedUsers = sortedRolls.filter((r) => r.total === highestScore);

    // Check for tie
    if (tiedUsers.length > 1) {
      console.log(
        `Tie detected for roll ${rollId}: ${tiedUsers.length} users with score ${highestScore}`,
      );

      // Mark original roll as closed
      await itemRolls.updateOne(
        { _id: new ObjectId(rollId) },
        {
          $set: {
            closed: true,
            isTiebreaker: false,
            tieDetected: true,
            closedAt: new Date(),
          },
        },
      );

      // Update original embed
      const updatedRoll = await itemRolls.findOne({
        _id: new ObjectId(rollId),
      });
      await updateItemRollEmbedOnClose(client, updatedRoll, collections);

      // Create tiebreaker roll
      await createTiebreakerRoll(itemRoll, tiedUsers, client, collections);

      return;
    }

    // No tie - we have a clear winner
    const winnerId = sortedRolls[0].userId;

    await itemRolls.updateOne(
      { _id: new ObjectId(rollId) },
      {
        $set: {
          closed: true,
          winnerId,
          closedAt: new Date(),
        },
      },
    );

    const updatedRoll = await itemRolls.findOne({ _id: new ObjectId(rollId) });
    await updateItemRollEmbedOnClose(client, updatedRoll, collections);

    // Announce winner
    try {
      const channel = await client.channels.fetch(updatedRoll.channelId);
      if (channel) {
        const winner = await client.guilds.cache
          .get(updatedRoll.guildId)
          ?.members.fetch(winnerId)
          .catch(() => null);
        if (winner) {
          const winningRoll = updatedRoll.rolls.find(
            (r) => r.userId === winnerId,
          );
          await channel.send({
            content:
              `🎉 **Item Roll Winner!**\n\n` +
              `${winner} has won **${updatedRoll.itemName}** with a roll of **${winningRoll.total}**!\n` +
              `(Base: ${winningRoll.baseRoll} + Bonus: ${winningRoll.bonus})`,
          });
        }
      }
    } catch (err) {
      console.error("Failed to announce winner:", err);
    }
  } catch (err) {
    console.error("Failed to close item roll:", err);
  }
}

/**
 * Create a tiebreaker roll for tied participants
 */
async function createTiebreakerRoll(
  originalRoll,
  tiedUsers,
  client,
  collections,
) {
  const { itemRolls } = collections;

  try {
    // Create tiebreaker that lasts 6 hours
    const tiebreakerEndsAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    const tiebreakerRoll = {
      guildId: originalRoll.guildId,
      channelId: originalRoll.channelId,
      itemName: originalRoll.itemName,
      trait: originalRoll.trait,
      imageUrl: originalRoll.imageUrl,
      duration: 360, // 6 hours
      endsAt: tiebreakerEndsAt,
      createdBy: originalRoll.createdBy,
      eligibleUsers: tiedUsers.map((u) => u.userId),
      rolls: [],
      closed: false,
      isTiebreaker: true,
      originalRollId: originalRoll._id,
      createdAt: new Date(),
    };

    const result = await itemRolls.insertOne(tiebreakerRoll);
    tiebreakerRoll._id = result.insertedId;

    // Create and send the tiebreaker embed
    const { createItemRollEmbed } = require("../itemRollEmbed");
    const { embed, components } = await createItemRollEmbed(
      tiebreakerRoll,
      client,
      collections,
    );

    const channel = await client.channels.fetch(originalRoll.channelId);
    if (!channel) {
      console.error("Failed to fetch channel for tiebreaker");
      return;
    }

    // Mention tied users
    const mentions = tiedUsers.map((u) => `<@${u.userId}>`).join(" ");

    const tiebreakerMessage = await channel.send({
      content:
        `⚔️ **TIEBREAKER!**\n\n` +
        `${mentions}\n\n` +
        `Multiple players tied with a roll of **${tiedUsers[0].total}**!\n` +
        `You have **6 hours** to roll again to determine the winner.`,
      embeds: [embed],
      components,
      allowedMentions: { parse: ["users"] },
    });

    // Save message ID
    await itemRolls.updateOne(
      { _id: tiebreakerRoll._id },
      { $set: { messageId: tiebreakerMessage.id } },
    );

    // Schedule auto-close for tiebreaker
    scheduleItemRollClose(tiebreakerRoll, client, collections);

    console.log(
      `Tiebreaker roll created: ${tiebreakerRoll._id} for original roll ${originalRoll._id}`,
    );
  } catch (err) {
    console.error("Failed to create tiebreaker roll:", err);
  }
}

/**
 * Update item roll embed on close
 */
async function updateItemRollEmbedOnClose(client, itemRoll, collections) {
  try {
    const channel = await client.channels.fetch(itemRoll.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(itemRoll.messageId);
    if (!message) return;

    const { createItemRollEmbed } = require("../itemRollEmbed");
    const { embed, components } = await createItemRollEmbed(
      itemRoll,
      client,
      collections,
    );

    await message.edit({
      embeds: [embed],
      components,
    });
  } catch (err) {
    console.error("Failed to update item roll embed on close:", err);
  }
}

module.exports = {
  handleItemRollButtons,
  scheduleItemRollClose,
  closeItemRoll,
};
