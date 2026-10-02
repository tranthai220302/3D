const path = require('path')

module.exports = {
  apps: [
    {
      name: 'app3d',
      script: 'index.js',
      cwd: path.join(__dirname, 'server'),
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
}