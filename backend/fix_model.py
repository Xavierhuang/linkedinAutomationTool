#!/usr/bin/env python3
"""Fix IMAGE_MODEL in backend .env"""
import re

env_file = "/var/www/linkedin-pilot/backend/.env"

with open(env_file, "r") as f:
    content = f.read()

# Replace IMAGE_MODEL line
content = re.sub(r"IMAGE_MODEL=.*", "IMAGE_MODEL=gemini-2.0-flash-exp", content)

with open(env_file, "w") as f:
    f.write(content)

print("Updated IMAGE_MODEL to gemini-2.0-flash-exp")





