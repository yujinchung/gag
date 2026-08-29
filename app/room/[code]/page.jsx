'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRoom, useGlobalPollution } from '../../../lib/useRoom';
import {
  BALANCE, ROLE_LABEL, ROLE_KO, ROLE_BRIEF, roleFor, roundScore, newRoundState, meter,
} from '../../../lib/game';
import { HolderView, ProberView, WatcherView, RestorerView } from '../../../components/Views';

const NEXT = { deal: 'probe', probe: 'restore', restore: 'settle' };

export default function Room() {
  const { code } = useParams();
  const [name, setName] = useState('');
  const [signal, setSignal] = useState(null);

  useEffect(() => {
    setName(sessionStorage.getItem('cr-name') || '익명');
    try { setSignal(JSON.parse(sessionStorage.getItem('cr-signal'))); } catch (e) { setSignal(null); }
  }, []);

  const stateRef = useRef(null);
  const signalRef = useRef(null);
  const engineRef = useRef(false);
  const scoringRef = useRef(false);
  const [total, setTotal] = useState(0);
  const [avgClean, setAvgClean] = useState(100);

  const { members, seatIndex, state, setState, isEngine, send } = useRoom({
    code, name, onAction: (a) => engineRef.current && applyAction(a),
  });
  engineRef.current = isEngine;
  stateRef.current = state;
  signalRef.current = signal;

  const { pollution, smog, pollute } = useGlobalPollution({ podCode: code, score: total, clean: avgClean });

  // 화면 자체가 오염 게이지입니다.
  useEffect(() => {
    document.body.dataset.air = smog ? 'smog' : pollution >= 35 ? 'haze' : 'clear';
    return () => { document.body.dataset.air = 'clear'; };
  }, [pollution, smog]);

  const push = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    send('state', next);
  }, [send, setState]);

  function applyAction(a) {
    const st = stateRef.current;
    if (!st) return;
    if (a.kind === 'question') {
      const q = { id: Date.now(), text: a.text, clean: a.clean, note: a.note, voided: false };
      if (a.clean < 50) pollute(BALANCE.pollutionPerBadQuestion);
      push({ ...st, questions: [...st.questions, q] });
    }
    if (a.kind === 'answer') push({ ...st, answers: [...st.answers, { text: a.text }] });
    if (a.kind === 'challenge') {
      const q = st.questions.find((x) => x.id === a.qid);
      if (!q || st.challengesLeft <= 0) return;
      const win = q.clean < 60;
      if (win) pollute(-BALANCE.pollutionCleanse);
      push({
        ...st,
        challengesLeft: st.challengesLeft - 1,
        challengeWins: st.challengeWins + (win ? 1 : 0),
        questions: st.questions.map((x) => (x.id === a.qid ? { ...x, voided: win } : x)),
        phaseEndsAt: win ? st.phaseEndsAt : st.phaseEndsAt - BALANCE.challengePenaltySec * 1000,
      });
    }
    if (a.kind === 'restoreGuess') push({ ...st, restore: { guess: a.guess } });
    if (a.kind === 'restoreScore') {
      push({ ...st, restore: { ...(st.restore || {}), scores: a.scores, reveal: a.reveal } });
    }
  }

  // 대조는 원본 보유자 기기에서만. 시그널 원문은 팟에 전송되지 않습니다.
  useEffect(() => {
    const role = state?.started ? roleFor(seatIndex, state.round) : null;
    if (role !== 'holder' || !state?.restore?.guess || state.restore.scores || scoringRef.current) return;
    scoringRef.current = true;
    (async () => {
      let scores = { body: 50, space: 50, condition: 50, note: '' };
      try {
        const r = await fetch('/api/restore', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ truth: signalRef.current, guess: state.restore.guess }),
        });
        scores = await r.json();
      } catch (e) { /* 중립 처리 */ }
      const sg = signalRef.current || {};
      send('action', {
        kind: 'restoreScore',
        scores,
        // 은유 3요소만 공개합니다. 문제 원문은 원본 보유자만 봅니다.
        reveal: { body: sg.body, space: sg.space, condition: sg.condition },
      });
      scoringRef.current = false;
    })();
  }, [state, seatIndex, send]);

  useEffect(() => {
    if (!isEngine) return;
    const t = setInterval(() => {
      const st = stateRef.current;
      if (!st || !st.started || st.phase === 'end') return;
      if (Date.now() < st.phaseEndsAt) return;

      if (st.phase === 'settle') {
        if (st.round >= BALANCE.rounds) { push({ ...st, phase: 'end' }); return; }
        push({ ...st, ...newRoundState(st.round + 1), started: true, history: st.history });
        return;
      }
      const phase = NEXT[st.phase];
      let history = st.history || [];
      if (phase === 'settle') {
        const s = st.restore?.scores || {};
        const pts = roundScore({
          restoreScores: [s.body || 0, s.space || 0, s.condition || 0],
          cleanScores: st.questions.filter((q) => !q.voided).map((q) => q.clean),
          challengeWins: st.challengeWins,
          round: st.round,
        });
        history = [...history, { round: st.round, pts, note: s.note || '' }];
      }
      push({ ...st, phase, history, phaseEndsAt: Date.now() + BALANCE.phase[phase] * 1000 });
    }, 500);
    return () => clearInterval(t);
  }, [isEngine, push]);

  useEffect(() => {
    if (!state) return;
    setTotal((state.history || []).reduce((a, h) => a + h.pts, 0));
    const cs = state.questions?.filter((q) => !q.voided).map((q) => q.clean) || [];
    setAvgClean(cs.length ? Math.round(cs.reduce((a, b) => a + b, 0) / cs.length) : 100);
  }, [state]);

  const [left, setLeft] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setLeft(state?.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 0);
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  const start = () => push({ started: true, history: [], ...newRoundState(1) });
  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const role = state?.started ? roleFor(seatIndex, state.round) : null;
  const sourceName = state?.started ? members[(seatIndex - (state.round - 1) + 400) % 4]?.name : null;

  return (
    <div className="wrap">
      {smog && <div className="smog-label">S M O G &nbsp; 대기 오염 임계 초과</div>}

      <div className="bar">
        <span>POD {code}</span>
        {state?.started && <span>CYCLE {state.round}/{BALANCE.rounds}</span>}
        <span className="spacer" />
        {state?.started && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{mmss}</span>}
      </div>

      {!state?.started && (
        <>
          <p className="eyebrow">대기실 · 정화팀 편성</p>
          <h1>POD {code}</h1>
          <p>4명이 모이면 개시합니다. 이 코드를 팀원에게 전달하세요.</p>
          <div className="panel">
            {members.map((m, i) => (
              <div key={m.id} className="log">
                <span className="tag">{String(i + 1).padStart(2, '0')}</span>{m.name}
                {i === 0 && <span className="tag" style={{ marginLeft: 8 }}>진행 기기</span>}
              </div>
            ))}
          </div>
          {isEngine
            ? <button onClick={start} disabled={members.length < 2}>정화 개시 ({members.length}/4)</button>
            : <p>진행 기기의 개시 신호를 기다리는 중.</p>}
          {!signal && <p style={{ color: 'var(--taint)' }}>시그널이 등록되지 않았습니다. 첫 화면으로 돌아가 등록하세요.</p>}
        </>
      )}

      {state?.started && state.phase !== 'end' && (
        <>
          <div className="between">
            <span className="role-tag">{ROLE_LABEL[role]} · {ROLE_KO[role]}</span>
            <span className="num">{total}</span>
          </div>
          <p style={{ fontSize: 13 }}>{ROLE_BRIEF[role]}</p>

          {state.phase === 'deal' && (
            <div className="panel accent">
              <p className="eyebrow">사이클 {state.round} 개시</p>
              <h2>이번 사이클의 원본: {sourceName || '배정 중'}</h2>
              <p>{ROLE_BRIEF[role]}</p>
            </div>
          )}

          {(state.phase === 'probe' || state.phase === 'restore') && (
            <>
              {role === 'holder' && signal && <HolderView st={state} send={send} smog={smog} signal={signal} />}
              {role === 'prober' && <ProberView st={state} send={send} smog={smog} />}
              {role === 'watcher' && (
                <WatcherView st={state} send={send} pollution={pollution}
                  crossWatch={state.round === BALANCE.crossWatchRound} />
              )}
              {role === 'restorer' && <RestorerView st={state} send={send} smog={smog} />}
            </>
          )}

          {state.phase === 'settle' && (
            <div className="panel accent">
              <p className="eyebrow">대조 결과 · 사이클 {state.round}</p>
              <h2>{(state.history || []).slice(-1)[0]?.pts ?? 0}</h2>
              <div className="log"><span className="tag">원본</span>{state.restore?.reveal?.body || '대조 중'}</div>
              <div className="log"><span className="tag">복원</span>{state.restore?.guess?.body || '미전송'}</div>
              <p style={{ color: 'var(--fg)' }}>{state.restore?.scores?.note}</p>
              <div className="meter clean">{meter(avgClean)} 청정 {avgClean}</div>
              {role === 'holder' && (
                <p style={{ fontSize: 13 }}>당신의 문제 원문은 공개되지 않았습니다. 말하고 싶으면 지금 팀에게 직접 말하세요.</p>
              )}
            </div>
          )}
        </>
      )}

      {state?.phase === 'end' && (
        <>
          <p className="eyebrow">정화 종료</p>
          <h1>{total}</h1>
          {(state.history || []).map((h) => (
            <div key={h.round} className="log"><span className="tag">C{h.round}</span>{h.pts} — {h.note}</div>
          ))}
          <div className="panel accent" style={{ marginTop: 16 }}>
            <p className="eyebrow">최종 보고</p>
            <p style={{ color: 'var(--fg)' }}>
              네 사람의 시그널이 한 번씩 복원됐습니다. 지금 팟에서 한 사람씩 답하세요 —
              <strong> 남이 복원해준 내 은유를 들었을 때 무엇이 올라왔습니까?</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
