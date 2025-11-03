from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import os
import aiofiles
from pathlib import Path

from ..models.organization_materials import (
    OrganizationMaterial,
    MaterialType,
    MaterialStatus,
    BrandAnalysis,
    CampaignGenerationRequest,
    GeneratedCampaignConfig
)
from ..models.campaign import Campaign
from ..adapters.llm_adapter import LLMAdapter
from ..services.content_extractor import ContentExtractor
from ..services.campaign_generator import CampaignGenerator
from ..routes.settings import decrypt_value

router = APIRouter(prefix="/organization-materials", tags=["organization-materials"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads/materials")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_material(
    org_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a material file (PDF, image, document)"""
    db = get_db()
    
    try:
        # Determine material type
        content_type = file.content_type or ""
        if "pdf" in content_type:
            material_type = MaterialType.PDF
        elif "image" in content_type:
            material_type = MaterialType.IMAGE
        else:
            material_type = MaterialType.DOCUMENT
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{org_id}_{datetime.utcnow().timestamp()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Create material record
        material = OrganizationMaterial(
            org_id=org_id,
            type=material_type,
            name=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=content_type,
            status=MaterialStatus.PENDING
        )
        
        await db.organization_materials.insert_one(material.model_dump())
        
        return material
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/add-url")
async def add_url_material(org_id: str, url: str, material_type: str = "website"):
    """Add a website or blog URL as material"""
    db = get_db()
    
    try:
        mat_type = MaterialType.WEBSITE if material_type == "website" else MaterialType.BLOG
        
        material = OrganizationMaterial(
            org_id=org_id,
            type=mat_type,
            name=url,
            url=url,
            status=MaterialStatus.PENDING
        )
        
        await db.organization_materials.insert_one(material.model_dump())
        
        return material
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add URL: {str(e)}")

@router.get("")
async def list_materials(org_id: str):
    """List all materials for an organization"""
    db = get_db()
    materials = await db.organization_materials.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(length=100)
    
    return materials

@router.delete("/{material_id}")
async def delete_material(material_id: str):
    """Delete a material"""
    db = get_db()
    
    # Get material to delete file if exists
    material = await db.organization_materials.find_one({"id": material_id})
    if material and material.get('file_path'):
        try:
            Path(material['file_path']).unlink(missing_ok=True)
        except:
            pass
    
    await db.organization_materials.delete_one({"id": material_id})
    
    return {"success": True}

@router.post("/extract-content/{material_id}")
async def extract_material_content(material_id: str):
    """Extract content from a specific material"""
    db = get_db()
    
    try:
        material = await db.organization_materials.find_one({"id": material_id})
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        # Update status
        await db.organization_materials.update_one(
            {"id": material_id},
            {"$set": {"status": MaterialStatus.ANALYZING.value}}
        )
        
        extractor = ContentExtractor()
        extracted = {}
        
        # Extract based on type
        if material['type'] in [MaterialType.WEBSITE, MaterialType.BLOG]:
            extracted = await extractor.extract_from_url(material['url'])
        elif material['type'] == MaterialType.PDF:
            extracted = await extractor.extract_from_pdf(material['file_path'])
        elif material['type'] == MaterialType.IMAGE:
            # Get API key
            settings = await db.user_settings.find_one({"org_id": material['org_id']}, {"_id": 0})
            api_key = settings.get('openrouter_api_key') or settings.get('openai_api_key') if settings else None
            if api_key:
                extracted = await extractor.extract_from_image(material['file_path'], api_key)
            else:
                extracted = {"error": "No API key for image analysis"}
        else:
            extracted = await extractor.extract_from_document(material['file_path'])
        
        # Save extracted content
        if 'error' not in extracted:
            await db.organization_materials.update_one(
                {"id": material_id},
                {"$set": {
                    "content": extracted.get('content', ''),
                    "status": MaterialStatus.ANALYZED.value,
                    "updated_at": datetime.utcnow()
                }}
            )
            return {"success": True, "content_length": len(extracted.get('content', ''))}
        else:
            await db.organization_materials.update_one(
                {"id": material_id},
                {"$set": {"status": MaterialStatus.FAILED.value}}
            )
            raise HTTPException(status_code=500, detail=extracted['error'])
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content extraction failed: {str(e)}")

@router.post("/analyze")
async def analyze_materials(org_id: str):
    """Analyze all materials and generate comprehensive brand insights"""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"🔍 Analyzing Organization Materials")
    print(f"   Organization: {org_id}")
    print(f"{'='*60}\n")
    
    try:
        # Get all materials
        materials = await db.organization_materials.find(
            {"org_id": org_id},
            {"_id": 0}
        ).to_list(length=100)
        
        if not materials:
            raise HTTPException(status_code=404, detail="No materials found")
        
        print(f"📚 Found {len(materials)} materials to analyze")
        
        # Get API key - need to find user_id from org
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        user_id = org.get('created_by')
        if not user_id:
            raise HTTPException(status_code=400, detail="Organization has no associated user")
        
        # Get settings by user_id (not org_id)
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        # Get API key and provider using helper (priority: OpenAI → Gemini → Anthropic → OpenRouter)
        from ..utils.api_key_helper import get_api_key_and_provider
        api_key, provider = get_api_key_and_provider(settings, decrypt_value)
        
        # If no user key, try system key (admin-managed)
        if not api_key:
            from ..routes.drafts import get_system_api_key
            api_key, provider = await get_system_api_key("any")
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI, Google AI, Anthropic, or OpenRouter key in Settings or Admin Dashboard.")
        
        print(f"   ✅ Using provider: {provider}")
        print(f"   🔑 API key starts with: {api_key[:15] if api_key else 'None'}...")
        
        # Extract content from all materials
        extractor = ContentExtractor()
        all_content = []
        material_ids = []
        
        for material in materials:
            material_ids.append(material['id'])
            
            # Extract if not already extracted
            if not material.get('content'):
                print(f"   Extracting: {material['name']}")
                extracted = {}
                
                try:
                    if material['type'] in [MaterialType.WEBSITE.value, MaterialType.BLOG.value]:
                        extracted = await extractor.extract_from_url(material['url'])
                    elif material['type'] == MaterialType.PDF.value:
                        extracted = await extractor.extract_from_pdf(material['file_path'])
                    elif material['type'] == MaterialType.IMAGE.value:
                        extracted = await extractor.extract_from_image(material['file_path'], api_key)
                    else:
                        extracted = await extractor.extract_from_document(material['file_path'])
                    
                    if 'error' not in extracted:
                        content = extracted.get('content', '')
                        # Save extracted content
                        await db.organization_materials.update_one(
                            {"id": material['id']},
                            {"$set": {"content": content, "status": MaterialStatus.ANALYZED.value}}
                        )
                        all_content.append(content)
                    else:
                        print(f"   ⚠️  Extraction failed: {extracted['error']}")
                except Exception as e:
                    print(f"   ⚠️  Extraction error: {e}")
            else:
                all_content.append(material['content'])
        
        combined_content = "\n\n---\n\n".join(all_content)
        print(f"   Total content length: {len(combined_content)} characters")
        
        # Initialize LLM with detected provider
        llm = LLMAdapter(api_key=api_key, provider=provider)
        
        # Enhanced analysis prompt
        analysis_prompt = f"""Analyze the following company materials and extract comprehensive brand insights for LinkedIn campaign generation:

MATERIALS:

{combined_content[:12000]}

Provide a detailed JSON analysis with:

1. **brand_tone**: Array of 3-5 tone descriptors (e.g., "professional", "innovative", "friendly", "authoritative", "conversational")

2. **brand_voice**: ONE of: "professional", "casual", "thought-leader", "storytelling"

3. **key_messages**: 5-7 core messages the brand consistently communicates

4. **value_propositions**: 3-5 specific value propositions or solutions they offer

5. **target_audience**: {{
   "job_titles": [8-12 specific job titles/roles],
   "industries": [5-8 industries],
   "interests": [8-12 professional interests],
   "pain_points": [5-8 problems they solve]
}}

6. **content_pillars**: 6-8 main topics for LinkedIn posts (specific, actionable themes)

7. **expert_segments**: 6-10 types of experts/professionals to target and engage with

8. **posting_themes**: 8-12 recurring themes for content (be specific)

9. **suggested_campaigns**: 5 campaign ideas, each with:
   - name: Campaign name
   - description: 2-3 sentence description
   - focus: Primary focus area
   - duration_weeks: Suggested duration (4-16 weeks)

Return ONLY valid JSON, no markdown:
{{
  "brand_tone": ["string"],
  "brand_voice": "string",
  "key_messages": ["string"],
  "value_propositions": ["string"],
  "target_audience": {{}},
  "content_pillars": ["string"],
  "expert_segments": ["string"],
  "posting_themes": ["string"],
  "suggested_campaigns": [{{}}]
}}"""

        # Get analysis from LLM
        print("   🤖 Calling AI for analysis...")
        analysis_result = await llm.generate_completion(analysis_prompt, temperature=0.7)
        
        # Parse JSON response
        import json
        try:
            # Clean response
            response_text = analysis_result.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            analysis_data = json.loads(response_text.strip())
        except Exception as parse_error:
            print(f"   ⚠️  JSON parsing failed: {parse_error}")
            # Fallback with enhanced defaults
            analysis_data = {
                "brand_tone": ["professional", "innovative", "trustworthy"],
                "brand_voice": "professional",
                "key_messages": ["Industry expertise", "Customer success", "Innovation leadership"],
                "value_propositions": ["Solve business challenges", "Drive growth", "Increase efficiency"],
                "target_audience": {
                    "job_titles": ["CEO", "Marketing Director", "Sales Manager", "Business Owner"],
                    "industries": ["Technology", "SaaS", "Professional Services"],
                    "interests": ["Innovation", "Leadership", "Business Growth"],
                    "pain_points": ["Scaling challenges", "Market competition", "Efficiency"]
                },
                "content_pillars": ["Industry Insights", "Thought Leadership", "Product Updates", "Customer Success", "Best Practices", "Innovation"],
                "expert_segments": ["Industry Leaders", "Technical Experts", "Business Strategists"],
                "posting_themes": ["Innovation", "Best Practices", "Success Stories", "Industry Trends"],
                "suggested_campaigns": [
                    {"name": "Thought Leadership Q1", "description": "Establish expertise", "focus": "Brand awareness", "duration_weeks": 12}
                ]
            }
        
        # Create brand analysis record
        brand_analysis = BrandAnalysis(
            org_id=org_id,
            brand_tone=analysis_data.get('brand_tone', []),
            brand_voice=analysis_data.get('brand_voice', 'professional'),
            key_messages=analysis_data.get('key_messages', []),
            value_propositions=analysis_data.get('value_propositions', []),
            target_audience=analysis_data.get('target_audience', {}),
            content_pillars=analysis_data.get('content_pillars', []),
            expert_segments=analysis_data.get('expert_segments', []),
            posting_themes=analysis_data.get('posting_themes', []),
            suggested_campaigns=analysis_data.get('suggested_campaigns', []),
            confidence_score=0.85,
            materials_analyzed=material_ids
        )
        
        # Save analysis
        await db.brand_analysis.update_one(
            {"org_id": org_id},
            {"$set": brand_analysis.model_dump()},
            upsert=True
        )
        
        # Update materials status
        await db.organization_materials.update_many(
            {"org_id": org_id},
            {"$set": {"status": MaterialStatus.ANALYZED.value}}
        )
        
        print(f"✅ Analysis complete!")
        print(f"   Brand Voice: {brand_analysis.brand_voice}")
        print(f"   Content Pillars: {len(brand_analysis.content_pillars)}")
        print(f"   Suggested Campaigns: {len(brand_analysis.suggested_campaigns)}")
        print(f"{'='*60}\n")
        
        return brand_analysis
        
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/analysis")
async def get_brand_analysis(org_id: str):
    """Get brand analysis for an organization"""
    db = get_db()
    
    analysis = await db.brand_analysis.find_one({"org_id": org_id}, {"_id": 0})
    
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found. Please analyze materials first.")
    
    return BrandAnalysis(**analysis)

@router.post("/generate-campaign")
async def generate_campaign_config(request: CampaignGenerationRequest):
    """Generate a complete campaign configuration from brand analysis and save it"""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"🚀 Generating Campaign from Brand Analysis")
    print(f"   Campaign: {request.campaign_name}")
    print(f"   Focus: {request.focus_area or 'General'}")
    print(f"{'='*60}\n")
    
    try:
        # Get brand analysis
        analysis_doc = await db.brand_analysis.find_one({"org_id": request.org_id}, {"_id": 0})
        
        if not analysis_doc:
            raise HTTPException(status_code=404, detail="No brand analysis found. Please analyze materials first.")
        
        brand_analysis = BrandAnalysis(**analysis_doc)
        
        # Get API key - need to find user_id from org
        org = await db.organizations.find_one({"id": request.org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        user_id = org.get('created_by')
        if not user_id:
            raise HTTPException(status_code=400, detail="Organization has no associated user")
        
        # Get settings by user_id (not org_id)
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        # Get API key and provider using helper (priority: OpenAI → Gemini → Anthropic → OpenRouter)
        from ..utils.api_key_helper import get_api_key_and_provider
        api_key, provider = get_api_key_and_provider(settings, decrypt_value)
        
        # If no user key, try system key (admin-managed)
        if not api_key:
            from ..routes.drafts import get_system_api_key
            api_key, provider = await get_system_api_key("any")
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI, Google AI, Anthropic, or OpenRouter key in Settings or Admin Dashboard.")
        
        print(f"   ✅ Using provider: {provider}")
        print(f"   🔑 API key starts with: {api_key[:15] if api_key else 'None'}...")
        
        # Initialize campaign generator with detected provider
        generator = CampaignGenerator(api_key=api_key, provider=provider)
        
        # Generate complete campaign
        print("   🤖 Generating campaign configuration...")
        campaign = await generator.generate_campaign_from_analysis(
            org_id=request.org_id,
            created_by=user_id,  # Use actual user_id, not org_id!
            brand_analysis=brand_analysis,
            campaign_name=request.campaign_name,
            focus_area=request.focus_area,
            duration_weeks=12
        )
        
        # Save campaign to database
        await db.campaigns.insert_one(campaign.model_dump())
        
        print(f"✅ Campaign created successfully!")
        print(f"   ID: {campaign.id}")
        print(f"   Tone: {campaign.tone_voice}")
        print(f"   Frequency: {campaign.posting_schedule.frequency}")
        print(f"   Content Pillars: {len(campaign.content_pillars)}")
        print(f"   Target Audience: {len(campaign.target_audience.job_titles)} job titles")
        print(f"{'='*60}\n")
        
        return campaign
        
    except Exception as e:
        print(f"❌ Campaign generation failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Campaign generation failed: {str(e)}")
