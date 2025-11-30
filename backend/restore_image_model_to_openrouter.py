#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('/var/www/linkedin-pilot/backend/.env')
content = p.read_text()
if re.search(r'^IMAGE_MODEL=', content, flags=re.M):
    content = re.sub(r'^IMAGE_MODEL=.*', 'IMAGE_MODEL=google/gemini-2.5-flash-image', content, flags=re.M)
else:
    if not content.endswith('\n'):
        content += '\n'
    content += 'IMAGE_MODEL=google/gemini-2.5-flash-image\n'

p.write_text(content)
print('IMAGE_MODEL set to google/gemini-2.5-flash-image')




