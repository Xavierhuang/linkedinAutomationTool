"""
Script to apply API provider priority fix to organization_materials.py
Run this from anywhere: python backend/apply_priority_fix.py
"""

import re
import os
from pathlib import Path

# Get the script directory and find the file
script_dir = Path(__file__).parent
file_path = script_dir / 'linkedpilot' / 'routes' / 'organization_materials.py'

print(f"Looking for file at: {file_path}")

if not file_path.exists():
    print(f"❌ File not found at {file_path}")
    print("Please run this script from the project root or backend directory")
    exit(1)

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The old code pattern to replace
old_pattern = r'''        # Get settings by user_id \(not org_id\)
        settings = await db\.user_settings\.find_one\(\{"user_id": user_id\}, \{"_id": 0\}\)
        api_key = None
        if settings:
            # Decrypt the API keys
            from \.\.routes\.settings import decrypt_value
            encrypted_openrouter = settings\.get\('openrouter_api_key', ''\)
            encrypted_openai = settings\.get\('openai_api_key', ''\)
            encrypted_google = settings\.get\('google_ai_api_key', ''\)
            
            api_key = \(
                decrypt_value\(encrypted_openrouter\) or 
                decrypt_value\(encrypted_openai\) or 
                decrypt_value\(encrypted_google\)
            \)
        
        if not api_key:
            raise HTTPException\(status_code=400, detail="No API key configured\. Please add an OpenAI, OpenRouter, or Google AI key in Settings\."\)
        
        # Determine which provider to use based on which key is actually available
        provider = "openai"  # default
        if settings:
            from \.\.routes\.settings import decrypt_value
            openrouter_key = decrypt_value\(settings\.get\('openrouter_api_key', ''\)\)
            openai_key = decrypt_value\(settings\.get\('openai_api_key', ''\)\)
            google_key = decrypt_value\(settings\.get\('google_ai_api_key', ''\)\)
            
            # Check which key matches the api_key we're using
            if api_key == openrouter_key and openrouter_key:
                provider = "openrouter"
            elif api_key == openai_key and openai_key:
                provider = "openai"
            elif api_key == google_key and google_key:
                provider = "google_ai_studio"
        
        print\(f"   Using provider: \{provider\}"\)
        print\(f"   API key starts with: \{api_key\[:10\] if api_key else 'None'\}\.\.\."\)'''

# The new code to replace with
new_code = '''        # Get settings by user_id (not org_id)
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        
        # Get API key and provider using helper (priority: OpenAI → Gemini → Anthropic → OpenRouter)
        from ..utils.api_key_helper import get_api_key_and_provider
        api_key, provider = get_api_key_and_provider(settings, decrypt_value)
        
        if not api_key:
            raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI, Google AI, Anthropic, or OpenRouter key in Settings.")
        
        print(f"   ✅ Using provider: {provider}")
        print(f"   🔑 API key starts with: {api_key[:15] if api_key else 'None'}...")'''

# Count occurrences
count = len(re.findall(old_pattern, content, re.MULTILINE))
print(f"Found {count} occurrences to replace")

if count == 0:
    print("Pattern not found. The file may already be updated or the pattern doesn't match.")
    print("Please apply the fix manually using APPLY_PRIORITY_FIX.md")
else:
    # Replace all occurrences
    new_content = re.sub(old_pattern, new_code, content, flags=re.MULTILINE)
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✅ Successfully replaced {count} occurrences!")
    print("The API provider priority is now: OpenAI → Gemini → Anthropic → OpenRouter")
    print("\nNext steps:")
    print("1. Restart the backend server")
    print("2. Test the analysis - it should use your OpenAI key first")
