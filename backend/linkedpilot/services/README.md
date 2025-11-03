# Organizational Materials & AI Campaign Generation

## Overview

This system automatically analyzes company materials (websites, PDFs, images, blogs) to extract brand insights and generate complete LinkedIn campaigns with structured data.

## Features

### 1. Content Extraction (`content_extractor.py`)

Extracts and processes content from multiple sources:

- **Websites & Blogs**: Scrapes and extracts main content, titles, meta descriptions
- **PDFs**: Extracts text using PyPDF2 or pdfplumber
- **Images**: Analyzes images using vision AI models (GPT-4 Vision, Claude Vision)
- **Documents**: Processes .txt, .doc, .docx files

### 2. Brand Analysis

AI analyzes extracted content to identify:

- **Brand Identity**
  - Brand tone (professional, innovative, friendly, etc.)
  - Brand voice (professional, casual, thought-leader, storytelling)
  - Key messages and value propositions

- **Audience Insights**
  - Target job titles (8-12 specific roles)
  - Industries (5-8 industries)
  - Professional interests (8-12 interests)
  - Pain points they solve (5-8 problems)

- **Content Strategy**
  - Content pillars (6-8 main topics)
  - Expert segments to target (6-10 types)
  - Posting themes (8-12 recurring themes)
  - Suggested campaigns (5 campaign ideas)

### 3. Campaign Generation (`campaign_generator.py`)

Generates complete campaign configurations that map directly to the Campaign model:

**Generated Fields:**
- `name`: Campaign name
- `description`: 2-3 sentence description
- `content_pillars`: 4-6 selected pillars
- `target_audience`: Refined audience with job titles, industries, interests
- `tone_voice`: Professional, casual, thought-leader, or storytelling
- `posting_schedule`: Frequency and optimal time slots
- `content_types`: Text, article, poll, carousel
- `include_images`: Whether to generate AI images
- `image_style`: Professional, creative, minimalist, bold
- `duration`: Start and end dates
- `status`: Draft (ready for review)

**Additional Outputs:**
- 10 specific post ideas aligned with pillars
- Expert targets for engagement
- Hashtag strategy (8-12 hashtags)
- Engagement tactics
- Success metrics to track

## API Endpoints

### Upload Material
```
POST /api/organization-materials/upload
Form Data:
  - org_id: string
  - file: File (PDF, image, document)
```

### Add URL Material
```
POST /api/organization-materials/add-url
Params:
  - org_id: string
  - url: string
  - material_type: "website" | "blog"
```

### Extract Content
```
POST /api/organization-materials/extract-content/{material_id}
```

### Analyze Materials
```
POST /api/organization-materials/analyze
Params:
  - org_id: string

Returns: BrandAnalysis object
```

### Generate Campaign
```
POST /api/organization-materials/generate-campaign
Body:
  {
    "org_id": "string",
    "campaign_name": "string",
    "focus_area": "string (optional)",
    "use_analysis": true
  }

Returns: Complete Campaign object (saved to database)
```

## Usage Flow

1. **Upload Materials**
   - User uploads PDFs, images, documents
   - User adds website/blog URLs
   - System stores materials with status "pending"

2. **Extract Content**
   - System extracts text/content from each material
   - For images: Uses vision AI to analyze
   - For websites: Scrapes main content
   - For PDFs: Extracts text from pages
   - Status updated to "analyzed"

3. **Analyze Brand**
   - AI analyzes all extracted content
   - Generates comprehensive brand insights
   - Saves BrandAnalysis to database
   - Suggests 5 campaign ideas

4. **Generate Campaign**
   - User selects a suggested campaign or creates custom
   - AI generates complete campaign configuration
   - Maps to Campaign model fields
   - Saves campaign to database (status: draft)
   - Ready for content generation

## Data Models

### OrganizationMaterial
```python
{
  "id": "uuid",
  "org_id": "string",
  "type": "website|pdf|image|blog|document",
  "name": "string",
  "url": "string (optional)",
  "file_path": "string (optional)",
  "content": "string (extracted)",
  "status": "pending|analyzing|analyzed|failed"
}
```

### BrandAnalysis
```python
{
  "id": "uuid",
  "org_id": "string",
  "brand_tone": ["professional", "innovative"],
  "brand_voice": "professional",
  "key_messages": ["message1", "message2"],
  "value_propositions": ["value1", "value2"],
  "target_audience": {
    "job_titles": ["CEO", "Director"],
    "industries": ["Tech", "SaaS"],
    "interests": ["Innovation"],
    "pain_points": ["Challenge1"]
  },
  "content_pillars": ["Pillar1", "Pillar2"],
  "expert_segments": ["Leaders", "Experts"],
  "posting_themes": ["Theme1", "Theme2"],
  "suggested_campaigns": [
    {
      "name": "Campaign Name",
      "description": "Description",
      "focus": "Focus area",
      "duration_weeks": 12
    }
  ],
  "confidence_score": 0.85,
  "materials_analyzed": ["material_id1", "material_id2"]
}
```

### Campaign (Generated)
```python
{
  "id": "uuid",
  "org_id": "string",
  "name": "string",
  "description": "string",
  "target_audience": {
    "job_titles": ["string"],
    "industries": ["string"],
    "interests": ["string"]
  },
  "content_pillars": ["string"],
  "posting_schedule": {
    "frequency": "daily|3x_week|2x_week|weekly|bi_weekly",
    "time_slots": ["09:00", "14:00"]
  },
  "tone_voice": "professional|casual|thought-leader|storytelling",
  "content_types": ["text", "article"],
  "duration": {
    "start_date": "ISO date",
    "end_date": "ISO date"
  },
  "include_images": true,
  "image_style": "professional",
  "image_model": "google/gemini-2.5-flash-image",
  "status": "draft",
  "auto_post": false
}
```

## Dependencies

```bash
# Install required packages
pip install beautifulsoup4 aiofiles python-docx PyPDF2 pdfplumber aiohttp
```

## Configuration

Requires API key for:
- Content generation (OpenRouter, OpenAI, or Google AI)
- Image analysis (Vision-capable models)

Set in user settings:
- `openrouter_api_key` or
- `openai_api_key` or
- `google_ai_api_key`

## Error Handling

- Missing API key: Returns 400 with clear message
- No materials: Returns 404
- Extraction failures: Logs warning, continues with other materials
- JSON parsing errors: Falls back to sensible defaults
- Campaign generation errors: Returns 500 with detailed error

## Performance

- Content extraction: Async/concurrent processing
- Content limits: 12,000-15,000 characters per material
- Analysis time: ~10-30 seconds depending on material count
- Campaign generation: ~5-15 seconds

## Future Enhancements

- [ ] Batch material processing
- [ ] Real-time extraction progress
- [ ] Multi-language support
- [ ] Competitive analysis from competitor websites
- [ ] Social media profile analysis
- [ ] Video content analysis
- [ ] Automatic material refresh/updates
