/**
 * Authentication Middleware
 * Protects routes and checks user permissions
 */
const { checkExcludedRole } = require('../utils/roleCheck');

/**
 * Middleware to require authentication
 * Redirects to /login if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Store the original URL to redirect after login
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

/**
 * Middleware to check for excluded roles
 * Passes flag to views to show role lock modal if user has excluded role
 * Note: guildSettings is populated during OAuth callback via enrichSessionData
 */
function checkRoleLock(req, res, next) {
  // Only check for authenticated users
  if (!req.session || !req.session.userId) {
    return next();
  }
  
  const userRoles = req.session.userRoles || [];
  // Guild settings are populated during login; if not present, no roles are excluded
  const guildSettings = req.session.guildSettings;
  const excludedRoles = guildSettings?.excludedRoles || [];
  
  // Check if user has any excluded roles
  req.hasExcludedRole = checkExcludedRole(userRoles, excludedRoles);
  
  next();
}

/**
 * Middleware to require admin access
 * Checks if user has admin role in their guild
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  
  // Check if user is admin (we'll validate this from guild member data)
  if (req.session.isAdmin) {
    return next();
  }
  
  res.status(403).render('error', {
    message: 'Access Denied. You do not have administrator permissions. Contact your guild administrator for access.'
  });
}

/**
 * Optional auth - doesn't redirect, just sets req.user if authenticated
 */
function optionalAuth(req, res, next) {
  // User data is already in session, just continue
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  checkRoleLock
};
