const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getSubcategories,
  getItems,
  getItemFromValue,
} = require("../data/items");
const { scheduleItemRollClose } = require("./itemRollButtons");

async function handleItemRollSelects({ interaction, collections }) {
  const { itemRolls } = collections;

  try {
    console.log("[ItemRoll] Select handler called:", interaction.customId);
    console.log("[ItemRoll] Selected values:", interaction.values);

    // ===== STEP 1: Category Selection =====
    if (interaction.customId === "itemroll_select_category") {
      const category = interaction.values[0];
      console.log("[ItemRoll] Category selected:", category);

      // Show subcategory selection
      const subcategories = getSubcategories(category);

      if (subcategories.length === 0) {
        return interaction.update({
          content: "❌ No subcategories found for this category.",
          components: [],
        });
      }

      const subcategorySelect = new StringSelectMenuBuilder()
        .setCustomId(`itemroll_select_subcategory:${category}`)
        .setPlaceholder("Select item type")
        .addOptions(subcategories);

      const row = new ActionRowBuilder().addComponents(subcategorySelect);

      return interaction.update({
        content:
          "**Step 2: Select Item Type**\n\nChoose the specific type of item:",
        components: [row],
      });
    }

    // ===== STEP 2: Subcategory Selection =====
    if (interaction.customId.startsWith("itemroll_select_subcategory:")) {
      const category = interaction.customId.split(":")[1];
      const subcategory = interaction.values[0];
      console.log(
        "[ItemRoll] Subcategory selected:",
        category,
        ">",
        subcategory,
      );

      // Show item selection
      const items = getItems(category, subcategory);

      if (items.length === 0) {
        return interaction.update({
          content: "❌ No items found for this subcategory.",
          components: [],
        });
      }

      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId(`itemroll_select_item:${category}:${subcategory}`)
        .setPlaceholder("Select the item")
        .addOptions(items.slice(0, 25)); // Discord limit of 25 options

      const row = new ActionRowBuilder().addComponents(itemSelect);

      let content =
        "**Step 3: Select Item**\n\nChoose the specific item for this roll:";

      if (items.length > 25) {
        content += `\n\n⚠️ *Showing first 25 of ${items.length} items*`;
      }

      return interaction.update({
        content,
        components: [row],
      });
    }

    // ===== STEP 3: Item Selection =====
    if (interaction.customId.startsWith("itemroll_select_item:")) {
      console.log("[ItemRoll] Item selected, parsing data...");

      // Get item data from the index-based value
      const itemData = getItemFromValue(interaction.values[0]);

      if (!itemData) {
        return interaction.update({
          content: "❌ Invalid item selection. Please try again.",
          components: [],
        });
      }

      console.log("[ItemRoll] Item data:", itemData);

      // Store item data temporarily and show trait/duration modal
      global.tempItemRollData = global.tempItemRollData || {};
      const tempId = `${interaction.user.id}_${Date.now()}`;

      global.tempItemRollData[tempId] = {
        itemName: itemData.name,
        imageUrl: itemData.imageUrl,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      };

      console.log("[ItemRoll] Temp data stored with ID:", tempId);

      // Show modal for trait and duration
      const modal = new ModalBuilder()
        .setCustomId(`itemroll_trait_duration_modal:${tempId}`)
        .setTitle("Item Roll Details");

      const traitInput = new TextInputBuilder()
        .setCustomId("trait")
        .setLabel("Item Trait")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g., Attack Speed")
        .setRequired(true)
        .setMaxLength(200);

      const durationInput = new TextInputBuilder()
        .setCustomId("duration")
        .setLabel("Roll Duration (in hours)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g., 1, 2, 3")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder().addComponents(traitInput),
        new ActionRowBuilder().addComponents(durationInput),
      );

      console.log("[ItemRoll] Showing modal...");
      return interaction.showModal(modal);
    }

    // ===== STEP 4: User selection (after modal) =====
    if (interaction.customId.startsWith("itemroll_select_users:")) {
      const tempId = interaction.customId.split(":")[1];
      const tempData = global.tempItemRollData?.[tempId];

      console.log("[ItemRoll] User selection, tempId:", tempId);
      console.log("[ItemRoll] Temp data exists:", !!tempData);

      if (!tempData) {
        return interaction.update({
          content: "❌ Setup session expired. Please start over.",
          components: [],
        });
      }

      await interaction.deferUpdate();

      const selectedUsers = interaction.values;

      if (selectedUsers.length === 0) {
        return interaction.followUp({
          content:
            '❌ Please select at least one user, or click "Allow Everyone" to let all members roll.',
          flags: [64],
        });
      }

      console.log(
        "[ItemRoll] Creating roll for",
        selectedUsers.length,
        "users...",
      );

      // Create the item roll with selected users
      const itemRoll = {
        ...tempData,
        eligibleUsers: selectedUsers,
        rolls: [],
        closed: false,
        createdAt: new Date(),
      };

      const result = await itemRolls.insertOne(itemRoll);
      itemRoll._id = result.insertedId;

      console.log("[ItemRoll] Roll created with ID:", itemRoll._id);

      // Delete temp data
      delete global.tempItemRollData[tempId];

      // Create and send the embed
      const { createItemRollEmbed } = require("../itemRollEmbed");
      const { embed, components } = await createItemRollEmbed(
        itemRoll,
        interaction.client,
        collections,
      );

      // Create mention string for selected users
      const mentions = selectedUsers.map((id) => `<@${id}>`).join(" ");

      const rollMessage = await interaction.channel.send({
        content: mentions,
        embeds: [embed],
        components,
        allowedMentions: { parse: ["users"] },
      });

      // Save message ID
      await itemRolls.updateOne(
        { _id: itemRoll._id },
        { $set: { messageId: rollMessage.id } },
      );

      // Schedule auto-close
      scheduleItemRollClose(itemRoll, interaction.client, collections);

      console.log("[ItemRoll] Roll setup complete!");

      return interaction.editReply({
        content:
          `✅ **Item roll created successfully!**\n\n` +
          `🔗 [View Item Roll](${rollMessage.url})\n` +
          `⏰ Rolling will close <t:${Math.floor(itemRoll.endsAt.getTime() / 1000)}:R>\n` +
          `👥 ${selectedUsers.length} user(s) selected`,
        components: [],
      });
    }

    console.log(
      "[ItemRoll] No handler matched for customId:",
      interaction.customId,
    );
  } catch (error) {
    console.error("[ItemRoll] Error in select handler:", error);
    console.error("[ItemRoll] Stack trace:", error.stack);

    // Try to respond to the user
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ An error occurred: ${error.message}`,
          components: [],
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: `❌ An error occurred: ${error.message}`,
          flags: [64],
        });
      } else {
        await interaction.reply({
          content: `❌ An error occurred: ${error.message}`,
          flags: [64],
        });
      }
    } catch (replyError) {
      console.error("[ItemRoll] Failed to send error message:", replyError);
    }
  }
}

module.exports = { handleItemRollSelects };
