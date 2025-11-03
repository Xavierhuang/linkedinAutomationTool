# Calendar & Model Selection Updates

## Summary
Added AI model selection to campaign configuration and updated the calendar to show posted posts with visual indicators and LinkedIn links.

## Changes Made

### 1. Campaign Modal - AI Model Selection

**Location:** `frontend/src/pages/linkedpilot/components/CampaignConfigModal.js`

#### Text Generation Model Selection
Added a new section for selecting the AI model used for text generation:

**Available Models:**
- **OpenAI:**
  - GPT-4o (Best Quality)
  - GPT-4o Mini (Fast & Affordable) ← Default
  - GPT-4 Turbo
  - GPT-3.5 Turbo (Fastest)

- **Anthropic:**
  - Claude 3.5 Sonnet (Latest)
  - Claude 3.5 Haiku (Fast)
  - Claude 3 Opus (Best)

- **Google:**
  - Gemini 2.0 Flash (Latest)
  - Gemini 1.5 Pro
  - Gemini 1.5 Flash

- **Meta:**
  - Llama 3.1 405B
  - Llama 3.1 70B

#### Image Generation Model Selection
Added model selection for image generation (shown when "Generate images with posts" is checked):

**Available Models:**
- **OpenAI:**
  - DALL-E 3 (Best Quality)
  - DALL-E 2 (Faster)

- **Stability AI:**
  - Stable Diffusion XL
  - Stable Diffusion 3

- **Google:**
  - Imagen 2
  - Gemini 2.5 Flash Image ← Default

- **Flux:**
  - Flux 1.1 Pro
  - Flux Dev

**UI Features:**
- Text model selection always visible in a blue-highlighted section
- Image model selection only visible when images are enabled
- Organized by provider with clear labels
- Helper text explaining each model's purpose
- Default values: `openai/gpt-4o-mini` for text, `google/gemini-2.5-flash-image` for images

### 2. Calendar View - Posted Posts Display

**Location:** `frontend/src/pages/linkedpilot/components/CalendarView.js`

#### Key Changes:

**1. Fetch Posted Posts**
- Now fetches posted posts from `/api/posts` endpoint
- Maps posted posts to their scheduled posts using `scheduled_post_id`
- Adds `is_posted`, `platform_url`, and `posted_at` fields to calendar posts

**2. Visual Indicators for Posted Posts**
- **Green Check Badge:** Shows a green circle with checkmark icon
- **Posted Status:** Footer shows "Posted" with green text instead of time
- **LinkedIn Link:** Click the green badge or external link icon to open the LinkedIn post
- **Opacity:** Posted cards have slightly reduced opacity (0.95) to distinguish them

**3. Prevent Dragging Posted Posts**
- Posted posts cannot be dragged/rescheduled
- Cursor changes from `cursor-grab` to `cursor-pointer`
- `draggable` attribute set to `false` for posted posts
- Drag handler prevents drag start for posted posts

**4. Badge Layout**
Two badges can now appear on cards:
- **Green Check Badge** (left): Indicates post is published, clickable to view on LinkedIn
- **LinkedIn Badge** (right): Platform indicator

**5. Footer Updates**
- **Not Posted:** Shows scheduled time (e.g., "09:00")
- **Posted:** Shows "Posted" with green checkmark and external link icon
- External link icon opens LinkedIn post in new tab

#### Visual Design:

```
┌─────────────────────────────────┐
│ [Image with badges in corner]   │
│  ✓ (green)  🔵 (LinkedIn)       │
├─────────────────────────────────┤
│ Post content preview...          │
│                                  │
│ ✓ Posted 🔗        [X Delete]   │
└─────────────────────────────────┘
```

**For non-posted:**
```
┌─────────────────────────────────┐
│ [Image with badge in corner]    │
│  🔵 (LinkedIn)                   │
├─────────────────────────────────┤
│ Post content preview...          │
│                                  │
│ 09:00              [X Delete]   │
└─────────────────────────────────┘
```

## Technical Details

### Campaign Modal State
```javascript
{
  text_model: 'openai/gpt-4o-mini',
  image_model: 'google/gemini-2.5-flash-image',
  // ... other fields
}
```

### Calendar Post Data Structure
```javascript
{
  id: "post-123",
  scheduled_for: "2025-10-22T09:00:00Z",
  content: "Post content...",
  image_url: "https://...",
  is_posted: true,
  platform_url: "https://linkedin.com/feed/update/...",
  posted_at: "2025-10-22T09:05:00Z",
  source: "scheduled" | "ai"
}
```

### API Endpoints Used
1. **Scheduled Posts:** `GET /api/scheduled-posts?org_id={id}&range_start={start}&range_end={end}`
2. **AI Posts:** `GET /api/ai-content/approved-posts?org_id={id}`
3. **Posted Posts:** `GET /api/posts?org_id={id}&range_start={start}&range_end={end}` ← New

## User Experience Improvements

### Campaign Creation
1. Users can now choose specific AI models for text and image generation
2. Models are organized by provider for easy selection
3. Clear labels indicate quality/speed tradeoffs
4. Defaults are set to balanced options (GPT-4o Mini, Gemini Flash Image)

### Calendar Management
1. **Posted posts remain visible** - No longer disappear after posting
2. **Clear visual distinction** - Green badge makes posted posts obvious
3. **Quick access to LinkedIn** - Click badge or link icon to view post
4. **Prevent accidental changes** - Posted posts can't be dragged/rescheduled
5. **Status at a glance** - Footer shows "Posted" vs scheduled time

## Benefits

### For Users:
✅ **Full control** over AI model selection per campaign
✅ **Complete visibility** of all posts (scheduled and posted)
✅ **Easy verification** - Click to view actual LinkedIn posts
✅ **Prevent mistakes** - Can't accidentally reschedule posted content
✅ **Better tracking** - See what's been published vs what's pending

### For Workflow:
✅ **Historical view** - Calendar shows complete posting history
✅ **Performance tracking** - See when posts were actually published
✅ **Audit trail** - Visual record of campaign execution
✅ **Quality control** - Verify posts went live as scheduled

## Testing Checklist

### Campaign Modal:
- [ ] Text model dropdown shows all providers
- [ ] Image model dropdown only appears when images enabled
- [ ] Default values are set correctly
- [ ] Model selection persists when editing campaign
- [ ] Models are saved with campaign data

### Calendar View:
- [ ] Posted posts appear on calendar
- [ ] Green check badge shows on posted posts
- [ ] Clicking badge opens LinkedIn post in new tab
- [ ] Posted posts cannot be dragged
- [ ] Footer shows "Posted" status with link icon
- [ ] Non-posted posts still show scheduled time
- [ ] Delete button works for both posted and scheduled posts

## Future Enhancements

### Potential Additions:
- [ ] Show posting analytics on hover (impressions, reactions)
- [ ] Filter calendar to show only posted/scheduled posts
- [ ] Bulk actions for posted posts (export, report)
- [ ] Post performance indicators (color-coded by engagement)
- [ ] Model performance comparison in campaign analytics
- [ ] Cost estimation based on selected models
- [ ] A/B testing different models within same campaign

## Notes

- Posted posts are fetched from the `/api/posts` endpoint which tracks actual LinkedIn publications
- The `platform_url` field contains the direct link to the LinkedIn post
- Posted status is determined by either `status === 'posted'` on scheduled post or presence in posts table
- Model selection uses provider-prefixed format (e.g., `openai/gpt-4o-mini`)
- Calendar now makes 3 API calls instead of 2 to include posted posts
