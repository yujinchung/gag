'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BALANCE, POD_SIZE } from './game';
import { createLocalClient, isRealtimeConfigured } from './localRealtime';

const GLOBAL = 'clean-room-global';

let realtime = null;
let realtimeMode = 'local';

function getRealtime() {
  if (realtime) return { client: realtime, mode: realtimeMode };
  if (typeof window === 'undefined') return { client: null, mode: 'local' };
  if (isRealtimeConfigured()) {
    realtime = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { realtime: { params: { eventsPerSecond: 20 } } },
    );
    realtimeMode = 'live';
  } else {
    realtime = createLocalClient();
    realtimeMode = 'local';
  }
  return { client: realtime, mode: realtimeMode };
}

export { isRealtimeConfigured };
export const supabaseConfigured = isRealtimeConfigured();

export function isLocalMode() {
  return typeof window !== 'undefined' && !isRealtimeConfigured();
}

function loadMe(code) {
  const key = `cr-me:${String(code).toUpperCase()}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved?.id && typeof saved.joinedAt === 'number') return saved;
  } catch { /* ignore */ }
  const me = {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    joinedAt: Date.now(),
  };
  sessionStorage.setItem(key, JSON.stringify(me));
  return me;
}

function membersFromPresence(raw) {
  return Object.values(raw)
    .map((v) => v[0])
    .filter(Boolean)
    .sort((a, b) => a.joinedAt - b.joinedAt || String(a.id).localeCompare(String(b.id)));
}

/**
 * 팟 하나의 실시간 연결.
 * 스키마도 인증도 필요 없습니다. Realtime broadcast + presence만 씁니다.
 *
 * 엔진 선출: presence에 먼저 들어온 사람이 엔진이 되어 상태를 소유하고
 * 매 변경마다 전체 상태를 broadcast 합니다. 나머지는 action만 보냅니다.
 *
 * 늦게 들어온 사람·동시 4인 입장을 위해 hello에 현재 상태를 다시 보냅니다.
 */
export function useRoom({ code, name, onAction }) {
  const [members, setMembers] = useState([]);
  const [state, setStateRaw] = useState(null);
  const [isEngine, setIsEngine] = useState(false);
  const [conn, setConn] = useState({ status: 'idle', mode: 'local' });
  const [forceLocal, setForceLocal] = useState(false);
  const channelRef = useRef(null);
  const meRef = useRef(null);
  const onActionRef = useRef(onAction);
  const stateHoldRef = useRef(null);
  const isEngineRef = useRef(false);
  const memberCountRef = useRef(0);

  onActionRef.current = onAction;

  const setState = useCallback((next) => {
    const value = typeof next === 'function' ? next(stateHoldRef.current) : next;
    stateHoldRef.current = value;
    setStateRaw(value);
  }, []);

  useEffect(() => {
    if (!code || !name) return;
    const me = loadMe(code);
    meRef.current = me;
    const self = { id: me.id, name, joinedAt: me.joinedAt };
    setMembers([self]);
    isEngineRef.current = true;
    setIsEngine(true);

    const live = getRealtime();
    const mode = forceLocal ? 'local' : live.mode;
    const rt = forceLocal ? createLocalClient() : live.client;
    if (!rt) {
      setConn({ status: 'subscribed', mode: 'local' });
      return;
    }
    setConn({ status: 'connecting', mode });
    let subscribed = false;

    const ch = rt.channel(`pod-${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: true } },
    });
    channelRef.current = ch;

    const replyStateIfEngine = () => {
      if (isEngineRef.current && stateHoldRef.current) {
        ch.send({ type: 'broadcast', event: 'state', payload: stateHoldRef.current });
      }
    };

    ch.on('presence', { event: 'sync' }, () => {
      const list = membersFromPresence(ch.presenceState());
      const next = list.length ? list : [self];
      setMembers(next);
      isEngineRef.current = next[0].id === me.id;
      setIsEngine(isEngineRef.current);
      if (next.length !== memberCountRef.current) {
        memberCountRef.current = next.length;
        replyStateIfEngine();
      }
    });

    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      stateHoldRef.current = payload;
      setStateRaw(payload);
    });
    ch.on('broadcast', { event: 'action' }, ({ payload }) => {
      onActionRef.current?.(payload);
    });
    ch.on('broadcast', { event: 'hello' }, () => {
      replyStateIfEngine();
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        setConn({ status: 'subscribed', mode });
        await ch.track(self);
        ch.send({ type: 'broadcast', event: 'hello', payload: { id: me.id } });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (mode === 'live' && !forceLocal) {
          setForceLocal(true);
          return;
        }
        setConn({ status: 'error', mode });
      }
    });

    const timeout = setTimeout(() => {
      if (!subscribed && mode === 'live' && !forceLocal) setForceLocal(true);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      channelRef.current = null;
      rt.removeChannel(ch);
    };
  }, [code, name, forceLocal]);

  const send = useCallback((event, payload) => {
    const ch = channelRef.current;
    if (ch) {
      ch.send({ type: 'broadcast', event, payload });
      return;
    }
    if (event === 'action') onActionRef.current?.(payload);
    if (event === 'state') {
      stateHoldRef.current = payload;
      setStateRaw(payload);
    }
  }, []);

  const pod = members.slice(0, POD_SIZE);
  const seatIndex = pod.findIndex((m) => m.id === meRef.current?.id);
  const full = members.length >= POD_SIZE;
  const overflow = members.length > POD_SIZE;

  return {
    members,
    pod,
    seatIndex,
    me: meRef.current,
    state,
    setState,
    isEngine,
    send,
    conn,
    full,
    overflow,
  };
}

