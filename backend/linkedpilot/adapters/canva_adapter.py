"""
Canva Connect API Adapter for LinkedIn Pilot
Based on official Canva Connect API: https://www.canva.dev/docs/connect/

Note: Canva Connect API uses OAuth 2.0 authentication.
For simplicity, this implementation supports both:
- OAuth access tokens (recommended for production)
- API keys (if your Canva app supports it)
"""

import os
import httpx
from typing import Dict, List, Optional
from datetime import datetime


class CanvaAdapter:
    """Adapter for Canva Connect API to browse designs and create exports"""
    
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or os.getenv('CANVA_ACCESS_TOKEN')
        self.base_url = "https://api.canva.com/rest/v1"
        self.mock_mode = not self.access_token or os.getenv('MOCK_CANVA', 'false').lower() == 'true'
        
        print(f"[IMAGE] CanvaAdapter initialized:")
        print(f"   Access token present: {bool(self.access_token)}")
        print(f"   Mock mode: {self.mock_mode}")
        print(f"   Base URL: {self.base_url}")
    
    async def list_brand_templates(self, query: Optional[str] = None) -> List[Dict]:
        """
        List available brand templates from Canva
        Endpoint: GET /brand-templates
        Docs: https://www.canva.dev/docs/connect/api-reference/brand-templates/list-brand-templates/
        
        Args:
            query: Optional search query
        
        Returns:
            List of brand template objects
        """
        if self.mock_mode:
            return self._get_mock_templates(query)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                params = {}
                if query:
                    params['query'] = query
                
                response = await client.get(
                    f"{self.base_url}/brand-templates",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                    },
                    params=params
                )
                response.raise_for_status()
                data = response.json()
                
                templates = []
                for item in data.get('items', []):
                    templates.append({
                        "id": item.get('id'),
                        "name": item.get('name'),
                        "thumbnail_url": item.get('thumbnail', {}).get('url'),
                    })
                
                print(f"[SUCCESS] Found {len(templates)} Canva brand templates")
                return templates
                
        except Exception as e:
            print(f"[ERROR] Error fetching brand templates: {e}")
            return self._get_mock_templates(query)
    
    async def create_design_from_template(
        self, 
        template_id: Optional[str] = None,
        title: Optional[str] = None,
        design_type: str = "Social"
    ) -> Dict:
        """
        Create a new design (optionally from a brand template)
        Endpoint: POST /designs
        Docs: https://www.canva.dev/docs/connect/api-reference/designs/create-design/
        
        Args:
            template_id: Optional brand template ID to use
            title: Design title
            design_type: Type of design (Social, Presentation, etc.)
        
        Returns:
            Design object with id and urls
        """
        if self.mock_mode:
            return self._create_mock_design(template_id, title)
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                payload = {
                    "asset_type": "Design",
                    "title": title or f"LinkedIn Post {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                }
                
                # Add template reference if provided
                if template_id:
                    payload["design_type"] = {
                        "type": design_type,
                        "template": {
                            "id": template_id
                        }
                    }
                
                response = await client.post(
                    f"{self.base_url}/designs",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                
                design = data.get('design', {})
                result = {
                    "id": design.get('id'),
                    "title": design.get('title'),
                    "urls": design.get('urls', {}),
                    "created_at": datetime.now().isoformat()
                }
                
                print(f"[SUCCESS] Created Canva design: {result['id']}")
                return result
                
        except Exception as e:
            print(f"[ERROR] Error creating Canva design: {e}")
            return self._create_mock_design(template_id, title)
    
    async def export_design(self, design_id: str, file_type: str = "png") -> str:
        """
        Export a Canva design to an image file
        Endpoint: POST /exports
        Docs: https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
        
        Args:
            design_id: Canva design ID
            file_type: Export format (png, jpg, pdf)
        
        Returns:
            URL to the exported file
        """
        if self.mock_mode:
            return f"https://via.placeholder.com/1200x628/0077B5/FFFFFF?text=Canva+Design+{design_id}"
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Create export job
                response = await client.post(
                    f"{self.base_url}/exports",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "design_id": design_id,
                        "format": {
                            "type": file_type.upper()
                        }
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                # Get the export job ID
                job = data.get('job', {})
                job_id = job.get('id')
                
                # Poll for completion
                export_url = await self._poll_export_job(job_id)
                
                print(f"[SUCCESS] Exported Canva design: {export_url}")
                return export_url
                
        except Exception as e:
            print(f"[ERROR] Error exporting Canva design: {e}")
            return f"https://via.placeholder.com/1200x628/0077B5/FFFFFF?text=Export+Error"
    
    async def _poll_export_job(self, job_id: str, max_attempts: int = 30) -> str:
        """
        Poll export job until complete
        Endpoint: GET /exports/{exportId}
        """
        import asyncio
        
        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        f"{self.base_url}/exports/{job_id}",
                        headers={
                            "Authorization": f"Bearer {self.access_token}"
                        }
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    job = data.get('job', {})
                    status = job.get('status')
                    
                    if status == 'success':
                        # Get the download URL
                        result = job.get('result', {})
                        urls = result.get('urls', [])
                        if urls:
                            return urls[0].get('url')
                    elif status == 'failed':
                        error = job.get('error', {})
                        raise Exception(f"Export failed: {error.get('message')}")
                    
                    # Wait before next poll (2 seconds)
                    await asyncio.sleep(2)
                    
            except Exception as e:
                print(f"[WARNING] Export poll attempt {attempt + 1} failed: {e}")
        
        raise Exception("Export job timed out")
    
    def _get_mock_templates(self, query: Optional[str] = None) -> List[Dict]:
        """Return mock Canva templates for demo purposes"""
        base_templates = [
            {
                "id": "DAGQj5c7Ygw",
                "name": "Professional LinkedIn Post - Blue",
                "thumbnail_url": "https://via.placeholder.com/400x400/0077B5/FFFFFF?text=Professional+Blue",
            },
            {
                "id": "DAGQj5c7Ygx",
                "name": "Modern Business Post - Gradient",
                "thumbnail_url": "https://via.placeholder.com/400x400/667EEA/FFFFFF?text=Modern+Gradient",
            },
            {
                "id": "DAGQj5c7Ygy",
                "name": "Minimalist Quote - White",
                "thumbnail_url": "https://via.placeholder.com/400x400/FFFFFF/333333?text=Minimalist+White",
            },
            {
                "id": "DAGQj5c7Ygz",
                "name": "Bold Statement - Orange",
                "thumbnail_url": "https://via.placeholder.com/400x400/FF6B35/FFFFFF?text=Bold+Orange",
            },
            {
                "id": "DAGQj5c7Yg0",
                "name": "Corporate Professional - Navy",
                "thumbnail_url": "https://via.placeholder.com/400x400/004E7C/FFFFFF?text=Corporate+Navy",
            },
            {
                "id": "DAGQj5c7Yg1",
                "name": "Creative Agency - Purple",
                "thumbnail_url": "https://via.placeholder.com/400x400/7B2CBF/FFFFFF?text=Creative+Purple",
            }
        ]
        
        # Filter by query if provided
        if query:
            query_lower = query.lower()
            filtered = [t for t in base_templates if query_lower in t['name'].lower()]
            return filtered if filtered else base_templates[:3]
        
        return base_templates
    
    def _create_mock_design(self, template_id: Optional[str], title: Optional[str]) -> Dict:
        """Return mock design for demo purposes"""
        return {
            "id": f"design_{datetime.now().timestamp()}",
            "title": title or "LinkedIn Post Design",
            "urls": {
                "edit_url": f"https://www.canva.com/design/mock/edit",
                "view_url": f"https://www.canva.com/design/mock/view"
            },
            "created_at": datetime.now().isoformat(),
            "template_id": template_id,
            "mock": True
        }



