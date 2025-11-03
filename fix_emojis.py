#!/usr/bin/env python3
"""
Remove all emojis from the codebase to fix UnicodeEncodeError on Windows
"""

import re
import os
from pathlib import Path

# Emoji to text mapping
EMOJI_MAP = {
    # Unicode escape sequences
    '\\U0001f680': '[API]',
    '\\U0001f50d': '[SEARCH]',
    '\\u26a0\\ufe0f': '[WARNING]',
    '\\u26a0': '[WARNING]',
    '\\u2705': '[SUCCESS]',
    
    # Actual emoji characters
    '✅': '[SUCCESS]',
    '❌': '[ERROR]',
    '⚠️': '[WARNING]',
    '📝': '[DRAFT]',
    '📋': '[INFO]',
    '📊': '[DATA]',
    '📤': '[SEND]',
    '🚀': '[API]',
    '🎨': '[IMAGE]',
    '💡': '[HINT]',
    '✨': '[AI]',
    'ℹ️': '[INFO]',
    '⏭️': '[SKIP]',
}

def remove_emojis(content):
    """Replace all emojis with text"""
    for emoji, replacement in EMOJI_MAP.items():
        content = content.replace(emoji, replacement)
    return content

def fix_file(filepath):
    """Fix emojis in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = remove_emojis(content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"[OK] Fixed: {filepath}")
            return True
        else:
            print(f"[SKIP] No changes: {filepath}")
        return False
    except Exception as e:
        print(f"[ERROR] Error fixing {filepath}: {e}")
        return False

def main():
    print("=" * 60)
    print("REMOVING ALL EMOJIS FROM CODEBASE")
    print("=" * 60)
    print()
    
    # Fix all Python files in backend
    backend_path = Path('backend/linkedpilot')
    if not backend_path.exists():
        backend_path = Path('linkedpilot')
    
    if not backend_path.exists():
        print("ERROR: Could not find backend/linkedpilot directory")
        print("Please run this script from the project root")
        return
    
    fixed_count = 0
    total_count = 0
    
    for py_file in backend_path.rglob('*.py'):
        total_count += 1
        if fix_file(py_file):
            fixed_count += 1
    
    # Also fix server.py in backend root
    server_py = Path('backend/server.py')
    if server_py.exists():
        total_count += 1
        if fix_file(server_py):
            fixed_count += 1
    
    print()
    print("=" * 60)
    print(f"SUMMARY:")
    print(f"  Total files scanned: {total_count}")
    print(f"  Files modified: {fixed_count}")
    print(f"  Files unchanged: {total_count - fixed_count}")
    print("=" * 60)
    print()
    print("[SUCCESS] All emojis replaced with text descriptors!")
    print("  Restart your backend server to see the changes.")

if __name__ == '__main__':
    main()



