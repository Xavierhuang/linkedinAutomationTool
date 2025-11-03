from fastapi import APIRouter, HTTPException
from typing import Optional

router = APIRouter(prefix="/canva", tags=["canva"])

@router.get("/health")
async def canva_health():
    """Health check endpoint for Canva integration"""
    return {"status": "ok", "service": "canva"}

# TODO: Add Canva Connect API routes here
# - List brand templates
# - Create design from template
# - Export design
# See: backend/linkedpilot/adapters/canva_adapter.py for implementation

