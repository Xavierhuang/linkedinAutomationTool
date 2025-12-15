@router.get("/media-library")
async def get_media_library(org_id: Optional[str] = None, user_id: Optional[str] = None):
    """Get all scraped images for media library"""
    db = get_db()
    
    query = {}
    if org_id:
        query["org_id"] = org_id
    elif user_id:
        # Get all organizations for this user
        orgs = await db.organizations.find(
            {"created_by": user_id},
            {"id": 1, "_id": 0}
        ).to_list(length=100)
        org_ids = [org["id"] for org in orgs]
        query["$or"] = [
            {"org_id": {"$in": org_ids}},
            {"user_id": user_id}
        ]
    else:
        return []
    
    images = await db.user_images.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    
    # Convert backend URLs to full URLs
    import os
    base_url = os.environ.get("BACKEND_URL", "https://mandi.media")
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"
    if base_url.endswith('/'):
        base_url = base_url[:-1]
    
    for img in images:
        if img.get("backend_url") and img["backend_url"].startswith("/api/brand/images/"):
            img["url"] = f"{base_url}{img['backend_url']}"
        elif img.get("original_url"):
            img["url"] = img["original_url"]
        else:
            if img.get("filename"):
                img["url"] = f"{base_url}/api/brand/images/{img['filename']}"
    
    return images



