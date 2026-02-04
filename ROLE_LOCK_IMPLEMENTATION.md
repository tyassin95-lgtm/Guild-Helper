# Discord Role-Based Web Lock Implementation

## Overview
This implementation provides a mechanism to lock website access for users who have Discord roles marked as "excluded" in the bot's settings.

## Components

### 1. Utility Function: `checkExcludedRole`
**Location**: `src/web/utils/roleCheck.js`

A pure function that checks if a user has any excluded roles.

```javascript
checkExcludedRole(userRoles, excludedRoles)
```

**Parameters**:
- `userRoles` (Array<string>): Array of role IDs the user has
- `excludedRoles` (Array<string>): Array of excluded role IDs from guild settings

**Returns**: `boolean` - True if user has any excluded role, false otherwise

### 2. Middleware: `checkRoleLock`
**Location**: `src/web/middleware/auth.js`

Middleware that checks if authenticated users have excluded roles and sets a flag in the request object.

**Usage**: Applied globally in `server.js` after authentication middleware

```javascript
app.use(checkRoleLock);
```

Sets `req.hasExcludedRole` to true if the user has any excluded roles.

### 3. Session Enhancement
**Location**: `src/web/auth/passport.js`

Modified `enrichSessionData` function to fetch and store user's Discord roles during OAuth callback.

**Session Data Added**:
- `req.session.userRoles`: Array of role IDs the user has in the guild

### 4. Frontend Components

#### CSS: `src/web/public/css/role-lock.css`
Styles for the full-page modal overlay that blocks access.

Key Features:
- Full-page overlay with blur backdrop
- Animated modal card
- Responsive design
- High z-index (10000) to ensure it's on top

#### JavaScript: `src/web/public/js/role-lock.js`
Client-side functionality to show modal and block interactions.

**Main Function**:
```javascript
window.initRoleLock(hasExcludedRole)
```

Actions when user has excluded role:
- Shows the modal
- Blurs page content behind modal
- Blocks all page interactions (clicks, keyboard, scrolling)

#### EJS Partial: `src/web/views/partials/role-lock-modal.ejs`
Reusable modal component that can be included in any page.

**Usage in EJS templates**:
```ejs
<%- include('partials/role-lock-modal') %>
```

**Required Data**: `hasExcludedRole` boolean variable must be passed to the view.

### 5. Server Integration
**Location**: `src/web/server.js`

**Changes**:
1. Import `checkRoleLock` middleware
2. Apply middleware globally
3. Pass `hasExcludedRole` flag to all protected views (profile-dashboard, admin-panel)

## How It Works

### Flow Diagram
```
1. User logs in via Discord OAuth2
   ↓
2. Passport fetches user's guilds
   ↓
3. enrichSessionData fetches user's roles from Discord guild
   ↓
4. User roles stored in session (req.session.userRoles)
   ↓
5. On each request, checkRoleLock middleware:
   - Checks if user has any excluded roles
   - Sets req.hasExcludedRole flag
   ↓
6. View renders with hasExcludedRole flag
   ↓
7. If hasExcludedRole is true:
   - Modal HTML is included in page
   - JavaScript shows modal on page load
   - Page content is blurred and locked
```

## Usage

### For Administrators
1. Use the `/excluderole` bot command to manage excluded roles:
   - `/excluderole add @Role` - Add a role to exclusion list
   - `/excluderole remove @Role` - Remove a role from exclusion list
   - `/excluderole list` - View all excluded roles

2. Users with excluded roles will:
   - Be able to log in
   - See a modal blocking access to all pages
   - See message: "Your Discord role does not allow you to interact with this website"
   - Have option to logout

### For Developers

#### Adding Role Lock to New Pages
1. Pass `hasExcludedRole` flag when rendering:
```javascript
res.render('your-page', {
  // ... other data
  hasExcludedRole: req.hasExcludedRole || false
});
```

2. Include the partial in your EJS template:
```ejs
<!-- At the end of body, before closing </body> tag -->
<%- include('partials/role-lock-modal') %>
```

#### Testing Locally
To test the role lock:
1. Add a role to the exclusion list using the bot
2. Ensure a test user has that role
3. Log in as that test user
4. Verify the modal appears and blocks interaction

## Database Structure

### Guild Settings Collection
```javascript
{
  guildId: "123456789",
  excludedRoles: ["role_id_1", "role_id_2", "..."],
  // ... other settings
}
```

### Session Data
```javascript
req.session = {
  userId: "user_discord_id",
  guildId: "guild_id",
  userRoles: ["role_id_1", "role_id_2", "..."],
  // ... other session data
}
```

## Security Considerations

1. **Server-Side Enforcement**: The check is performed on both server and client side
2. **Session-Based**: User roles are fetched once during login and stored in session
3. **Middleware Protection**: Middleware is applied globally to all routes
4. **Client-Side Blocking**: JavaScript prevents all interactions with the page
5. **CSS Blocking**: Page content is blurred and made non-interactive via CSS

## Limitations

1. **Token-Based Routes**: Party editor and static party editor use token-based auth and are not affected by this lock (by design)
2. **Session Refresh**: User roles are only updated during login. If roles change in Discord, user must log out and log back in
3. **Admin Override**: Admin users should not be added to excluded roles as it would lock them out of admin panel

## Troubleshooting

### Modal doesn't appear
- Check that `hasExcludedRole` is being passed to the view
- Verify the partial is included in the template
- Check browser console for JavaScript errors

### Modal appears but user should have access
- Verify user's roles in Discord
- Check guild settings in database for excluded roles
- User may need to log out and log back in if roles were recently changed

### Page interactions not blocked
- Ensure JavaScript is loaded (check network tab)
- Verify `initRoleLock(true)` is being called
- Check for JavaScript errors in console

## Future Enhancements

1. **Real-time Updates**: Use WebSocket to update role status without requiring logout/login
2. **Custom Messages**: Allow custom messages per guild in guild settings
3. **Temporary Access**: Allow admins to grant temporary access overrides
4. **Audit Logging**: Log when users are blocked by role lock
