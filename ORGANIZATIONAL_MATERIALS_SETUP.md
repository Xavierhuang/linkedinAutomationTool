# Organizational Materials System - Setup Guide

## Overview

The Organizational Materials system automatically analyzes your company's digital assets (website, PDFs, images, blogs) to extract brand insights and generate complete LinkedIn campaigns with AI.

## Installation

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Key new dependencies:
- `beautifulsoup4` - Web scraping
- `aiofiles` - Async file operations
- `python-docx` - Word document processing
- `PyPDF2` - PDF text extraction
- `pdfplumber` - Advanced PDF extraction (fallback)
- `aiohttp` - Async HTTP requests

### 2. Configure API Keys

The system requires an AI API key for analysis. Configure in Settings > API Providers:

**Option 1: OpenRouter (Recommended)**
- Supports multiple models (Claude, GPT-4, Gemini)
- Add `openrouter_api_key` in settings

**Option 2: OpenAI**
- Direct OpenAI access
- Add `openai_api_key` in settings

**Option 3: Google AI Studio**
- Google's Gemini models
- Add `google_ai_api_key` in settings

### 3. Create Upload Directory

```bash
mkdir -p backend/uploads/materials
```

## Usage

### Step 1: Add Materials

1. Navigate to **Campaigns** tab
2. Click **"Organizational Materials"** button
3. Upload materials:
   - **PDFs**: Company brochures, whitepapers, presentations
   - **Images**: Brand assets, infographics, product images
   - **Documents**: .txt, .doc, .docx files
   - **URLs**: Company website, blog posts, about pages

### Step 2: Analyze Materials

1. Click **"Analyze & Generate Insights"** button
2. System will:
   - Extract content from all materials
   - Analyze brand tone, voice, and messaging
   - Identify target audience
   - Generate content pillars
   - Suggest 5 campaign ideas

Analysis takes 10-30 seconds depending on material count.

### Step 3: Generate Campaign

1. Review suggested campaigns in the analysis results
2. Click **"Generate"** on any suggested campaign
3. System creates a complete campaign with:
   - Target audience (job titles, industries, interests)
   - Content pillars (6-8 topics)
   - Posting schedule (frequency + time slots)
   - Tone and voice settings
   - Image generation settings
   - 10 draft post ideas

Campaign is saved as "Draft" and ready for content generation.

## What Gets Analyzed

### From Websites/Blogs
- Page titles and meta descriptions
- Main content (articles, about pages)
- Value propositions
- Target audience indicators
- Brand messaging

### From PDFs
- Text content (up to 50 pages)
- Headings and structure
- Key messages
- Product/service descriptions

### From Images
- Visual brand elements (colors, style)
- Text in images (logos, slogans)
- Product/service visuals
- Brand personality indicators

### From Documents
- Text content
- Company information
- Messaging and positioning

## Generated Campaign Structure

The system generates campaigns that map directly to your LinkedIn Campaign model:

```javascript
{
  name: "Q1 Thought Leadership Campaign",
  description: "Establish industry expertise through insights",
  
  // Audience targeting
  target_audience: {
    job_titles: ["CEO", "Marketing Director", "VP Sales"],
    industries: ["Technology", "SaaS", "B2B"],
    interests: ["Innovation", "Leadership", "Growth"]
  },
  
  // Content strategy
  content_pillars: [
    "Industry Insights",
    "Thought Leadership",
    "Customer Success",
    "Product Innovation"
  ],
  
  // Posting configuration
  posting_schedule: {
    frequency: "weekly",
    time_slots: ["09:00", "14:00"]
  },
  
  // Style and tone
  tone_voice: "professional",
  content_types: ["text", "article"],
  
  // Image generation
  include_images: true,
  image_style: "professional",
  
  // Duration
  duration: {
    start_date: "2025-10-21",
    end_date: "2026-01-21"  // 12 weeks
  },
  
  status: "draft"
}
```

## Best Practices

### Material Selection

**Do Include:**
- Company website homepage and about page
- Recent blog posts (3-5 posts)
- Product/service pages
- Brand guidelines or style guides
- Customer case studies
- Company presentations

**Avoid:**
- Legal documents (privacy policies, terms)
- Technical documentation (unless relevant)
- Internal-only materials
- Outdated content (>2 years old)

### Optimal Material Count

- **Minimum**: 3-5 materials for basic analysis
- **Recommended**: 8-12 materials for comprehensive insights
- **Maximum**: 50 materials (system processes up to 100)

### Content Quality

Better materials = better campaigns:
- Clear brand messaging
- Well-defined target audience
- Consistent tone and voice
- Recent and relevant content

## Troubleshooting

### "No API key configured"
- Go to Settings > API Providers
- Add OpenRouter, OpenAI, or Google AI key
- Save settings and try again

### "Analysis failed"
- Check that materials uploaded successfully
- Verify API key is valid
- Check backend logs for specific errors
- Try with fewer materials first

### "Content extraction failed"
- For PDFs: Ensure they contain extractable text (not scanned images)
- For websites: Check URL is accessible
- For images: Requires vision-capable API key

### Poor Analysis Quality
- Add more diverse materials
- Include website + blog + documents
- Ensure materials clearly communicate brand identity
- Re-run analysis after adding more materials

## API Endpoints

### Upload Material
```bash
POST /api/organization-materials/upload
Content-Type: multipart/form-data

Form Data:
  org_id: "your-org-id"
  file: <file>
```

### Add URL
```bash
POST /api/organization-materials/add-url?org_id=your-org-id&url=https://example.com&material_type=website
```

### Analyze Materials
```bash
POST /api/organization-materials/analyze?org_id=your-org-id
```

### Generate Campaign
```bash
POST /api/organization-materials/generate-campaign
Content-Type: application/json

{
  "org_id": "your-org-id",
  "campaign_name": "Q1 Campaign",
  "focus_area": "Thought leadership",
  "use_analysis": true
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│              (OrganizationMaterialsModal)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Organization Materials API                  │
│         (organization_materials.py routes)               │
└────────┬──────────────────────────┬─────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐      ┌──────────────────────┐
│ Content          │      │ Campaign             │
│ Extractor        │      │ Generator            │
│                  │      │                      │
│ - Web scraping   │      │ - AI analysis        │
│ - PDF extraction │      │ - Campaign config    │
│ - Image analysis │      │ - Post ideas         │
│ - Doc processing │      │ - Audience targeting │
└──────────────────┘      └──────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                    LLM Adapter                           │
│         (OpenRouter / OpenAI / Google AI)                │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    MongoDB Database                      │
│  - organization_materials                                │
│  - brand_analysis                                        │
│  - campaigns                                             │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

- Files stored in `backend/uploads/materials/` with unique names
- File size limits enforced by FastAPI
- API keys stored securely in database
- Content extraction limited to prevent abuse
- No execution of uploaded files

## Performance

- **Upload**: < 1 second per file
- **Content Extraction**: 1-5 seconds per material
- **Analysis**: 10-30 seconds for 5-10 materials
- **Campaign Generation**: 5-15 seconds

## Future Enhancements

- Real-time extraction progress indicators
- Batch material upload
- Automatic material refresh
- Competitor analysis
- Social media profile analysis
- Video content analysis
- Multi-language support
- Campaign performance feedback loop

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Verify API key configuration
3. Test with minimal materials first
4. Check network connectivity for URL materials

## License

Part of LinkedPilot - LinkedIn Campaign Management System
