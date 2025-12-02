const { handleCreatePanel } = require('./createpanel');
const { handleMyWishlist } = require('./mywishlist');
const { handleSummary } = require('./summary');
const { handleSummaryLive } = require('./summarylive');
const { handleStats } = require('./stats');
const { handleGrantTokens } = require('./granttokens');
const { handleRemoveTokens } = require('./removetokens');
const { handleResetUser } = require('./resetuser');
const { handleResetAll } = require('./resetall');
const { handleFreeze, handleFreezeStatus } = require('./freeze');
const { handleRemind } = require('./remind');
const { handleExcludeRole } = require('./excluderole');

async function handleWishlistCommands({ interaction, collections }) {
  const { commandName } = interaction;

  switch (commandName) {
    case 'createpanel':
      return handleCreatePanel({ interaction, collections });
    case 'mywishlist':
      return handleMyWishlist({ interaction, collections });
    case 'summary':
      return handleSummary({ interaction, collections });
    case 'summarylive':
      return handleSummaryLive({ interaction, collections });
    case 'stats':
      return handleStats({ interaction, collections });
    case 'granttokens':
      return handleGrantTokens({ interaction, collections });
    case 'removetokens':
      return handleRemoveTokens({ interaction, collections });
    case 'resetuser':
      return handleResetUser({ interaction, collections });
    case 'resetall':
      return handleResetAll({ interaction, collections });
    case 'freeze':
      return handleFreeze({ interaction, collections });
    case 'freezestatus':
      return handleFreezeStatus({ interaction, collections });
    case 'remind':
      return handleRemind({ interaction, collections });
    case 'excluderole':
      return handleExcludeRole({ interaction, collections });
    default:
      return interaction.reply({ content: '❌ Unknown wishlist command.', flags: [64] });
  }
}

module.exports = { handleWishlistCommands };