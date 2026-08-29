'use client';

/**
 * Supabase 키가 없을 때 쓰는 로컬 실시간 레이어.
 * 같은 브라우저의 탭끼리 BroadcastChannel + localStorage presence로 동기화합니다.
 * 채널 API는 @supabase/supabase-js 의 channel/broadcast/presence 와 맞춰 둡니다.
 *
 * presence는 맵 전체를 한 키에 쓰지 않습니다. 4명이 동시에 track 하면
 * last-write-wins로 서로 덮어써서 대기실에 1명만 남는 문제가 있었습니다.
 * 사람마다 키를 분리해 동시 입장에도 자리가 유지되게 합니다.
 */

const STALE_MS = 8000;

export function isRealtimeConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url.startsWith('https://') || key.length < 40) return false;
  if (url.includes('xxxxxxxx') || url.includes('placeholder')) return false;
  return true;
}

function presencePrefix(channelName) {
  return `clean-room-presence:${channelName}:`;
}

function presenceKey(channelName, id) {
  return `${presencePrefix(channelName)}${id}`;
}

function readAllPresence(channelName) {
  if (typeof localStorage === 'undefined') return {};
  const prefix = presencePrefix(channelName);
  const now = Date.now();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  const map = {};
  for (const key of keys) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      if (v?.id && now - (v._ts || 0) < STALE_MS) map[v.id] = v;
      else localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
  return map;
}

function toPresenceState(map) {
  const state = {};
  for (const [k, v] of Object.entries(map)) {
    const { _ts, ...data } = v;
    state[k] = [data];
  }
  return state;
}

export function createLocalClient() {
  return {
    channel(name) {
      const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`clean-room:${name}`) : null;
      const handlers = { presenceSync: [], broadcast: {} };
      let tracked = null;
      let heartbeat = null;
      let onStorage = null;
      let alive = true;
      let presenceState = {};

      const emitPresence = () => {
        presenceState = toPresenceState(readAllPresence(name));
        handlers.presenceSync.forEach((fn) => fn());
      };

      const writeOwn = () => {
        if (!tracked || typeof localStorage === 'undefined') return;
        tracked = { ...tracked, _ts: Date.now() };
        localStorage.setItem(presenceKey(name, tracked.id), JSON.stringify(tracked));
      };

      const ch = {
        presenceState() {
          return presenceState;
        },
        on(type, filter, cb) {
          if (type === 'presence' && filter?.event === 'sync') handlers.presenceSync.push(cb);
          if (type === 'broadcast' && filter?.event) {
            handlers.broadcast[filter.event] = handlers.broadcast[filter.event] || [];
            handlers.broadcast[filter.event].push(cb);
          }
          return ch;
        },
        async subscribe(cb) {
          if (bc) {
            bc.onmessage = (e) => {
              const { kind, event, payload } = e.data || {};
              if (kind === 'broadcast') {
                (handlers.broadcast[event] || []).forEach((fn) => fn({ payload }));
              }
              if (kind === 'presence' || kind === 'announce') {
                if (kind === 'announce' && tracked) writeOwn();
                emitPresence();
              }
            };
          }
          onStorage = (e) => {
            if (e.key && e.key.startsWith(presencePrefix(name))) emitPresence();
          };
          window.addEventListener('storage', onStorage);
          emitPresence();
          if (cb) await cb('SUBSCRIBED');
          return 'SUBSCRIBED';
        },
        async track(data) {
          tracked = { ...data, _ts: Date.now() };
          writeOwn();
          bc?.postMessage({ kind: 'presence' });
          bc?.postMessage({ kind: 'announce' });
          emitPresence();
          [50, 200, 500].forEach((ms) => {
            setTimeout(() => {
              if (!alive || !tracked) return;
              writeOwn();
              emitPresence();
            }, ms);
          });
          heartbeat = setInterval(() => {
            if (!alive || !tracked) return;
            writeOwn();
            emitPresence();
          }, 2000);
        },
        async send({ event, payload }) {
          const msg = { kind: 'broadcast', event, payload };
          bc?.postMessage(msg);
          // BroadcastChannel는 보낸 탭에 메아리치지 않음. 엔진이 자기 action을 받도록 로컬 전달.
          (handlers.broadcast[event] || []).forEach((fn) => fn({ payload }));
        },
        unsubscribe() {
          alive = false;
          if (heartbeat) clearInterval(heartbeat);
          if (onStorage) window.removeEventListener('storage', onStorage);
          if (tracked && typeof localStorage !== 'undefined') {
            localStorage.removeItem(presenceKey(name, tracked.id));
            bc?.postMessage({ kind: 'presence' });
          }
          bc?.close();
        },
      };
      return ch;
    },
    removeChannel(ch) {
      ch?.unsubscribe?.();
    },
  };
}
