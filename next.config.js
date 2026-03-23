/** @type {import('next').NextConfig} */
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { randomBytes } = require('crypto');
const path = require('path');

// Generate (or load) a persistent JWT secret so the Edge middleware
// and Node.js API routes share the same signing key without any manual setup.
const secretFile = path.join(__dirname, '.jwt-secret');
let authSecret;
if (existsSync(secretFile)) {
  authSecret = readFileSync(secretFile, 'utf-8').trim();
} else {
  authSecret = randomBytes(64).toString('hex');
  writeFileSync(secretFile, authSecret);
}

const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  env: {
    AUTH_SECRET: authSecret,
  },
};

module.exports = nextConfig;
