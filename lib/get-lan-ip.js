// Plain JS (not .ts) so next.config.js can import it directly without a build
// step — lib/auth.ts imports it too, for the same "find my own LAN IP" need.
import os from 'node:os';

/**
 * The machine's current LAN IPv4 address (e.g. "192.168.1.153"), or null if
 * none is found (offline, or only loopback/virtual interfaces present).
 * Picks the first non-internal IPv4 address — good enough for a single-NIC
 * home dev machine; a multi-NIC/VPN setup may need to override manually via
 * BETTER_AUTH_TRUSTED_ORIGINS.
 */
export function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}
