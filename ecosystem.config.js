// PM2 Ecosystem Configuration for LinkedIn Pilot
// Start with: pm2 start ecosystem.config.js
// Save with: pm2 save
// Setup startup: pm2 startup

module.exports = {
  apps: [
    {
      name: 'linkedin-pilot-backend',
      script: '/var/www/linkedin-pilot/backend/venv/bin/uvicorn',
      args: 'server:app --host 0.0.0.0 --port 8000',
      cwd: '/var/www/linkedin-pilot/backend',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/var/www/linkedin-pilot/logs/backend-error.log',
      out_file: '/var/www/linkedin-pilot/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};

