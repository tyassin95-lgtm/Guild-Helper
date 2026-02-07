# Visual Design - Inbox Feature UI

## Overview
This document describes the visual appearance of the implemented inbox feature.

## Sidebar Navigation

### Inbox Tab Button
```
┌─────────────────────────────┐
│  📧 Inbox              [3]  │  ← Red badge with unread count
└─────────────────────────────┘
```

**Appearance:**
- Envelope icon (📧)
- "Inbox" label text
- Red circular badge showing unread count (when > 0)
- Purple highlight when active
- Smooth hover transition

## Inbox Tab Content

### Header Section
```
┌────────────────────────────────────────────────────┐
│  Your Inbox                     [Mark All Read]    │
└────────────────────────────────────────────────────┘
```

**Appearance:**
- H2 title "Your Inbox"
- "Mark All Read" button (right-aligned, secondary style)
- Button only visible when unread messages exist

### Filter Bar
```
┌────────────────────────────────────────────────────┐
│  [All] [System] [Support] [Rewards] [Warnings]    │
└────────────────────────────────────────────────────┘
```

**Appearance:**
- Horizontal button row
- Active filter highlighted in purple
- Inactive filters: dark gray background
- Smooth hover effects
- Horizontal scroll on mobile

## Message List

### Unread Message Example
```
┌────────────────────────────────────────────────────┐
│  ║ [SYSTEM]                           2 hours ago  │
│  ║ Party Info Setup Reminder                   •  │
│  ║ You haven't set up your party informatio...    │
└────────────────────────────────────────────────────┘
```

**Visual Details:**
- **Purple left border (4px)** - Indicates unread
- **Purple dot (•)** on right - Unread indicator with glow
- **Light purple background** - Subtle highlight
- **Type badge**: Blue for System, Green for Support, Gold for Reward, Red for Warning
- **Hover effect**: Lifts slightly with shadow
- **Cursor**: Pointer (clickable)

### Read Message Example
```
┌────────────────────────────────────────────────────┐
│  [SUPPORT]                         1 day ago      │
│  Guild Support Request Approved                   │
│  Your guild support request has been approve...   │
└────────────────────────────────────────────────────┘
```

**Visual Details:**
- No left border or purple background
- No unread dot
- Same hover effects
- Slightly muted text color

### Message Type Badges

#### System (Blue)
```
[SYSTEM]  ← Blue background (#60a5fa), rounded corners
```

#### Support (Green)
```
[SUPPORT] ← Green background (#4ade80), rounded corners
```

#### Reward (Gold)
```
[REWARD]  ← Gold background (#fbbf24), rounded corners
```

#### Warning (Red)
```
[WARNING] ← Red background (#f87171), rounded corners
```

## Full Message View (Toast)

When a message is clicked, it expands in a toast notification:

```
┌────────────────────────────────────────────────────┐
│  [SYSTEM]                           Jan 15, 2024   │
│                                                     │
│  Party Info Setup Reminder                         │
│                                                     │
│  You haven't set up your party information yet!    │
│  Please use the /myinfo command in Discord to      │
│  set up your weapons, CP, and gear check.          │
│                                                     │
│  This helps us organize parties better!            │
│                                                     │
│                              [Delete] ←           │
└────────────────────────────────────────────────────┘
```

**Visual Details:**
- Large toast notification (info style)
- Full message content (not truncated)
- Message title in bold (if present)
- Type badge and timestamp
- Delete button (red, right-aligned)
- 10-second auto-dismiss (or manual close)

## Empty State

When no messages match filter:

```
┌────────────────────────────────────────────────────┐
│                                                     │
│                 No messages to display              │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Visual Details:**
- Centered text
- Muted gray color
- Padding for visual balance

## Responsive Design

### Desktop (> 768px)
- Sidebar: 280px width, fixed position
- Inbox content: Full width with left margin
- Filters: Horizontal row
- Messages: Full width cards

### Mobile (≤ 768px)
- Sidebar: Slide-out drawer
- Inbox content: Full width
- Filters: Horizontal scroll
- Messages: Stacked, full width
- Badge: Smaller, repositioned

## Color Palette

### Dark Theme Colors
- **Background Primary**: `#0a0e17` (dark blue-black)
- **Background Secondary**: `#111827` (sidebar)
- **Card Background**: `#1a1f2e` (message cards)
- **Accent Purple**: `#8b5cf6` (primary actions)
- **Text Primary**: `#f3f4f6` (white-ish)
- **Text Secondary**: `#9ca3af` (gray)
- **Border Color**: `#2d3748` (subtle gray)

### Message Type Colors
- **System**: Blue `#60a5fa`
- **Support**: Green `#4ade80`
- **Reward**: Gold `#fbbf24`
- **Warning**: Red `#f87171`

## Animations

### Hover Effects
- Messages lift 2px with shadow
- Smooth 0.2s transition
- Border color changes to purple

### Badge
- Unread badge pulses subtly
- Purple glow effect
- Smooth fade in/out when count changes

### Toast
- Slides in from top
- Fades out after 10 seconds
- Smooth transitions

## Typography

- **Titles**: 16-18px, bold, white
- **Body Text**: 14px, regular, light gray
- **Time Stamps**: 12px, muted gray
- **Badges**: 11px, uppercase, bold

## Accessibility

- High contrast text
- Clear focus states
- Keyboard navigation supported
- Screen reader friendly labels
- Touch-friendly tap targets (mobile)

## Screenshots Location

(Note: Actual screenshots would be generated when the application runs)

To generate screenshots:
1. Start the Guild Helper server
2. Log into the dashboard
3. Navigate to the Inbox tab
4. Take screenshots of:
   - Sidebar with unread badge
   - Empty inbox
   - Inbox with mixed read/unread messages
   - Filtered view (e.g., only System messages)
   - Full message view (toast)
   - Mobile responsive view

## Design Consistency

The inbox feature matches the existing Guild Helper dashboard design:
- ✅ Same color scheme and variables
- ✅ Consistent button styles
- ✅ Matching card layouts
- ✅ Sidebar integration seamless
- ✅ Typography consistent
- ✅ Animation patterns match
- ✅ Responsive behavior aligned

---

**Note**: This is a text-based visual representation. For actual visual confirmation, run the application and navigate to the Inbox tab.
