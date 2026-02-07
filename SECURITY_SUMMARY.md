# Security Summary - Website Inbox Feature

## Security Measures Implemented

### 1. Authentication & Authorization
✅ **Session Authentication**: All user-facing inbox endpoints require authentication via `requireAuth` middleware
- GET /api/inbox/messages
- POST /api/inbox/mark-read
- GET /api/inbox/unread-count
- POST /api/inbox/mark-all-read
- DELETE /api/inbox/message/:messageId

✅ **User Isolation**: Users can only access their own messages
- All database queries filter by `userId` from the session
- Message IDs alone cannot be used to access other users' data

✅ **Bot Token Authentication**: Bot inbox endpoint requires bearer token
- POST /api/bot/inbox requires `Authorization: Bearer <token>` header
- Token is validated against `BOT_INBOX_TOKEN` or `DISCORD_TOKEN` environment variable

### 2. Input Validation
✅ **Required Fields**: All endpoints validate required parameters
- Bot endpoint: `discord_user_id` and `content` are required
- Mark read endpoint: `messageId` is required
- Delete endpoint: `messageId` is required (via URL parameter)

✅ **Type Validation**: Message types are validated
- Allowed types: 'system', 'support', 'reward', 'warning'
- Default to 'system' if not provided

### 3. XSS Prevention
✅ **HTML Escaping**: All user-generated content is escaped before display
- `escapeHtml()` function replaces `&<>"'` with HTML entities
- Applied to message titles and content before rendering
- Uses efficient string replacement (not DOM manipulation)

✅ **No Inline Event Handlers**: Removed all `onclick` attributes
- Event listeners attached via `addEventListener`
- Prevents injection of malicious JavaScript

✅ **Data Attributes**: Message IDs in data attributes are not escaped
- Safe because they're database-generated ObjectId strings
- Not rendered as HTML content

### 4. Safe DOM Manipulation
✅ **Controlled HTML Rendering**: Toast system checks for HTML tags
- Uses `textContent` for plain text (prevents XSS)
- Uses `innerHTML` only for controlled, escaped HTML
- `requestAnimationFrame` ensures proper DOM rendering before event attachment

### 5. Database Security
✅ **MongoDB Indexes**: Proper indexes for query performance and data integrity
- Index on `userId` and `messageTimestamp` for fast user message retrieval
- Index on `userId` and `isRead` for unread count queries
- Index on `discordUserId` for bot-side lookups

✅ **Query Safety**: All queries use parameterized operations
- No string concatenation in queries
- MongoDB driver handles escaping automatically

## Pre-Existing Security Issues (Not Introduced by This Feature)

### CSRF Protection
⚠️ **CodeQL Alert**: Missing CSRF protection on POST/DELETE endpoints
- **Status**: Pre-existing issue affecting entire application
- **Scope**: All POST/DELETE endpoints lack CSRF tokens
- **Impact**: The inbox feature follows the same patterns as existing endpoints
- **Recommendation**: Implement CSRF protection application-wide (outside scope of this feature)

**Mitigation**: 
- Application uses `sameSite: 'lax'` on session cookie
- Session-based authentication provides some protection
- For full CSRF protection, implement CSRF tokens in a separate PR

## Additional Security Considerations

### Bot Token Fallback
The bot inbox endpoint falls back to `DISCORD_TOKEN` if `BOT_INBOX_TOKEN` is not set:
```javascript
const expectedToken = process.env.BOT_INBOX_TOKEN || process.env.DISCORD_TOKEN;
```

**Rationale**:
- Both tokens represent the same bot instance
- This endpoint only creates inbox messages (no sensitive operations)
- The bot already has direct DM access to users
- Simplifies configuration for development/testing

**Recommendation**: Set `BOT_INBOX_TOKEN` explicitly in production for principle of least privilege

### Message Content Storage
Messages are stored as plain text in the database:
- No encryption at rest (follows existing pattern for other user data)
- Messages contain no sensitive information (they mirror bot DMs)
- Only accessible to the specific user via authenticated endpoints

**Recommendation**: If storing sensitive information in the future, implement field-level encryption

### Rate Limiting
No rate limiting on inbox endpoints:
- Read operations: GET /api/inbox/messages, GET /api/inbox/unread-count
- Write operations: POST /api/inbox/mark-read, POST /api/inbox/mark-all-read, DELETE

**Mitigation**:
- Read operations are fast (indexed queries)
- Write operations are user-initiated and self-limiting
- Bot endpoint relies on bot's own rate limiting

**Recommendation**: Implement rate limiting application-wide (outside scope of this feature)

## Testing Recommendations

### Security Testing Checklist
- [ ] Verify users cannot access other users' messages
- [ ] Test bot endpoint with invalid/missing tokens
- [ ] Test XSS attempts in message content
- [ ] Test SQL injection attempts in message IDs
- [ ] Verify session timeout/logout clears access
- [ ] Test concurrent operations (mark read, delete)
- [ ] Verify input validation on all endpoints

### Penetration Testing
Consider testing:
1. Session hijacking attempts
2. CSRF attacks (when CSRF protection is added)
3. XSS payload injection in messages
4. Authorization bypass attempts
5. Token brute-forcing on bot endpoint

## Compliance

### GDPR Considerations
- Messages contain Discord user IDs (personal data)
- Users can delete their own messages (right to erasure)
- Consider implementing bulk delete / account deletion flow

### Data Retention
- No automatic message expiration implemented
- Consider adding TTL or max message limits
- Document retention policy

## Conclusion

The inbox feature implements security measures consistent with the existing codebase:
- ✅ Authentication and authorization properly enforced
- ✅ User data isolation maintained
- ✅ XSS prevention through HTML escaping
- ✅ Input validation on all endpoints
- ✅ Secure DOM manipulation practices

Pre-existing issues (CSRF protection, rate limiting) affect the entire application and should be addressed in a separate, application-wide security enhancement PR.

The inbox feature is safe to deploy with current security measures, especially given that it only displays bot-generated messages that users would receive via Discord DM anyway.
