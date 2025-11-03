"""
Content extraction service for various material types
Handles websites, PDFs, images, and documents
"""
import aiohttp
import asyncio
from bs4 import BeautifulSoup
from pathlib import Path
from typing import Dict, Optional
import base64
import mimetypes

class ContentExtractor:
    """Extract and process content from various sources"""
    
    @staticmethod
    async def extract_from_url(url: str) -> Dict[str, str]:
        """Extract text content from a website or blog"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as response:
                    if response.status != 200:
                        return {"error": f"HTTP {response.status}"}
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Remove script and style elements
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    
                    # Get title
                    title = soup.title.string if soup.title else url
                    
                    # Get meta description
                    meta_desc = ""
                    meta_tag = soup.find("meta", attrs={"name": "description"})
                    if meta_tag and meta_tag.get("content"):
                        meta_desc = meta_tag["content"]
                    
                    # Get main content
                    # Try to find main content areas
                    main_content = soup.find("main") or soup.find("article") or soup.find("body")
                    
                    if main_content:
                        # Get text
                        text = main_content.get_text(separator="\n", strip=True)
                        # Clean up multiple newlines
                        text = "\n".join(line.strip() for line in text.split("\n") if line.strip())
                    else:
                        text = soup.get_text(separator="\n", strip=True)
                    
                    return {
                        "title": title,
                        "description": meta_desc,
                        "content": text[:15000],  # Limit content length
                        "url": url
                    }
                    
        except asyncio.TimeoutError:
            return {"error": "Request timeout"}
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    async def extract_from_pdf(file_path: str) -> Dict[str, str]:
        """Extract text from PDF file"""
        try:
            # Try PyPDF2 first
            try:
                import PyPDF2
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page in pdf_reader.pages[:50]:  # Limit to first 50 pages
                        text += page.extract_text() + "\n"
                    
                    return {
                        "content": text[:15000],
                        "pages": len(pdf_reader.pages),
                        "source": "pdf"
                    }
            except ImportError:
                # Fallback: try pdfplumber
                try:
                    import pdfplumber
                    text = ""
                    with pdfplumber.open(file_path) as pdf:
                        for page in pdf.pages[:50]:
                            text += page.extract_text() + "\n"
                    
                    return {
                        "content": text[:15000],
                        "pages": len(pdf.pages),
                        "source": "pdf"
                    }
                except ImportError:
                    return {"error": "PDF extraction libraries not available. Install PyPDF2 or pdfplumber."}
                    
        except Exception as e:
            return {"error": f"PDF extraction failed: {str(e)}"}
    
    @staticmethod
    async def extract_from_image(file_path: str, api_key: str) -> Dict[str, str]:
        """Extract information from image using vision AI"""
        try:
            # Read image and convert to base64
            with open(file_path, 'rb') as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Determine mime type
            mime_type = mimetypes.guess_type(file_path)[0] or 'image/jpeg'
            
            # Use OpenRouter with vision model
            from ..adapters.llm_adapter import LLMAdapter
            llm = LLMAdapter(api_key=api_key, provider="openrouter")
            
            prompt = """Analyze this image and extract:
1. What the image shows (products, people, branding, etc.)
2. Any text visible in the image
3. Brand elements (colors, logos, style)
4. The overall message or purpose
5. Target audience implications

Provide a detailed description that captures the brand identity and messaging."""

            # Call vision model
            description = await llm.generate_with_image(prompt, image_data, mime_type)
            
            return {
                "content": description,
                "type": "image_analysis",
                "source": "vision_ai"
            }
            
        except Exception as e:
            return {"error": f"Image analysis failed: {str(e)}"}
    
    @staticmethod
    async def extract_from_document(file_path: str) -> Dict[str, str]:
        """Extract text from document files (.txt, .doc, .docx)"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return {
                    "content": content[:15000],
                    "source": "text_file"
                }
            
            elif file_ext in ['.doc', '.docx']:
                try:
                    import docx
                    doc = docx.Document(file_path)
                    text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                    return {
                        "content": text[:15000],
                        "source": "word_document"
                    }
                except ImportError:
                    return {"error": "python-docx not installed. Install it to process Word documents."}
            
            else:
                # Try reading as text
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return {
                    "content": content[:15000],
                    "source": "generic_text"
                }
                
        except Exception as e:
            return {"error": f"Document extraction failed: {str(e)}"}
