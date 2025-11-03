# Organizational Materials System - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│                  (OrganizationMaterialsModal)                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Upload Files │  │  Add URLs    │  │   Analyze    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         Brand Analysis Results                       │        │
│  │  • Brand Voice  • Content Pillars  • Audience       │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         Suggested Campaigns                          │        │
│  │  Campaign 1  [Generate] ←─────────────────┐         │        │
│  │  Campaign 2  [Generate]                    │         │        │
│  │  Campaign 3  [Generate]                    │         │        │
│  └─────────────────────────────────────────────────────┘        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API LAYER                           │
│              (organization_materials.py routes)                  │
│                                                                   │
│  POST /upload              → Store material                      │
│  POST /add-url             → Store URL material                  │
│  POST /extract-content/:id → Extract content from material       │
│  POST /analyze             → Analyze all materials               │
│  POST /generate-campaign   → Generate complete campaign          │
│  GET  /analysis            → Get brand analysis                  │
│  GET  /                    → List materials                      │
│  DELETE /:id               → Delete material                     │
└───────────┬─────────────────────────┬───────────────────────────┘
            │                         │
            ▼                         ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Content Extractor   │    │  Campaign Generator  │
│                      │    │                      │
│  extract_from_url()  │    │  generate_campaign() │
│  extract_from_pdf()  │    │  generate_post_ideas()│
│  extract_from_image()│    │  _build_prompt()     │
│  extract_from_doc()  │    │  _create_campaign()  │
└──────────┬───────────┘    └──────────┬───────────┘
           │                           │
           └───────────┬───────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │    LLM Adapter       │
            │                      │
            │  generate_completion()│
            │  generate_with_image()│
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   AI Providers       │
            │                      │
            │  • OpenRouter        │
            │  • OpenAI            │
            │  • Google AI         │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │   MongoDB Database   │
            │                      │
            │  Collections:        │
            │  • organization_     │
            │    materials         │
            │  • brand_analysis    │
            │  • campaigns         │
            │  • user_settings     │
            └──────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│   Upload    │
