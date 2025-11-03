# LinkedIn Analytics Implementation

## Overview
This document describes the implementation of real-time LinkedIn analytics fetching for organization posts using the LinkedIn Marketing API with `r_organization_social` and `r_organization_admin` scopes.

## Your LinkedIn API Permissions
You have the following OAuth 2.0 scopes approved:
- ✅ `r_organization_social` - Retrieve your organization's posts, comments, reactions, and other engagement data
- ✅ `r_organization_admin` - Retrieve your organization's pages and their reporting data
- ✅ `w_organization_social` - Create, modify, and delete posts on your organization's behalf
- ✅ Other scopes: `openid`, `profile`, `email`, `r_ads_reporting`, `rw_organization_admin`, `w_member_social`, `r_ads`, `rw_ads`, `r_basicprofile`, `r_1st_connections_size`

## API Endpoints Used

### Priority 1: organizationalEntityShareStatistics (Recommended)
**Endpoint**: `/v2/organizationalEntityShareStatistics`
**Reference**: [Microsoft LinkedIn Share Statistics API](https://docs.microsoft.com/linkedin/marketing/integrations/community-management/organizations/share-statistics)

**Usage**:
```http
GET /v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:{ID}&shares=List({POST_URN})
Headers:
  Authorization: Bearer {ACCESS_TOKEN}
  LinkedIn-Version: 202410
  X-Restli-Protocol-Version: 2.0.0
```

**Response Data**:
- `totalShareStatistics.impressionCount` - Total impressions
- `totalShareStatistics.uniqueImpressionsCount` - Unique impressions
- `totalShareStatistics.likeCount` - Total reactions
- `totalShareStatistics.commentCount` - Total comments
- `totalShareStatistics.shareCount` - Total shares
- `totalShareStatistics.clickCount` - Total clicks

### Priority 2: organizationShareStatistics (Fallback)
**Endpoint**: `/v2/organizationShareStatistics`

**Usage**:
```http
GET /v2/organizationShareStatistics?q=share&share={POST_URN}
Headers:
  Authorization: Bearer {ACCESS_TOKEN}
  LinkedIn-Version: 202410
  X-Restli-Protocol-Version: 2.0.0
```

### Priority 3: socialActions (Engagement Data)
**Endpoint**: `/v2/socialActions/{POST_URN}`

**Usage**:
```http
GET /v2/socialActions/{POST_URN}
Headers:
  Authorization: Bearer {ACCESS_TOKEN}
  LinkedIn-Version: 202410
  X-Restli-Protocol-Version: 2.0.0
```

**Reaction Types Captured**:
- `likeCount` - Like reactions
- `praiseCount` - Celebrate reactions
- `empathyCount` - Support reactions
- `interestCount` - Love reactions
- `appreciationCount` - Insightful reactions
- `entertainmentCount` - Funny reactions

### Priority 4: ugcPosts (Legacy)
**Endpoint**: `/v2/ugcPosts/{SHARE_ID}`

## Implementation Files

### Backend
1. **`backend/linkedpilot/adapters/linkedin_adapter.py`**
   - `get_post_analytics(access_token, post_urn, organization_id)` - Main analytics fetching method
   - Tries 4 different API endpoints in priority order
   - Returns normalized analytics dict with: impressions, reactions, comments, shares, clicks

2. **`backend/linkedpilot/routes/posts.py`**
   - `/api/posts/sync-all-analytics` - Syncs analytics for all published posts
   - Fetches posts from 3 collections: posts, scheduled_posts, ai_generated_posts
   - Updates each post with latest analytics data

### Frontend
3. **`frontend/src/pages/linkedpilot/components/AnalyticsView.js`**
   - `syncAnalytics()` - Triggers backend sync
   - `fetchAnalytics()` - Aggregates analytics from all post collections
   - Displays: Total Posts, Impressions, Reactions, Comments, Shares, Clicks

## How to Use

### 1. Sync Analytics
Click the "Sync Analytics" button in the Analytics page to fetch latest data from LinkedIn:

```javascript
const syncAnalytics = async () => {
  const response = await axios.post(
    `${BACKEND_URL}/api/posts/sync-all-analytics?org_id=${orgId}`
  );
  // Analytics are now updated in database
};
```

### 2. View Analytics
The analytics page automatically aggregates data from all published posts:
- Manual posts (posts collection)
- Scheduled posts (scheduled_posts collection, status=published)
- AI-generated posts (ai_generated_posts collection, status=posted)

### 3. API Response Format
```json
{
  "impressions": 5234,
  "reactions": 187,
  "comments": 23,
  "shares": 12,
  "clicks": 456
}
```

## Data Flow
```
Frontend (Analytics Page)
    ↓
    Click "Sync Analytics" button
    ↓
Backend (/api/posts/sync-all-analytics)
    ↓
    Query MongoDB for all published posts
    ↓
LinkedIn Adapter (get_post_analytics)
    ↓
    Try Priority 1: organizationalEntityShareStatistics
    ↓ (if fail)
    Try Priority 2: organizationShareStatistics
    ↓ (if fail)
    Try Priority 3: socialActions
    ↓ (if fail)
    Try Priority 4: ugcPosts
    ↓
    Return analytics data
    ↓
Update MongoDB collections
    ↓
Frontend refreshes and displays updated data
```

## Testing
1. Log in to your application
2. Navigate to Analytics page
3. Click "Sync Analytics" button
4. Check browser console for detailed API logs
5. View updated metrics in the dashboard

## Troubleshooting

### No Analytics Returned (All Zeros)
**Possible Causes**:
1. Post was recently published - LinkedIn analytics may take 24-48 hours to populate
2. Post has genuinely zero engagement
3. Access token doesn't have correct scopes
4. Organization ID not properly stored in database

**Solution**: Check backend logs for API response details:
```bash
pm2 logs linkedin-pilot-backend
```

### 403 Forbidden Errors
**Cause**: Missing or incorrect OAuth scopes

**Solution**: 
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Verify "Community Management API" and "Marketing Developer Platform" products are approved
3. Reconnect LinkedIn account to get updated tokens

### Analytics Take Long Time
**Cause**: Syncing hundreds of posts

**Solution**: The sync runs asynchronously. Check backend logs for progress.

## References
- [LinkedIn Share Statistics API](https://docs.microsoft.com/linkedin/marketing/integrations/community-management/organizations/share-statistics)
- [LinkedIn Community Management API](https://docs.microsoft.com/linkedin/marketing/integrations/community-management)
- [LinkedIn Marketing API](https://docs.microsoft.com/linkedin/marketing/)
- [LinkedIn OAuth 2.0](https://docs.microsoft.com/linkedin/shared/authentication/authentication)

## Notes
- Analytics data is cached in MongoDB to reduce API calls
- Sync button manually refreshes data from LinkedIn
- Real-time analytics require `r_organization_social` scope
- Organization ID improves analytics accuracy (automatically used when available)


