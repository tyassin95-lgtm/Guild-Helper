const { scheduleItemRollClose } = require('../handlers/itemRollButtons');

/**
 * Resume scheduling for all active item rolls on bot restart
 */
async function resumeActiveItemRolls(client, collections) {
  const { itemRolls } = collections;

  try {
    // Find all item rolls that haven't ended yet
    const activeRolls = await itemRolls
      .find({
        closed: false,
        endsAt: { $gt: new Date() }
      })
      .toArray();

    if (activeRolls.length === 0) {
      console.log('No active item rolls to resume.');
      return;
    }

    console.log(`Resuming ${activeRolls.length} active item roll(s)...`);

    for (const roll of activeRolls) {
      scheduleItemRollClose(roll, client, collections);
    }

    console.log(`✅ Resumed ${activeRolls.length} active item roll(s)`);
  } catch (err) {
    console.error('Failed to resume active item rolls:', err);
  }
}

module.exports = { resumeActiveItemRolls };