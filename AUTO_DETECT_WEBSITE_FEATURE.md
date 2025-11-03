# 🎯 Auto-Detect Organization Website Feature

## What It Does

When you open the Organizational Materials modal, the system automatically detects if your organization has a website URL and offers to add it as a material with one click.

## How It Works

### 1. Detection
- When you click the "Materials" button on an organization
- System checks if the organization has a website URL
- Checks if that website is already added as a material
- If not added, shows a suggestion banner

### 2. Suggestion Banner

You'll see a green banner at the top of the modal:

```
┌────────────────────────────────────────────────────────┐
│ 🌐 Organization Website Detected                       │
│                                                         │
│ We found your organization's website:                  │
│ https://manditutors.com/                               │
│                                                         │
│ Add it as a material to help AI analyze your brand    │
│ and generate better campaigns.                         │
│                                                         │
│ [Add Website]  [Dismiss]                               │
└────────────────────────────────────────────────────────┘
```

### 3. One-Click Add
- Click **"Add Website"** button
- Website is automatically added as a material
- Banner disappears
- Website appears in your materials list
- Ready to analyze!

## User Journey

### Before (Manual)
1. Open Materials modal
2. Click "Add Website or Blog URL"
3. Type or paste your website URL
4. Select "Website" type
5. Click Add

**5 steps, manual typing required**

### After (Auto-Detect)
1. Open Materials modal
2. See suggestion banner
3. Click "Add Website"

**3 steps, no typing needed!** ✨

## Benefits

✅ **Faster**: One click instead of 5 steps
✅ **No Typing**: No need to copy/paste URL
✅ **No Errors**: Uses exact URL from organization
✅ **Smart**: Only shows if website not already added
✅ **Dismissible**: Can dismiss if you don't want to add it

## Example Scenario

**Your Organization:**
- Name: Mandi Tutors
- Website: https://manditutors.com/

**When You Open Materials Modal:**

1. **First Time:**
   - Green banner appears
   - "We found your organization's website: https://manditutors.com/"
   - Click "Add Website"
   - Website added automatically

2. **Second Time:**
   - No banner (website already added)
   - Website appears in materials list
   - Ready to analyze or add more materials

## Technical Details

### Detection Logic
```javascript
1. Check if organization.website exists
2. Fetch existing materials for this org
3. Check if any material URL matches organization.website
4. If no match found, show suggestion banner
5. If match found, hide banner
```

### URL Matching
The system handles URL variations:
- `https://example.com`
- `https://example.com/`
- `http://example.com`

All are treated as the same website.

## What Happens When You Click "Add Website"

1. **API Call**: `POST /api/organization-materials/add-url`
2. **Parameters**:
   - `org_id`: Your organization ID
   - `url`: Organization website URL
   - `material_type`: "website"
3. **Result**: Material created with status "pending"
4. **UI Update**: 
   - Banner disappears
   - Materials list refreshes
   - Website appears in list
   - Success message shown

## After Adding

Once the website is added:

1. **Appears in Materials List**
   ```
   🌐 https://manditutors.com/
   Website • pending
   [Delete]
   ```

2. **Ready for Analysis**
   - Click "Analyze & Generate Insights"
   - AI will scrape and analyze your website
   - Extract brand tone, messaging, audience
   - Generate campaign suggestions

3. **Can Add More**
   - Add blog posts
   - Upload PDFs
   - Add images
   - Then analyze all together

## Dismissing the Banner

If you click **"Dismiss"**:
- Banner disappears for this session
- Will reappear next time you open the modal
- Website is NOT added
- You can still add it manually later

## Edge Cases Handled

✅ **No Website**: If organization has no website, no banner shown
✅ **Already Added**: If website already added, no banner shown
✅ **Multiple Opens**: Banner shows each time until website is added
✅ **URL Variations**: Handles trailing slashes and protocol differences
✅ **Loading State**: Shows "Adding..." while processing
✅ **Error Handling**: Shows error message if add fails

## Integration with Analysis

After adding your website:

1. **Click "Analyze & Generate Insights"**
2. **AI Extracts**:
   - Page titles and meta descriptions
   - Main content
   - Value propositions
   - Target audience indicators
   - Brand messaging

3. **Generates**:
   - Brand tone and voice
   - Target audience profile
   - Content pillars
   - 5 campaign suggestions

4. **One-Click Campaign**:
   - Click "Generate" on any suggestion
   - Complete campaign created
   - Ready to use!

## Best Practice

**Recommended Flow:**

1. **Open Materials Modal**
2. **Click "Add Website"** (one click!)
3. **Add 2-3 blog posts** (if you have them)
4. **Upload any PDFs** (brochures, presentations)
5. **Click "Analyze & Generate Insights"**
6. **Review suggestions**
7. **Click "Generate" on best campaign**

**Total Time: 2-3 minutes from start to complete campaign!**

## Visual Guide

```
Organizations Tab
    ↓
Click "Materials" Button
    ↓
Modal Opens
    ↓
┌─────────────────────────────────────┐
│ 🌐 Website Detected Banner          │ ← Auto-detected!
│ [Add Website] [Dismiss]             │
└─────────────────────────────────────┘
    ↓
Click "Add Website"
    ↓
Website Added Automatically
    ↓
Ready to Analyze!
```

## Comparison

### Without Auto-Detect
```
1. Open modal
2. Click "Add Website or Blog URL"
3. Copy organization website
4. Paste into input field
5. Select "Website" type
6. Click Add button
```
**Time: 30-60 seconds**

### With Auto-Detect
```
1. Open modal
2. Click "Add Website"
```
**Time: 2 seconds** ⚡

**30x faster!**

## Future Enhancements

Potential improvements:
- [ ] Auto-detect blog URLs from website
- [ ] Suggest social media profiles
- [ ] Auto-import from LinkedIn company page
- [ ] Detect and suggest competitor websites
- [ ] Auto-refresh website content periodically

---

**The auto-detect feature makes it incredibly easy to get started with AI-powered campaign generation!** 🎉
