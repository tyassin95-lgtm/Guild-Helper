const { handleCreatePanel } = require('./commands/createpanel');
const { handleMyWishlist } = require('./commands/mywishlist');
const { handleSummary } = require('./commands/summary');
const { handleGrantTokens } = require('./commands/granttokens');
const { handleRemoveTokens } = require('./commands/removetokens');
const { handleResetUser } = require('./commands/resetuser');
const { handleSummaryLive } = require('./commands/summarylive'); // NEW

const { handleButtons } = require('./buttons');
const { handleSelects } = require('./selects');

async function onInteractionCreate({ client, interaction, db, collections }) {
  if (interaction.isChatInputCommand()) {
    const name = interaction.commandName;
    if (name === 'createpanel') return handleCreatePanel({ interaction, collections });
    if (name === 'mywishlist')  return handleMyWishlist({ interaction, collections });
    if (name === 'summary')     return handleSummary({ interaction, collections });
    if (name === 'summarylive') return handleSummaryLive({ interaction, collections }); // NEW
    if (name === 'granttokens') return handleGrantTokens({ interaction, collections });
    if (name === 'removetokens')return handleRemoveTokens({ interaction, collections });
    if (name === 'resetuser')   return handleResetUser({ interaction, collections });
  }

  if (interaction.isButton()) {
    return handleButtons({ interaction, collections });
  }

  if (interaction.isStringSelectMenu()) {
    return handleSelects({ interaction, collections });
  }
}

module.exports = { onInteractionCreate };
