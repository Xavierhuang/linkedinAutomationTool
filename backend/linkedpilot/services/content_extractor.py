"""
Content extraction service for various material types
Handles websites, PDFs, images, and documents
"""
import aiohttp
import asyncio
import re
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
                    
                    # Remove only script and style elements, but keep footer and header for content extraction
                    for script in soup(["script", "style"]):
                        script.decompose()
                    
                    # Extract footer links for later analysis
                    footer_links = []
                    footer = soup.find("footer")
                    if footer:
                        for link in footer.find_all("a", href=True):
                            href = link.get("href")
                            if href:
                                # Convert relative URLs to absolute
                                from urllib.parse import urljoin, urlparse
                                full_url = urljoin(url, href)
                                # Only include same-domain links
                                if urlparse(full_url).netloc == urlparse(url).netloc:
                                    link_text = link.get_text(strip=True)
                                    if link_text and len(link_text) > 2:
                                        footer_links.append({
                                            "url": full_url,
                                            "text": link_text
                                        })
                    
                    # Extract header content (but exclude navigation menus)
                    header_content = ""
                    header = soup.find("header")
                    if header:
                        # Get text from header but exclude nav elements
                        header_copy = BeautifulSoup(str(header), 'html.parser')
                        for nav in header_copy.find_all("nav"):
                            nav.decompose()
                        header_text = header_copy.get_text(separator="\n", strip=True)
                        if header_text and len(header_text) > 10:
                            header_content = header_text
                    
                    # Extract footer content
                    footer_content = ""
                    footer = soup.find("footer")
                    if footer:
                        footer_text = footer.get_text(separator="\n", strip=True)
                        if footer_text and len(footer_text) > 10:
                            footer_content = footer_text
                    
                    # Get title
                    title = soup.title.string if soup.title else url
                    
                    # Get meta description
                    meta_desc = ""
                    meta_tag = soup.find("meta", attrs={"name": "description"})
                    if meta_tag and meta_tag.get("content"):
                        meta_desc = meta_tag["content"]
                    
                    # Get hero image
                    hero_image = ""
                    # Try OpenGraph image
                    og_image = soup.find("meta", property="og:image")
                    if og_image and og_image.get("content"):
                        hero_image = og_image["content"]
                    # Try Twitter image
                    elif soup.find("meta", property="twitter:image"):
                        hero_image = soup.find("meta", property="twitter:image").get("content")
                    # Try first large image
                    else:
                        images = soup.find_all("img")
                        for img in images:
                            src = img.get("src")
                            if src and not src.endswith(".svg") and "logo" not in src.lower() and "icon" not in src.lower():
                                # Basic check to avoid small icons - in real app would check dimensions
                                if src.startswith("http"):
                                    hero_image = src
                                    break
                                elif src.startswith("//"):
                                    hero_image = "https:" + src
                                    break
                                elif src.startswith("/"):
                                    # Construct full URL
                                    from urllib.parse import urljoin
                                    hero_image = urljoin(url, src)
                                    break
                    
                    # Get main content - try multiple strategies to get more content
                    # Strategy 1: Try semantic HTML5 elements
                    main_content = (
                        soup.find("main") or 
                        soup.find("article") or 
                        soup.find("section", class_=re.compile(r'content|main|body', re.I)) or
                        soup.find("div", class_=re.compile(r'content|main|body|post|entry', re.I)) or
                        soup.find("body")
                    )
                    
                    if main_content:
                        # Get text with better formatting
                        text = main_content.get_text(separator="\n", strip=True)
                        # Clean up multiple newlines but preserve structure
                        lines = [line.strip() for line in text.split("\n") if line.strip()]
                        text = "\n".join(lines)
                    else:
                        # Fallback: get all text but remove scripts/styles - be less restrictive
                        text = soup.get_text(separator="\n", strip=True)
                        lines = [line.strip() for line in text.split("\n") if line.strip()]  # Removed minimum length filter
                        text = "\n".join(lines)
                        print(f"   [EXTRACT] Using fallback text extraction: {len(text)} chars")
                    
                    # Also try to get structured content from common content sections
                    content_sections = []
                    for selector in ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'div[class*="content"]', 'div[class*="text"]', 'section', 'article']:
                        elements = soup.select(selector)
                        for elem in elements[:150]:  # Increased from 50 to 150
                            elem_text = elem.get_text(strip=True)
                            if elem_text and len(elem_text) > 5:  # Lower threshold from 20 to 5 to get more content
                                content_sections.append(elem_text)
                    
                    # Combine structured content if we got meaningful sections
                    if content_sections and len('\n'.join(content_sections)) > len(text):
                        structured_text = '\n'.join(content_sections)
                        # Merge with main text, avoiding duplicates
                        if structured_text not in text:
                            text = f"{text}\n\n{structured_text}"
                    
                    # Add header content if available
                    if header_content:
                        if header_content not in text:
                            text = f"{header_content}\n\n{text}"
                    
                    # Add footer content if available
                    if footer_content:
                        if footer_content not in text:
                            text = f"{text}\n\n--- FOOTER ---\n{footer_content}"
                    
                    # Ensure we have maximum content - if still too short, get more from body
                    if len(text) < 2000:  # Increased threshold from 200 to 2000
                        body_text = soup.find("body")
                        if body_text:
                            body_content = body_text.get_text(separator=" ", strip=True)
                            # Take more chars of body as fallback (increased from 5000 to 15000)
                            if len(body_content) > len(text):
                                text = body_content[:15000]
                                print(f"   [EXTRACT] Extended content with body text: {len(text)} chars")
                    
                    # Extract content from multiple pages (footer links + navigation links)
                    all_internal_links = []
                    
                    # Get footer links
                    if footer_links:
                        all_internal_links.extend(footer_links)
                    
                    # Also get navigation links from header/nav
                    nav = soup.find("nav")
                    if nav:
                        for link in nav.find_all("a", href=True):
                            href = link.get("href")
                            if href:
                                from urllib.parse import urljoin, urlparse
                                full_url = urljoin(url, href)
                                # Only include same-domain links
                                if urlparse(full_url).netloc == urlparse(url).netloc:
                                    link_text = link.get_text(strip=True)
                                    if link_text and len(link_text) > 2:
                                        link_info = {
                                            "url": full_url,
                                            "text": link_text
                                        }
                                        # Avoid duplicates
                                        if not any(existing['url'] == full_url for existing in all_internal_links):
                                            all_internal_links.append(link_info)
                    
                    # Extract content from up to 10 pages
                    pages_content = []
                    if all_internal_links:
                        print(f"   [EXTRACT] Found {len(all_internal_links)} internal links, analyzing up to 10 pages...")
                        
                        # Prioritize important pages (About, Contact, Services, Products, etc.)
                        important_keywords = ['about', 'contact', 'company', 'team', 'mission', 'vision', 'values', 'services', 'products', 'solutions', 'blog', 'news', 'careers', 'culture']
                        
                        # Sort links: important ones first, then others
                        prioritized_links = []
                        other_links = []
                        
                        for link in all_internal_links:
                            if any(keyword in link['text'].lower() or keyword in link['url'].lower() for keyword in important_keywords):
                                prioritized_links.append(link)
                            else:
                                other_links.append(link)
                        
                        # Combine: important first, then others, limit to 10 total
                        links_to_extract = (prioritized_links + other_links)[:10]
                        
                        # Extract content from selected pages
                        for link_info in links_to_extract:
                            try:
                                page_url = link_info['url']
                                print(f"   [EXTRACT] Analyzing page {len(pages_content) + 1}/10: {link_info['text']} ({page_url})")
                                
                                async with session.get(page_url, timeout=15) as page_response:
                                    if page_response.status == 200:
                                        page_html = await page_response.text()
                                        page_soup = BeautifulSoup(page_html, 'html.parser')
                                        
                                        # Remove scripts/styles
                                        for script in page_soup(["script", "style"]):
                                            script.decompose()
                                        
                                        # Extract main content - try multiple strategies to get ALL text
                                        page_content = page_soup.find("main") or page_soup.find("article") or page_soup.find("body")
                                        
                                        if page_content:
                                            # Get all text from the page content
                                            page_text = page_content.get_text(separator="\n", strip=True)
                                            # Clean up but keep more content - only filter truly empty lines
                                            page_lines = [line.strip() for line in page_text.split("\n") if line.strip()]
                                            page_text = "\n".join(page_lines)
                                            
                                            # If main content is short, also try getting structured content
                                            if len(page_text) < 1000:
                                                # Try to get more structured content
                                                structured_parts = []
                                                for selector in ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'div[class*="content"]', 'div[class*="text"]']:
                                                    elements = page_soup.select(selector)
                                                    for elem in elements[:100]:  # Increase limit
                                                        elem_text = elem.get_text(strip=True)
                                                        if elem_text and len(elem_text) > 5:  # Lower threshold
                                                            structured_parts.append(elem_text)
                                                
                                                if structured_parts:
                                                    structured_text = "\n".join(structured_parts)
                                                    if len(structured_text) > len(page_text):
                                                        page_text = structured_text
                                            
                                            # Use more text per page (increased from 3000 to 8000)
                                            if page_text and len(page_text) > 20:  # Lower threshold from 50
                                                pages_content.append(f"\n--- {link_info['text'].upper()} PAGE ---\n{page_text[:8000]}")
                                                print(f"   [EXTRACT] Extracted {len(page_text)} chars from {link_info['text']} (using {min(len(page_text), 8000)} chars)")
                                            
                                            # Stop if we've extracted from 10 pages
                                            if len(pages_content) >= 10:
                                                break
                            except Exception as e:
                                print(f"   [EXTRACT] Failed to extract page {link_info['url']}: {e}")
                                continue
                        
                        # Add pages content to main text
                        if pages_content:
                            pages_text = "\n".join(pages_content)
                            text = f"{text}\n\n{pages_text}"
                            print(f"   [EXTRACT] Added content from {len(pages_content)} pages ({len(pages_text)} total characters)")
                    
                    # Get all images
                    extracted_images = []
                    images = soup.find_all("img")
                    for img in images:
                        src = img.get("src")
                        if src and not src.endswith(".svg") and "logo" not in src.lower() and "icon" not in src.lower():
                            # Basic check to avoid small icons - in real app would check dimensions
                            if src.startswith("http"):
                                full_src = src
                            elif src.startswith("//"):
                                full_src = "https:" + src
                            elif src.startswith("/"):
                                # Construct full URL
                                from urllib.parse import urljoin
                                full_src = urljoin(url, src)
                            else:
                                continue
                                
                            if full_src not in extracted_images:
                                extracted_images.append(full_src)
                                
                            # Limit to 12 images
                            if len(extracted_images) >= 12:
                                break

                    # Increase content limit to accommodate footer pages
                    # Increase content limit to accommodate multiple pages (10 pages * 8000 chars = 80000, but we'll use 100000 for safety)
                    final_content = text[:100000]  # Increased from 30000 to 100000 to accommodate up to 10 pages with full content
                    print(f"   [EXTRACT] Final content length: {len(final_content)} chars (truncated from {len(text)})")
                    
                    return {
                        "title": title,
                        "description": meta_desc,
                        "image": hero_image,
                        "images": extracted_images,
                        "content": final_content,
                        "url": url,
                        "footer_links": [link['url'] for link in footer_links[:10]]  # Include footer links for reference
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
