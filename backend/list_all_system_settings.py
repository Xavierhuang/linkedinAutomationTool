"""List all system_settings documents in database"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import json

load_dotenv()

async def list_settings():
    """List all documents in system_settings collection"""
    client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))
    db = client['linkedpilot']
    
    print('\n=== ALL SYSTEM_SETTINGS DOCUMENTS ===\n')
    
    # Get all documents
    cursor = db.system_settings.find({})
    docs = await cursor.to_list(length=100)
    
    if not docs:
        print('[ERROR] No documents found in system_settings collection!')
    else:
        print(f'[OK] Found {len(docs)} document(s)\n')
        for doc in docs:
            print(f"Document ID: {doc.get('_id')}")
            print(f"Keys in document: {list(doc.keys())}")
            # Print first 50 chars of each key's value
            for key, value in doc.items():
                if key != '_id':
                    value_str = str(value)[:50] if value else 'None'
                    print(f"  - {key}: {value_str}...")
            print()
    
    client.close()

if __name__ == '__main__':
    asyncio.run(list_settings())









