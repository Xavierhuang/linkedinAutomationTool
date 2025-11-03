"""
Helper functions for API key management
"""
import os

def get_api_key_and_provider(settings, decrypt_value_func):
    """
    Get the first available API key and its provider from settings
    
    Priority order:
    1. OpenAI (most common, direct access)
    2. Google AI / Gemini (free tier available)
    3. Anthropic / Claude (high quality)
    4. OpenRouter (fallback, requires credits)
    
    Args:
        settings: User settings dict from database
        decrypt_value_func: Function to decrypt encrypted values
        
    Returns:
        tuple: (api_key, provider) or (None, None) if no key found
    """
    # Try each provider in priority order
    providers = [
        ('openai_api_key', 'openai', 'OPENAI_API_KEY'),              # 1st priority
        ('google_ai_api_key', 'google_ai_studio', 'GOOGLE_AI_API_KEY'), # 2nd priority
        ('anthropic_api_key', 'anthropic', 'ANTHROPIC_API_KEY'),        # 3rd priority
        ('openrouter_api_key', 'openrouter', 'OPENROUTER_API_KEY')       # 4th priority (fallback)
    ]
    
    # First check user settings
    if settings:
        for key_field, provider_name, env_var in providers:
            encrypted_key = settings.get(key_field, '')
            if encrypted_key:
                decrypted_key = decrypt_value_func(encrypted_key)
                # Check if key is not empty after decryption
                if decrypted_key and len(decrypted_key.strip()) > 0:
                    return decrypted_key, provider_name
    
    # Fall back to environment variables
    for key_field, provider_name, env_var in providers:
        env_key = os.getenv(env_var)
        if env_key and len(env_key.strip()) > 0:
            return env_key, provider_name
    
    return None, None