│  Materials  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Material Storage                        │
│  • Files → uploads/materials/           │
│  • URLs → stored in DB                  │
│  • Status: "pending"                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Content Extraction (Parallel)          │
│                                          │
│  Website ──→ BeautifulSoup ──→ Text     │
│  PDF     ──→ PyPDF2        ──→ Text     │
│  Image   ──→ Vision AI     ──→ Analysis │
│  Doc     ──→ python-docx   ──→ Text     │
│                                          │
│  Status: "analyzing" → "analyzed"       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Content Aggregation                     │
│  • Combine all extracted content        │
│  • Limit to 12,000 characters           │
│  • Format for AI analysis               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Brand Analysis                       │
│                                          │
│  Input: Combined content                │
│  Prompt: Detailed analysis instructions │
│                                          │
│  Output:                                │
│  • Brand tone (3-5 descriptors)         │
│  • Brand voice (1 of 4 types)           │
│  • Key messages (5-7)                   │
│  • Value propositions (3-5)             │
│  • Target audience (detailed)           │
│  • Content pillars (6-8)                │
│  • Expert segments (6-10)               │
│  • Posting themes (8-12)                │
│  • Suggested campaigns (5)              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Brand Analysis Storage                  │
│  • Save to brand_analysis collection    │
│  • Link to materials analyzed           │
│  • Confidence score: 0.85               │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  User Reviews Analysis                   │
│  • See suggested campaigns              │
│  • Select campaign to generate          │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Campaign Generation                  │
│                                          │
│  Input:                                 │
│  • Brand analysis                       │
│  • Campaign name                        │
│  • Focus area                           │
│                                          │
│  Process:                               │
│  • Build detailed prompt                │
│  • Call AI for campaign config          │
│  • Parse JSON response                  │
│  • Map to Campaign model                │
│                                          │
│  Output: Complete Campaign object       │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Campaign Storage                        │
│  • Save to campaigns collection         │
│  • Status: "draft"                      │
│  • Ready for content generation         │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Campaign Ready                          │
│  • User can generate posts              │
│  • User can schedule posts              │
│  • User can activate campaign           │
└─────────────────────────────────────────┘
```

## Component Interaction

```
┌────────────────────────────────────────────────────────────┐
│                    Frontend Component                       │
│              OrganizationMaterialsModal.js                  │
│                                                              │
│  State:                                                     │
│  • materials: []                                            │
│  • brandAnalysis: null                                      │
│  • loading: false                                           │
│  • analyzing: false                                         │
│                                                              │
│  Methods:                                                   │
│  • handleFileUpload()    ──→ POST /upload                  │
│  • handleAddUrl()        ──→ POST /add-url                 │
│  • handleAnalyze()       ──→ POST /analyze                 │
│  • handleGenerateCampaign() ──→ POST /generate-campaign    │
│  • handleDelete()        ──→ DELETE /:id                   │
│  • fetchMaterials()      ──→ GET /                         │
│  • fetchAnalysis()       ──→ GET /analysis                 │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Backend Routes                           │
│           organization_materials.py                         │
│                                                              │
│  Dependencies:                                              │
│  • ContentExtractor                                         │
│  • CampaignGenerator                                        │
│  • LLMAdapter                                               │
│  • MongoDB (via get_db())                                   │
│                                                              │
│  Flow:                                                      │
│  1. Receive request                                         │
│  2. Validate input                                          │
│  3. Call service layer                                      │
│  4. Save to database                                        │
│  5. Return response                                         │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│                                                              │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │ ContentExtractor     │    │ CampaignGenerator    │     │
│  │                      │    │                      │     │
│  │ Responsibilities:    │    │ Responsibilities:    │     │
│  │ • Web scraping       │    │ • Prompt building    │     │
│  │ • PDF extraction     │    │ • AI interaction     │     │
│  │ • Image analysis     │    │ • Data mapping       │     │
│  │ • Doc processing     │    │ • Campaign creation  │     │
│  │                      │    │                      │     │
│  │ Returns:             │    │ Returns:             │     │
│  │ • Extracted text     │    │ • Campaign object    │     │
│  │ • Error messages     │    │ • Post ideas         │     │
│  └──────────────────────┘    └──────────────────────┘     │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    LLM Adapter                              │
│                                                              │
│  Responsibilities:                                          │
│  • Provider abstraction (OpenRouter/OpenAI/Google)         │
│  • API key management                                       │
│  • Request formatting                                       │
│  • Response parsing                                         │
│  • Error handling                                           │
│                                                              │
│  Methods:                                                   │
│  • generate_completion() → Text generation                 │
│  • generate_with_image() → Vision analysis                 │
└────────────────────────────────────────────────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│  organization_materials                                      │
├─────────────────────────────────────────────────────────────┤
│  id: string (UUID)                                          │
│  org_id: string                                             │
│  type: enum (website|pdf|image|blog|document)               │
│  name: string                                               │
│  url: string? (for websites/blogs)                          │
│  file_path: string? (for uploaded files)                    │
│  content: string (extracted text)                           │
│  status: enum (pending|analyzing|analyzed|failed)           │
│  file_size: number?                                         │
│  mime_type: string?                                         │
│  created_at: datetime                                       │
│  updated_at: datetime                                       │
│                                                              │
│  Indexes:                                                   │
│  • org_id                                                   │
│  • status                                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  brand_analysis                                              │
├─────────────────────────────────────────────────────────────┤
│  id: string (UUID)                                          │
│  org_id: string (UNIQUE)                                    │
│  brand_tone: string[]                                       │
│  brand_voice: string                                        │
│  key_messages: string[]                                     │
│  value_propositions: string[]                               │
│  target_audience: {                                         │
│    job_titles: string[]                                     │
│    industries: string[]                                     │
│    interests: string[]                                      │
│    pain_points: string[]                                    │
│  }                                                           │
│  content_pillars: string[]                                  │
│  expert_segments: string[]                                  │
│  posting_themes: string[]                                   │
│  suggested_campaigns: [{                                    │
│    name: string                                             │
│    description: string                                      │
│    focus: string                                            │
│    duration_weeks: number                                   │
│  }]                                                          │
│  confidence_score: number                                   │
│  materials_analyzed: string[]                               │
│  analyzed_at: datetime                                      │
│  created_at: datetime                                       │
│  updated_at: datetime                                       │
│                                                              │
│  Indexes:                                                   │
│  • org_id (unique)                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  campaigns (Enhanced)                                        │
├─────────────────────────────────────────────────────────────┤
│  id: string (UUID)                                          │
│  org_id: string                                             │
│  name: string                                               │
│  description: string                                        │
│  target_audience: {                                         │
│    job_titles: string[]                                     │
│    industries: string[]                                     │
│    interests: string[]                                      │
│  }                                                           │
│  content_pillars: string[]                                  │
│  posting_schedule: {                                        │
│    frequency: enum                                          │
│    time_slots: string[]                                     │
│  }                                                           │
│  tone_voice: enum                                           │
│  content_types: string[]                                    │
│  duration: {                                                │
│    start_date: string                                       │
│    end_date: string                                         │
│  }                                                           │
│  include_images: boolean                                    │
│  image_style: string                                        │
│  image_model: string                                        │
│  status: enum (draft|active|paused|completed)               │
│  auto_post: boolean                                         │
│  created_by: string                                         │
│  created_at: datetime                                       │
│  updated_at: datetime                                       │
│                                                              │
│  Indexes:                                                   │
│  • org_id                                                   │
│  • status                                                   │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
└─────────────────────────────────────────────────────────────┘

