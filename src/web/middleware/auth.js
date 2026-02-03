/**
 * Authentication Middleware
 * Protects routes and checks user permissions
 */

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
  optionalAuth
};
