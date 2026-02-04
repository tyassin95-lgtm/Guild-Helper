/**
 * Utility for checking if a user has excluded roles
 */

/**
 * Check if user has any excluded roles
 * @param {Array<string>} userRoles - Array of role IDs the user has
 * @param {Array<string>} excludedRoles - Array of excluded role IDs from guild settings
 * @returns {boolean} - True if user has any excluded role, false otherwise
 */
function checkExcludedRole(userRoles, excludedRoles) {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return false;
  }
  
  if (!excludedRoles || !Array.isArray(excludedRoles) || excludedRoles.length === 0) {
    return false;
  }
  
  // Check if any user role is in the excluded roles list
  return userRoles.some(roleId => excludedRoles.includes(roleId));
}

module.exports = {
  checkExcludedRole
};
