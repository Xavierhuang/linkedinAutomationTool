from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import os
import uuid
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

@router.get("/user/{user_id}")
async def list_user_materials(user_id: str):
    """List all materials for a user (across all their organizations)"""
    db = get_db()
    
    # Get all organizations for this user
    orgs = await db.organizations.find(
        {"created_by": user_id},
        {"id": 1, "_id": 0}
    ).to_list(length=100)
    
    org_ids = [org["id"] for org in orgs]
    
    if not org_ids:
        return []
    
    # Get all materials for these organizations
    materials = await db.organization_materials.find(
        {"org_id": {"$in": org_ids}},
        {"_id": 0}
    ).to_list(length=500)
    
    return materials

@router.get("/images/{org_id}")
async def list_org_images(org_id: str):
    """List all images for an organization"""
    db = get_db()
    images = await db.user_images.find(
        {"org_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return images

@router.get("/images/user/{user_id}")
async def list_user_images(user_id: str):
    """List all images for a user (across all their organizations)"""
    db = get_db()
    
    # Get all organizations for this user
    orgs = await db.organizations.find(
        {"created_by": user_id},
        {"id": 1, "_id": 0}
    ).to_list(length=100)
    
    org_ids = [org["id"] for org in orgs]
    
    if not org_ids:
        return []
    
    # Get all images for these organizations
    images = await db.user_images.find(
        {"$or": [
            {"org_id": {"$in": org_ids}},
            {"user_id": user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    
    return images

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
            api_key = settings.get('openai_api_key') if settings else None
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

@router.post("/scrape-images")
async def scrape_website_images(url: str):
    """Scrape images from a website URL"""
    try:
        extractor = ContentExtractor()
        result = await extractor.extract_from_url(url)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
            
        # Return extracted images and metadata
        return {
            "hero_image": result.get('image'),
            "images": result.get('images', []),
            "title": result.get('title'),
            "description": result.get('description')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@router.post("/save-brand-dna")
async def save_brand_dna(org_id: str, brand_dna: dict):
    """Save brand DNA data from brand discovery to organization"""
    db = get_db()
    
    try:
        # Check if organization exists
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Save brand DNA to a temporary collection or update organization
        # We'll store it in a brand_dna collection for later use in analysis
        await db.brand_dna.update_one(
            {"org_id": org_id},
            {"$set": {
                **brand_dna,
                "org_id": org_id,
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )
        
        print(f"[BRAND DNA] Saved brand DNA for org {org_id}")
        return {"success": True, "message": "Brand DNA saved successfully"}
        
    except Exception as e:
        print(f"[ERROR] Failed to save brand DNA: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save brand DNA: {str(e)}")

@router.post("/analyze")
async def analyze_materials(org_id: str):
    """Analyze all materials and generate comprehensive brand insights"""
    db = get_db()
    
    print(f"\n{'='*60}")
    print(f"[ANALYZE] Organization Materials")
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
        
        print(f"[INFO] Found {len(materials)} materials to analyze")
        
        # Get API key - need to find user_id from org
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        user_id = org.get('created_by')
        if not user_id:
            raise HTTPException(status_code=400, detail="Organization has no associated user")
        
        # Get settings by user_id (not org_id)
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        # Get API key and provider using helper (priority: OpenAI → Google AI)
        from ..utils.api_key_helper import get_api_key_and_provider
        api_key, provider = get_api_key_and_provider(settings, decrypt_value)
        
        # If no user key, try system key (admin-managed)
        if not api_key:
            from ..routes.drafts import get_system_api_key
            api_key, provider = await get_system_api_key("any")
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI or Google AI key in Settings or Admin Dashboard.")
        
        print(f"   [OK] Using provider: {provider}")
        print(f"   [OK] API key starts with: {api_key[:15] if api_key else 'None'}...")
        
        # Extract content from all materials
        extractor = ContentExtractor()
        all_content = []
        all_images = []
        material_ids = []
        
        for material in materials:
            material_ids.append(material['id'])
            
            # Always extract content to ensure we have fresh data
            # Even if content exists, re-extract for websites to get latest content
            should_extract = (
                not material.get('content') or 
                material['type'] in [MaterialType.WEBSITE.value, MaterialType.BLOG.value]
            )
            
            if should_extract:
                print(f"   Extracting: {material['name']} (type: {material['type']})")
                extracted = {}
                
                try:
                    if material['type'] in [MaterialType.WEBSITE.value, MaterialType.BLOG.value]:
                        print(f"   [EXTRACT] Extracting from URL: {material.get('url')}")
                        extracted = await extractor.extract_from_url(material['url'])
                        print(f"   [EXTRACT] Extracted {len(extracted.get('content', ''))} characters")
                    elif material['type'] == MaterialType.PDF.value:
                        extracted = await extractor.extract_from_pdf(material['file_path'])
                    elif material['type'] == MaterialType.IMAGE.value:
                        extracted = await extractor.extract_from_image(material['file_path'], api_key)
                    else:
                        extracted = await extractor.extract_from_document(material['file_path'])
                    
                    if 'error' not in extracted:
                        content = extracted.get('content', '')
                        images = extracted.get('images', [])
                        
                        if not content or len(content.strip()) < 10:
                            print(f"   [WARNING] Extracted content is very short or empty for {material['name']}")
                        else:
                            print(f"   [SUCCESS] Extracted {len(content)} characters from {material['name']}")
                        
                        # Save extracted images to user_images collection
                        if images:
                            org = await db.organizations.find_one({"id": material['org_id']}, {"_id": 0})
                            user_id = org.get("created_by") if org else None
                            
                            for img_url in images:
                                if img_url and img_url.startswith(("http://", "https://")):
                                    image_metadata = {
                                        "id": str(uuid.uuid4()),
                                        "original_url": img_url,
                                        "source_url": material.get('url', ''),
                                        "org_id": material['org_id'],
                                        "user_id": user_id,
                                        "material_id": material['id'],
                                        "material_type": material['type'],
                                        "created_at": datetime.utcnow().isoformat(),
                                        "updated_at": datetime.utcnow().isoformat()
                                    }
                                    await db.user_images.update_one(
                                        {"original_url": img_url, "org_id": material['org_id']},
                                        {"$set": image_metadata},
                                        upsert=True
                                    )
                        
                        # Save extracted content
                        await db.organization_materials.update_one(
                            {"id": material['id']},
                            {"$set": {
                                "content": content, 
                                "images": images,
                                "status": MaterialStatus.ANALYZED.value
                            }}
                        )
                        all_content.append(content)
                        all_images.extend(images)
                    else:
                        print(f"   [WARNING] Extraction failed: {extracted['error']}")
                except Exception as e:
                    print(f"   [WARNING] Extraction error: {e}")
            else:
                all_content.append(material['content'])
                if material.get('images'):
                    all_images.extend(material['images'])
        
        combined_content = "\n\n---\n\n".join(all_content)
        print(f"   Total content length: {len(combined_content)} characters")
        
        # Log each material's content length for debugging
        for idx, material in enumerate(materials):
            content_len = len(material.get('content', ''))
            print(f"   Material {idx + 1} ({material.get('name', 'Unknown')}): {content_len} chars")
        
        # Check for brand DNA from discovery (should be saved earlier)
        brand_dna_data = await db.brand_dna.find_one({"org_id": org_id}, {"_id": 0})
        
        # Only use fallback if we truly have NO content AND no brand DNA
        if not combined_content or len(combined_content.strip()) < 10:
            print(f"   [WARNING] Very little content extracted ({len(combined_content)} chars)")
            
            # If we have brand DNA from discovery, use it instead of generic fallback
            if brand_dna_data and (brand_dna_data.get('brand_story') or brand_dna_data.get('key_messages') or brand_dna_data.get('brand_personality')):
                print(f"   [INFO] Using brand DNA data from discovery instead of generic fallback")
                print(f"   [INFO] Brand DNA found: story={bool(brand_dna_data.get('brand_story'))}, messages={len(brand_dna_data.get('key_messages', []))}, personality={len(brand_dna_data.get('brand_personality', []))}")
                
                # Convert brand DNA to analysis format - use actual extracted values
                analysis_data = {
                    "brand_tone": brand_dna_data.get('brand_personality', []) or brand_dna_data.get('brand_tone', []) or ["professional", "innovative"],
                    "brand_voice": "professional",  # Default, can be inferred from personality later
                    "key_messages": brand_dna_data.get('key_messages', []) or ["Brand messaging"],
                    "value_propositions": brand_dna_data.get('unique_selling_points', []) or brand_dna_data.get('core_values', []) or ["Value proposition"],
                    "target_audience": {
                        "job_titles": [],
                        "industries": [],
                        "interests": [],
                        "pain_points": []
                    },
                    "content_pillars": brand_dna_data.get('content_pillars', []) or ["Brand Content", "Thought Leadership"],
                    "expert_segments": [],
                    "posting_themes": [],
                    "suggested_campaigns": [
                        {"name": "Brand Awareness Campaign", "description": "Build brand presence", "focus": "Brand awareness", "duration_weeks": 12}
                    ]
                }
                
                print(f"   [INFO] Using extracted brand DNA: {len(analysis_data['key_messages'])} messages, {len(analysis_data['brand_tone'])} tone descriptors")
            else:
                print(f"   [WARNING] No brand DNA found, using fallback defaults")
                print(f"   [DEBUG] Brand DNA query result: {brand_dna_data}")
                # Use fallback analysis with minimal content
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
                        {"name": "Thought Leadership Q1", "description": "Establish expertise in your industry", "focus": "Brand awareness", "duration_weeks": 12}
                    ]
                }
            
            # Create brand analysis with fallback data (brand_dna_data already queried above)
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
                confidence_score=0.5,
                materials_analyzed=material_ids,
                brand_images=list(set(all_images))[:12],
                # Merge brand DNA data if available
                brand_story=brand_dna_data.get('brand_story') if brand_dna_data else None,
                brand_personality=brand_dna_data.get('brand_personality', []) if brand_dna_data else [],
                core_values=brand_dna_data.get('core_values', []) if brand_dna_data else [],
                target_audience_description=brand_dna_data.get('target_audience_description') if brand_dna_data else None,
                unique_selling_points=brand_dna_data.get('unique_selling_points', []) if brand_dna_data else [],
            )
            
            # Save and return
            await db.brand_analysis.update_one(
                {"org_id": org_id},
                {"$set": brand_analysis.model_dump()},
                upsert=True
            )
            await db.organization_materials.update_many(
                {"org_id": org_id},
                {"$set": {"status": MaterialStatus.ANALYZED.value}}
            )
            
            print(f"[OK] Analysis complete (using brand DNA from discovery)")
            return brand_analysis
        
        # Initialize LLM with detected provider
        llm = LLMAdapter(api_key=api_key, provider=provider)
        
        # Enhanced analysis prompt with better instructions
        content_preview = combined_content[:15000]  # Increased from 12000
        print(f"   [AI] Sending {len(content_preview)} characters to AI for analysis")
        print(f"   [AI] Content preview (first 500 chars): {content_preview[:500]}...")
        
        # Include brand DNA from discovery in the prompt to enrich the analysis
        brand_dna_context = ""
        if brand_dna_data:
            dna_parts = []
            if brand_dna_data.get('brand_story'):
                dna_parts.append(f"Brand Story: {brand_dna_data['brand_story']}")
            if brand_dna_data.get('key_messages'):
                dna_parts.append(f"Key Messages: {', '.join(brand_dna_data['key_messages'][:5])}")
            if brand_dna_data.get('brand_personality'):
                dna_parts.append(f"Brand Personality: {', '.join(brand_dna_data['brand_personality'])}")
            if brand_dna_data.get('core_values'):
                dna_parts.append(f"Core Values: {', '.join(brand_dna_data['core_values'])}")
            if brand_dna_data.get('unique_selling_points'):
                dna_parts.append(f"Unique Selling Points: {', '.join(brand_dna_data['unique_selling_points'][:3])}")
            
            if dna_parts:
                brand_dna_context = f"\n\nADDITIONAL BRAND DNA CONTEXT (from website analysis):\n{chr(10).join(dna_parts)}\n\n"
                print(f"   [AI] Including brand DNA context: {len(dna_parts)} sections")
        
        analysis_prompt = f"""You are a brand strategist analyzing company materials to extract authentic brand insights. Analyze the following content carefully and provide SPECIFIC, DETAILED insights based on what the company actually says and does - NOT generic business terms.

COMPANY MATERIALS CONTENT:

{content_preview}
{brand_dna_context}
IMPORTANT: 
- Base your analysis PRIMARILY on what is actually written in the materials above
- Use the Brand DNA Context above to enhance and validate your analysis
- Be SPECIFIC and DETAILED - avoid generic business phrases
- Extract REAL messages, values, and propositions from the content
- If the content mentions specific products, services, or industries, include those
- If the content mentions specific customer problems or benefits, extract those exactly
- Prefer specific details from Brand DNA Context over generic defaults

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
        print("   [AI] Calling AI for analysis...")
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
            print(f"   [WARNING] JSON parsing failed: {parse_error}")
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
        
        # Check if brand DNA data exists from brand discovery
        brand_dna_data = await db.brand_dna.find_one({"org_id": org_id}, {"_id": 0})
        
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
            materials_analyzed=material_ids,
            brand_images=list(set(all_images))[:12],  # Deduplicate and limit to 12 images
            # Merge brand DNA data if available
            brand_story=brand_dna_data.get('brand_story') if brand_dna_data else None,
            brand_personality=brand_dna_data.get('brand_personality', []) if brand_dna_data else [],
            core_values=brand_dna_data.get('core_values', []) if brand_dna_data else [],
            target_audience_description=brand_dna_data.get('target_audience_description') if brand_dna_data else None,
            unique_selling_points=brand_dna_data.get('unique_selling_points', []) if brand_dna_data else [],
        )
        
        # Merge brand DNA data more comprehensively if available
        if brand_dna_data:
            print(f"   [INFO] Merging brand DNA into analysis...")
            
            # Prioritize brand DNA key messages (prepend them)
            if brand_dna_data.get('key_messages'):
                existing_messages = set(brand_analysis.key_messages or [])
                dna_messages = [msg for msg in brand_dna_data.get('key_messages', []) if msg and msg not in existing_messages]
                # Prepend DNA messages for priority (they come from website, so more authentic)
                brand_analysis.key_messages = dna_messages + list(brand_analysis.key_messages or [])
                print(f"   [INFO] Merged {len(dna_messages)} key messages from brand DNA")
            
            # Prioritize brand DNA value propositions
            if brand_dna_data.get('unique_selling_points'):
                existing_props = set(brand_analysis.value_propositions or [])
                dna_props = [prop for prop in brand_dna_data.get('unique_selling_points', []) if prop and prop not in existing_props]
                brand_analysis.value_propositions = dna_props + list(brand_analysis.value_propositions or [])
                print(f"   [INFO] Merged {len(dna_props)} value propositions from brand DNA")
            
            # Prioritize brand DNA personality/tone (from website analysis)
            if brand_dna_data.get('brand_personality') and len(brand_dna_data.get('brand_personality', [])) > 0:
                dna_personality = brand_dna_data.get('brand_personality', [])
                existing_tone = set(brand_analysis.brand_tone or [])
                # Use DNA personality as primary, supplement with AI analysis
                brand_analysis.brand_tone = [t for t in dna_personality if t] + [t for t in (brand_analysis.brand_tone or []) if t and t not in dna_personality]
                print(f"   [INFO] Using brand DNA personality as primary: {', '.join(dna_personality[:5])}")
            
            # Merge core values into value propositions
            if brand_dna_data.get('core_values'):
                existing_props = set(brand_analysis.value_propositions or [])
                dna_values = [val for val in brand_dna_data.get('core_values', []) if val and val not in existing_props]
                brand_analysis.value_propositions.extend(dna_values)
                print(f"   [INFO] Merged {len(dna_values)} core values from brand DNA")
            
            # Use brand DNA target audience description if available
            if brand_dna_data.get('target_audience_description') and not brand_analysis.target_audience_description:
                brand_analysis.target_audience_description = brand_dna_data.get('target_audience_description')
                print(f"   [INFO] Using brand DNA target audience description")
        
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
        
        print(f"[SUCCESS] Analysis complete!")
        print(f"   Brand Voice: {brand_analysis.brand_voice}")
        print(f"   Content Pillars: {len(brand_analysis.content_pillars)}")
        print(f"   Suggested Campaigns: {len(brand_analysis.suggested_campaigns)}")
        print(f"{'='*60}\n")
        
        return brand_analysis
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Analysis failed: {e}")
        print(f"Full traceback:\n{error_trace}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}\n\nCheck backend logs for full traceback.")

@router.put("/analysis")
async def update_brand_analysis(org_id: str, analysis_update: dict):
    """Update brand analysis for an organization"""
    db = get_db()
    
    try:
        # Check if organization exists
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Find existing brand analysis
        existing_analysis = await db.brand_analysis.find_one({"org_id": org_id}, {"_id": 0})
        
        if not existing_analysis:
            raise HTTPException(status_code=404, detail="Brand analysis not found. Please run analysis first.")
        
        # Merge updates with existing data
        update_data = {
            **existing_analysis,
            **analysis_update,
            "org_id": org_id,
            "updated_at": datetime.utcnow()
        }
        
        # Update brand analysis
        await db.brand_analysis.update_one(
            {"org_id": org_id},
            {"$set": update_data},
            upsert=False
        )
        
        print(f"[BRAND ANALYSIS] Updated brand analysis for org {org_id}")
        return {"success": True, "message": "Brand analysis updated successfully", "analysis": update_data}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to update brand analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update brand analysis: {str(e)}")

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
        
        # Get API key and provider using helper (priority: OpenAI → Google AI)
        from ..utils.api_key_helper import get_api_key_and_provider
        api_key, provider = get_api_key_and_provider(settings, decrypt_value)
        
        # If no user key, try system key (admin-managed)
        if not api_key:
            from ..routes.drafts import get_system_api_key
            api_key, provider = await get_system_api_key("any")
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI or Google AI key in Settings or Admin Dashboard.")
        
        print(f"   [OK] Using provider: {provider}")
        print(f"   [OK] API key starts with: {api_key[:15] if api_key else 'None'}...")
        
        # Initialize campaign generator with detected provider
        generator = CampaignGenerator(api_key=api_key, provider=provider)
        
        # Generate complete campaign
        print("   [AI] Generating campaign configuration...")
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
        
        print(f"[SUCCESS] Campaign created successfully!")
        print(f"   ID: {campaign.id}")
        print(f"   Tone: {campaign.tone_voice}")
        print(f"   Frequency: {campaign.posting_schedule.frequency}")
        print(f"   Content Pillars: {len(campaign.content_pillars)}")
        print(f"   Target Audience: {len(campaign.target_audience.job_titles)} job titles")
        print(f"{'='*60}\n")
        
        return campaign
        
    except Exception as e:
        print(f"[ERROR] Campaign generation failed: {e}")
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Campaign generation failed: {str(e)}")
