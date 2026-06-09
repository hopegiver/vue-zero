#!/usr/bin/env node

import { execSync } from 'child_process'

let data = ''
process.stdin.on('data', (chunk) => data += chunk)
process.stdin.on('end', () => {
  const filePath = (JSON.parse(data).tool_input.file_path || '').replace(/\\/g, '/')
  if (filePath.endsWith('.vue')) {
    execSync('node bin/scan.js app', { stdio: 'inherit' })
  } else if (filePath.includes('server/api/')) {
    execSync('node bin/scan.js server', { stdio: 'inherit' })
  }
})
