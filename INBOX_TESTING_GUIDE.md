# Website Inbox Feature - Testing Guide

## Overview
This document describes how to test the new Website Inbox feature that displays direct messages sent by the Guild Helper Discord bot to users inside the website dashboard.

## Prerequisites
1. Guild Helper bot and website server running
2. MongoDB database connection configured
3. User logged into the website dashboard

## Testing Steps

### 1. Test Inbox Tab Visibility
1. Log into the website dashboard at `/profile`
2. Verify the "Inbox" tab appears in the sidebar navigation
3. Check that the tab has an envelope icon
4. Verify that an unread badge (red circle) appears if there are unread messages

### 2. Test Bot Message Creation (Manual API Test)

You can test the bot inbox endpoint using curl or a tool like Postman:

```bash
curl -X POST http://localhost:3001/api/bot/inbox \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -d '{
    "discord_user_id": "USER_DISCORD_ID",
    "title": "Test Message",
    "content": "This is a test message from the bot",
    "type": "system",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

**Note:** Replace:
- `YOUR_BOT_TOKEN` with the value from `process.env.BOT_INBOX_TOKEN` or `process.env.DISCORD_TOKEN`
- `USER_DISCORD_ID` with a valid Discord user ID that exists in the database

Expected response:
```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439011"
}
```

### 3. Test Inbox Display
1. Click on the "Inbox" tab in the sidebar
2. Verify that messages are displayed with:
   - Message type badge (System/Support/Reward/Warning)
   - Timestamp (relative time like "2 hours ago")
   - Message preview (first 100 characters)
   - Unread indicator (purple dot) for unread messages
3. Unread messages should have a purple left border and slightly highlighted background

### 4. Test Message Filters
1. In the inbox tab, click on different filter buttons:
   - All
   - System
   - Support
   - Rewards
   - Warnings
2. Verify that only messages of the selected type are displayed
3. The active filter should be highlighted in purple

### 5. Test Reading Messages
1. Click on any unread message
2. Verify that a toast notification appears showing the full message content
3. The message should now be marked as read (no purple dot)
4. The unread count badge should decrease by 1
5. Refresh the page and verify the message remains marked as read

### 6. Test Mark All as Read
1. Ensure there are multiple unread messages
2. Click the "Mark All Read" button at the top of the inbox
3. Verify all messages are marked as read
4. The unread count badge should show 0 and disappear

### 7. Test Delete Message
1. Click on a message to open it
2. In the toast notification, click the "Delete" button
3. Confirm the deletion when prompted
4. Verify the message is removed from the inbox list
5. The unread count should update if the message was unread

### 8. Test Unread Count Badge
1. The unread count badge should appear on the Inbox tab in the sidebar
2. It should show the current number of unread messages
3. It should update immediately when:
   - A message is marked as read
   - A message is deleted
   - New messages arrive (requires page refresh)

### 9. Test Responsive Design
1. Resize the browser window to mobile size (< 768px)
2. Verify the inbox displays correctly on mobile
3. Check that filters scroll horizontally on small screens
4. Verify messages are readable and clickable

### 10. Test Security

#### Session Validation
1. Log out of the website
2. Try to access `/api/inbox/messages` directly
3. Should return 401 Unauthorized

#### Bot Token Validation
1. Try to send a message without the Authorization header:
```bash
curl -X POST http://localhost:3001/api/bot/inbox \
  -H "Content-Type: application/json" \
  -d '{
    "discord_user_id": "USER_ID",
    "content": "Test"
  }'
```
Expected: 401 Unauthorized

2. Try with an invalid token:
```bash
curl -X POST http://localhost:3001/api/bot/inbox \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{
    "discord_user_id": "USER_ID",
    "content": "Test"
  }'
```
Expected: 401 Unauthorized

#### User Isolation
1. Log in as User A
2. Note a message ID from User A's inbox
3. Log in as User B
4. Try to mark User A's message as read using the API
5. Should fail - users can only access their own messages

## Integration Testing with Bot

To test the full integration with the bot, you need to modify bot code to send inbox messages. See `INBOX_INTEGRATION_EXAMPLES.js` for code examples.

### Example Integration Test
1. Modify `src/features/parties/commands/remindparty.js` to add inbox messages
2. Run the `/remindparty` command in Discord
3. Log into the website dashboard
4. Go to the Inbox tab
5. Verify you received the party reminder message

## Database Verification

You can verify messages are being stored correctly in MongoDB:

```javascript
// Connect to MongoDB
use guildhelper

// List all inbox messages
db.inboxMessages.find().pretty()

// Check indexes
db.inboxMessages.getIndexes()

// Count unread messages for a user
db.inboxMessages.countDocuments({ userId: "USER_ID", isRead: false })

// Find messages by type
db.inboxMessages.find({ messageType: "system" }).pretty()
```

## Expected Database Schema

Each inbox message should have these fields:
```javascript
{
  _id: ObjectId("..."),
  userId: "123456789012345678", // Discord user ID
  discordUserId: "123456789012345678",
  messageTitle: "Test Message", // Optional
  messageContent: "This is the message content",
  messageType: "system", // system, support, reward, warning
  messageTimestamp: ISODate("2024-01-01T00:00:00.000Z"),
  isRead: false,
  createdAt: ISODate("2024-01-01T00:00:00.000Z"),
  readAt: ISODate("2024-01-01T00:01:00.000Z") // Only present if read
}
```

## Common Issues and Troubleshooting

### Issue: Inbox tab doesn't appear
- Check browser console for JavaScript errors
- Verify profile-dashboard.ejs was updated correctly
- Clear browser cache and reload

### Issue: No messages displayed
- Check that the user exists in the `partyPlayers` collection
- Verify the Discord user ID matches between collections
- Check MongoDB logs for errors
- Check browser Network tab for API errors

### Issue: Unread count not updating
- Check browser console for errors
- Verify `/api/inbox/unread-count` endpoint is accessible
- Check that JavaScript `updateUnreadCount()` is being called

### Issue: Bot token authentication fails
- Verify `BOT_INBOX_TOKEN` or `DISCORD_TOKEN` environment variable is set
- Check that the token in the Authorization header matches
- Ensure the header format is `Bearer YOUR_TOKEN`

### Issue: Messages not saved when bot sends DMs
- Verify the inbox helper is imported and called in bot code
- Check that the user exists in the database
- Look for error logs in bot console
- Verify the collections object is passed to the helper function

## Performance Considerations

- The inbox loads messages on tab switch, not on page load
- A maximum of 100 messages are fetched by default
- Unread count is fetched separately and cached
- Message filters work client-side after fetching all messages
- Consider adding pagination for users with many messages

## Future Enhancements

Possible improvements for future versions:
- Real-time notifications using WebSocket
- Pagination for large message lists
- Search/filter by date range
- Bulk delete operations
- Message categories/folders
- Mark as unread functionality
- Email notifications for important messages
- Export messages to file
