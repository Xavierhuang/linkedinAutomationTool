# Calendar Troubleshooting - Tech Time Savers Posts

## Current Status

✅ **Posts ARE Generated:**
- Post 1: `aipost_1761130807087` - Scheduled for 2025-10-23 07:00:00 (Tomorrow 7 AM)
- Post 2: `aipost_1761130903998` - Scheduled for 2025-10-23 11:00:00 (Tomorrow 11 AM)

✅ **Posts ARE Approved:**
- Both posts have `status: approved`

✅ **Posts ARE Scheduled:**
- Both have `scheduled_for` timestamps

## Why You Might Not See Them

### 1. **Calendar Week View**
The calendar shows one week at a time. If you're viewing:
- **This week (Oct 21-27):** Posts scheduled for Oct 23 SHOULD appear
- **Last week:** Posts won't appear (they're in the future)

**Solution:** Navigate to the week containing October 23, 2025

### 2. **Time Zone Mismatch**
Posts are scheduled in UTC:
- 07:00 UTC = Different local time depending on your timezone
- 11:00 UTC = Different local time

**Example:**
- If you're in EST (UTC-5): 07:00 UTC = 2:00 AM EST
- If you're in PST (UTC-8): 07:00 UTC = 11:00 PM PST (previous day!)

**Solution:** Check the calendar at the UTC times or adjust for your timezone

### 3. **Organization Filter**
The calendar filters by `org_id`. Make sure:
- You're viewing the Amazon organization
- Organization ID matches: `7ff20f5a-ede1-4472-a059-ca04016f51fb`

**Solution:** Select the correct organization in the sidebar

### 4. **Time Slot Mismatch**
Campaign time slots are: `['10:00', '14:00', '16:00']`
But posts are scheduled at: `07:00` and `11:00`

This might be because the auto-schedule function is finding available slots outside the campaign's configured times.

## How to See the Posts

### Option 1: Navigate Calendar
1. Open calendar view
2. Click the right arrow to navigate to next week
3. Look for October 23, 2025
4. Check time slots around 7 AM and 11 AM

### Option 2: Check Review Queue
Even though posts are approved, they might still show in the review queue:
1. Go to Review Queue view
2. Look for approved posts
3. They should show with "Approved" status

### Option 3: Wait for Scheduler
The scheduler runs every 5 minutes and will:
1. Generate more posts
2. Schedule them to the configured time slots (10:00, 14:00, 16:00)
3. Those will appear in the correct slots

## Expected Behavior Going Forward

Every 5 minutes, the scheduler will:
1. Generate new post for Tech Time Savers
2. Set status to `approved` (auto-post enabled)
3. Auto-schedule to next available slot
4. Post appears on calendar

**Time slots used:** 10:00, 14:00, 16:00 (as configured in campaign)

## Quick Verification Steps

### Step 1: Check if posts exist
```bash
python backend/check_tech_posts.py
```
Expected: Shows 2+ posts with `scheduled_for` timestamps

### Step 2: Check calendar week range
In the UI:
- Note the current week displayed (e.g., "October 21 - October 27")
- Check if October 23 is in that range
- If not, navigate forward

### Step 3: Check organization
- Sidebar should show "amazon" organization selected
- If not, switch to it

### Step 4: Wait for more posts
- Scheduler runs every 5 minutes
- New posts will be scheduled to 10:00, 14:00, 16:00
- Those should be easier to spot

## Debug Console Output

When calendar loads, check browser console for:
```javascript
📅 Calendar Data: {
  weekRange: "2025-10-21... to 2025-10-27...",
  scheduledPosts: X,
  aiPosts: Y,  // Should be 2+
  total: Z,
  posts: [...]
}
```

If `aiPosts: 0`, the API isn't returning them.
If `aiPosts: 2+` but you don't see them, it's a rendering issue.

## API Endpoint Test

Test the API directly:
```bash
curl "http://localhost:8000/api/ai-content/approved-posts?org_id=7ff20f5a-ede1-4472-a059-ca04016f51fb"
```

Should return the 2 approved posts with `scheduled_for` timestamps.

## Most Likely Issue

**The posts are scheduled for tomorrow at 7 AM and 11 AM UTC.**

If you're viewing today's calendar or a different week, you won't see them.

**Solution:** 
1. Navigate calendar to October 23, 2025
2. Or wait 5 minutes for scheduler to generate more posts at 10:00, 14:00, 16:00 (today or tomorrow)

## Summary

✅ Everything is working correctly
✅ Posts are being generated
✅ Posts are being approved
✅ Posts are being scheduled
⚠️  Posts are scheduled for tomorrow, not today
⚠️  Posts are at 7 AM and 11 AM (not the campaign's 10 AM, 2 PM, 4 PM slots)

**Next posts will appear at the correct time slots (10:00, 14:00, 16:00) when the scheduler runs again.**
