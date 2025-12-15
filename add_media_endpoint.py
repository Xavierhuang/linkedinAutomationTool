#!/usr/bin/env python3
"""Script to add media library endpoint to brand_assistant.py"""

with open('brand_assistant.py', 'r') as f:
    lines = f.readlines()

proxy_idx = None
for i, line in enumerate(lines):
    if '@router.get("/proxy-image")' in line:
        proxy_idx = i
        break

if proxy_idx:
    endpoint_lines = [
        '@router.get("/media-library")\n',
        'async def get_media_library(org_id: Optional[str] = None, user_id: Optional[str] = None):\n',
        '    """Get all scraped images for media library"""\n',
        '    db = get_db()\n',
        '    \n',
        '    query = {}\n',
        '    if org_id:\n',
        '        query["org_id"] = org_id\n',
        '    elif user_id:\n',
        '        orgs = await db.organizations.find(\n',
        '            {"created_by": user_id},\n',
        '            {"id": 1, "_id": 0}\n',
        '        ).to_list(length=100)\n',
        '        org_ids = [org["id"] for org in orgs]\n',
        '        query["$or"] = [\n',
        '            {"org_id": {"$in": org_ids}},\n',
        '            {"user_id": user_id}\n',
        '        ]\n',
        '    else:\n',
        '        return []\n',
        '    \n',
        '    images = await db.user_images.find(\n',
        '        query,\n',
        '        {"_id": 0}\n',
        '    ).sort("created_at", -1).to_list(length=500)\n',
        '    \n',
        '    import os\n',
        '    base_url = os.environ.get("BACKEND_URL", "https://mandi.media")\n',
        '    if not base_url.startswith("http"):\n',
        '        base_url = f"https://{base_url}"\n',
        '    if base_url.endswith("/"):\n',
        '        base_url = base_url[:-1]\n',
        '    \n',
        '    for img in images:\n',
        '        if img.get("backend_url") and img["backend_url"].startswith("/api/brand/images/"):\n',
        '            img["url"] = f"{base_url}{img[\'backend_url\']}"\n',
        '        elif img.get("original_url"):\n',
        '            img["url"] = img["original_url"]\n',
        '        else:\n',
        '            if img.get("filename"):\n',
        '                img["url"] = f"{base_url}/api/brand/images/{img[\'filename\']}"\n',
        '    \n',
        '    return images\n',
        '\n',
        '\n'
    ]
    lines[proxy_idx:proxy_idx] = endpoint_lines
    with open('brand_assistant.py', 'w') as f:
        f.writelines(lines)
    print('SUCCESS: Media library endpoint added')
else:
    print('ERROR: proxy-image endpoint not found')


