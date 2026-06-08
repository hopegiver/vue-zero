#!/usr/bin/env node

import { execSync } from 'child_process'

let data = ''
process.stdin.on('data', (chunk) => data += chunk)
process.stdin.on('end', () => {
  const filePath = (JSON.parse(data).tool_input.file_path || '').replace(/\\/g, '/')
  const shouldScan = filePath.endsWith('.vue') || filePath.includes('server/api/')
  if (shouldScan) {
    execSync('node bin/scan.js app server', { stdio: 'inherit' })
  }
})