/**
 * 10팟이 공유하는 오염 게이지. 어떤 팟이든 오염 이벤트를 쏘면
 * 모든 화면이 같은 값으로 올라갑니다. 호스트 서버 없이 동작합니다.
 */
export function useGlobalPollution({ podCode, score = 0, clean = 100 }) {
  const [pollution, setPollution] = useState(0);
  const [board, setBoard] = useState({});
  const chRef = useRef(null);
  const metaRef = useRef({ podCode, score, clean });
  metaRef.current = { podCode, score, clean };

  useEffect(() => {
    const { client: rt } = getRealtime();
    if (!rt) return;
    const ch = rt.channel(GLOBAL, { config: { broadcast: { self: true } } });
    chRef.current = ch;
    ch.on('broadcast', { event: 'pollute' }, ({ payload }) => {
      setPollution((p) => Math.max(0, Math.min(100, p + payload.amount)));
    });
    ch.on('broadcast', { event: 'board' }, ({ payload }) => {
      setBoard((b) => ({ ...b, [payload.pod]: payload }));
    });
    ch.on('broadcast', { event: 'ping' }, () => {
      const { podCode: pod, score: sc, clean: cl } = metaRef.current;
      if (pod) ch.send({ type: 'broadcast', event: 'board', payload: { pod, score: sc, clean: cl } });
    });
    ch.subscribe();
    const decay = setInterval(
      () => setPollution((p) => Math.max(0, p - BALANCE.pollutionDecayPer15s)),
      15000,
    );
    return () => { clearInterval(decay); rt.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!podCode) return;
    chRef.current?.send({ type: 'broadcast', event: 'board', payload: { pod: podCode, score, clean } });
  }, [podCode, score, clean]);

  const pollute = useCallback((amount) => {
    chRef.current?.send({ type: 'broadcast', event: 'pollute', payload: { amount } });
  }, []);

  const requestBoard = useCallback(() => {
    chRef.current?.send({ type: 'broadcast', event: 'ping', payload: {} });
  }, []);

  const smog = pollution >= BALANCE.smogThreshold;
  return { pollution, smog, pollute, board, requestBoard };
}

export function fogText(text, on) {
  if (!on) return text;
  return text
    .split(' ')
    .map((w, i) => (w.length > 1 && i % 3 === 1 ? '█'.repeat(w.length) : w))
    .join(' ');
}
