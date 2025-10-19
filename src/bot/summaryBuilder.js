for (const { key, title, color, icon } of categoryInfo) {
  const items = categorySummary[key];
  const itemNames = Object.keys(items);

  if (itemNames.length === 0) continue;

  anyData = true;

  // Sort items alphabetically
  itemNames.sort((a, b) => a.localeCompare(b));

  // Split items into multiple embeds if needed (Discord: 6000 chars total, 25 fields per embed)
  let currentEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setThumbnail(icon)
    .setTimestamp();

  let currentEmbedSize = title.length + 100; // Rough estimate for title + metadata
  let currentFieldCount = 0;

  for (const itemName of itemNames) {
    const users = items[itemName];

    // Sort users by timestamp (oldest first)
    users.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

    const userList = users.map(u => {
      const dateStr = u.timestamp ? ` - ${new Date(u.timestamp).toLocaleDateString()}` : '';
      const bossStr = u.boss ? ` (${u.boss})` : '';
      const crossedOut = u.handedOut ? '~~' : '';
      return `${crossedOut}• ${u.name}${dateStr}${bossStr}${crossedOut}`;
    }).join('\n');

    // Handle long field values (Discord limit is 1024 chars)
    const fieldValue = userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList;
    const fieldName = `${itemName} (${users.length})`;

    const fieldSize = fieldName.length + fieldValue.length;

    // Check if adding this field would exceed limits
    if (currentFieldCount >= 25 || currentEmbedSize + fieldSize > 5500) {
      // Push current embed and start a new one
      embeds.push(currentEmbed);

      currentEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${title} (continued)`)
        .setTimestamp();

      currentEmbedSize = title.length + 100;
      currentFieldCount = 0;
    }

    currentEmbed.addFields({
      name: fieldName,
      value: fieldValue,
      inline: false
    });

    currentEmbedSize += fieldSize;
    currentFieldCount++;
  }

  // Push the last embed for this category
  if (currentFieldCount > 0) {
    embeds.push(currentEmbed);
  }
}