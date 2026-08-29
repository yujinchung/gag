/**
 * 4명이 동시에 track 해도 presence가 덮이지 않는지 검증합니다.
 */
const fs = require('fs');
const path = require('path');

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

global.window = global;
global.localStorage = new MemoryStorage();
global.addEventListener = () => {};
global.removeEventListener = () => {};

let src = fs.readFileSync(path.join(__dirname, '../lib/localRealtime.js'), 'utf8')
  .replace("'use client';", '')
  .replace(/export function (\w+)/g, 'function $1');
src += '\nmodule.exports = { createLocalClient, isRealtimeConfigured };\n';
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const { createLocalClient } = mod.exports;

(async () => {
  const rt = createLocalClient();
  const names = ['원본', '탐침', '감시', '복원'];

  const clients = await Promise.all(names.map(async (name, i) => {
    const ch = rt.channel('pod-TEST');
    let members = [];
    ch.on('presence', { event: 'sync' }, () => {
      members = Object.values(ch.presenceState()).map((v) => v[0]).filter(Boolean);
    });
    await ch.subscribe();
    await ch.track({ id: `p${i}`, name, joinedAt: Date.now() + i });
    return { ch, getMembers: () => members };
  }));

  await new Promise((r) => setTimeout(r, 700));

  const counts = clients.map((c) => c.getMembers().length);
  const namesSeen = clients.map((c) => c.getMembers().map((m) => m.name).sort().join(','));
  console.log(JSON.stringify({ counts, namesSeen }, null, 2));

  if (counts.some((n) => n !== 4)) {
    console.error('FAIL: expected 4 members on every client');
    process.exit(1);
  }
  if (namesSeen.some((s) => s !== '감시,복원,원본,탐침')) {
    console.error('FAIL: member names did not converge');
    process.exit(1);
  }
  console.log('OK: 4 concurrent tracks visible to all clients');
  clients.forEach((c) => c.ch.unsubscribe());
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
