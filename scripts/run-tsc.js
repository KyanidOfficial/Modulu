#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const args = process.argv.slice(2)
const localTsc = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc')

const run = (command, commandArgs) => spawnSync(command, commandArgs, { stdio: 'inherit', shell: process.platform === 'win32' })

if (fs.existsSync(localTsc)) {
  const result = run(process.execPath, [localTsc, ...args])
  process.exit(result.status ?? 1)
}

const fallback = run('npx', ['--yes', 'tsc', ...args])
if (fallback.status === 0) {
  process.exit(0)
}

console.error('[build:risk] TypeScript compiler not found.')
console.error('[build:risk] Run: npm install --save-dev typescript')
process.exit(fallback.status ?? 1)