1. Input Validation
   ├─ File type validation (MIME type checking)
   ├─ File size limits (enforced by FastAPI)
   ├─ URL validation (format checking)
   └─ Content length limits (12,000-15,000 chars)

2. File Storage
   ├─ Unique file naming (org_id + timestamp)
   ├─ Stored outside web root (uploads/materials/)
   ├─ No file execution
   └─ Automatic cleanup on delete

3. API Key Management
   ├─ Stored encrypted in database
   ├─ Never exposed in responses
   ├─ Provider-specific headers
   └─ Validated before use

4. Content Processing
   ├─ Async processing (non-blocking)
   ├─ Error isolation (one failure doesn't stop others)
   ├─ Content sanitization
   └─ No code execution from content

5. Database Access
   ├─ Parameterized queries (MongoDB)
   ├─ Org-level isolation
   ├─ No direct user input in queries
   └─ Proper indexing for performance
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────┐
│                Performance Strategies                        │
└─────────────────────────────────────────────────────────────┘

1. Async Processing
   • All I/O operations are async
   • Concurrent material extraction
   • Non-blocking API calls
   • Parallel content processing

2. Content Limits
   • 12,000-15,000 chars per material
   • 50 pages max for PDFs
   • Prevents token limit issues
   • Reduces API costs

3. Caching Strategy
   • Extracted content cached in DB
   • Brand analysis cached per org
   • No re-extraction unless needed
   • Reuse analysis for multiple campaigns

4. Database Optimization
   • Indexed queries (org_id, status)
   • Projection (exclude _id)
   • Batch operations where possible
   • Connection pooling

5. Error Recovery
   • Graceful degradation
   • Fallback data structures
   • Continue on partial failures
   • Detailed error logging
```

## Scalability Considerations

```
Current Architecture:
├─ Single server deployment
├─ File storage on local disk
├─ MongoDB for data
└─ Synchronous AI calls

Future Scalability:
├─ Horizontal scaling
│  ├─ Load balancer
│  ├─ Multiple API servers
│  └─ Shared file storage (S3)
│
├─ Async processing
│  ├─ Message queue (Celery/RabbitMQ)
│  ├─ Background workers
│  └─ Job status tracking
│
├─ Caching layer
│  ├─ Redis for session data
│  ├─ CDN for static files
│  └─ Query result caching
│
└─ Database optimization
   ├─ Read replicas
   ├─ Sharding by org_id
   └─ Archive old materials
```

## Monitoring & Observability

```
Recommended Monitoring:

1. Application Metrics
   ├─ Request rate
   ├─ Response time
   ├─ Error rate
   └─ Success rate

2. Business Metrics
   ├─ Materials uploaded per day
   ├─ Analyses performed
   ├─ Campaigns generated
   └─ Time to campaign creation

3. AI Metrics
   ├─ API call latency
   ├─ Token usage
   ├─ Cost per analysis
   └─ Model performance

4. System Metrics
   ├─ CPU usage
   ├─ Memory usage
   ├─ Disk space
   └─ Database connections

5. Error Tracking
   ├─ Extraction failures
   ├─ AI API errors
   ├─ Database errors
   └─ User-facing errors
```

This architecture provides a robust, scalable foundation for AI-powered campaign generation from organizational materials.
