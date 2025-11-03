@echo off
echo Starting LinkedIn Pilot Backend...
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000

