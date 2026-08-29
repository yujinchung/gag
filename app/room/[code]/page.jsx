'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRoom, useGlobalPollution } from '../../../lib/useRoom';
import {
  BALANCE, POD_SIZE, ROLE_LABEL, ROLE_KO, ROLE_BRIEF,
  rolesForSeat, visibleRoles, holderSeat, cycleCount, settleCause,
  roundScore, newRoundState, meter,
} from '../../../lib/game';
import { HolderView, ProberView, WatcherView, RestorerView } from '../../../components/Views';

const NEXT = { deal: 'probe', probe: 'restore', restore: 'settle' };
const FALLBACK_SIGNAL = { situation: '(시그널 미등록)', body: '', space: '', condition: '' };

function DebriefBlock({ round, pts, cause, questions, guess, reveal, scores, holderNote }) {
  return (
    <div className="panel accent">
      <p className="eyebrow">대조 결과 · 사이클 {round}</p>
      <h2>{pts ?? 0}</h2>
      {cause && <p style={{ color: 'var(--fg)' }}>{cause}</p>}
      <div className="log"><span className="tag">본체 원본</span>{reveal?.body || '대조 중'}</div>
      <div className="log"><span className="tag">본체 복원</span>{guess?.body || '미전송'}</div>
      <div className="log"><span className="tag">공간 원본</span>{reveal?.space || '—'}</div>
      <div className="log"><span className="tag">공간 복원</span>{guess?.space || '미전송'}</div>
      <div className="log"><span className="tag">조건 원본</span>{reveal?.condition || '—'}</div>
      <div className="log"><span className="tag">조건 복원</span>{guess?.condition || '미전송'}</div>
      {scores?.note && <p style={{ color: 'var(--fg)' }}>{scores.note}</p>}
      {(questions || []).map((q) => (
        <div key={q.id} className={`log ${q.voided ? 'voided' : ''}`}>
          <span className="tag">청정 {q.clean}{q.voided ? ' · 차단' : ''}</span>{q.text}
        </div>
      ))}
      {holderNote && (
        <p style={{ fontSize: 13 }}>당신의 문제 원문은 공개되지 않았습니다. 말하고 싶으면 지금 팀에게 직접 말하세요.</p>
      )}
    </div>
  );
}

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

  const { pod, me, state, setState, isEngine, send, conn, overflow } = useRoom({
    code, name, onAction: (a) => engineRef.current && applyAction(a),
  });
  engineRef.current = isEngine;
  stateRef.current = state;
  signalRef.current = signal;

  const { pollution, smog, pollute } = useGlobalPollution({ podCode: code, score: total, clean: avgClean });

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

  const roster = state?.seats?.length ? state.seats : pod;
  const seatIndex = me ? roster.findIndex((m) => m.id === me.id) : -1;
  const nSeats = Math.max(1, roster.length);
  const myRoles = state?.started && seatIndex >= 0
    ? rolesForSeat(seatIndex, state.round, nSeats)
    : [];
  const shown = visibleRoles(myRoles, state?.phase);
  const cycles = state?.cycles || cycleCount(nSeats);
  const playSignal = signal || FALLBACK_SIGNAL;

  useEffect(() => {
    if (!myRoles.includes('holder') || !state?.restore?.guess || state.restore.scores || scoringRef.current) return;
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
        reveal: { body: sg.body, space: sg.space, condition: sg.condition },
      });
      scoringRef.current = false;
    })();
  }, [state, myRoles, send]);

  useEffect(() => {
    if (!isEngine) return;
    const t = setInterval(() => {
      const st = stateRef.current;
      if (!st || !st.started || st.phase === 'end') return;
      if (Date.now() < st.phaseEndsAt) return;

      const totalRounds = st.cycles || BALANCE.rounds;
      if (st.phase === 'settle') {
        if (st.round >= totalRounds) { push({ ...st, phase: 'end' }); return; }
        push({
          ...st,
          ...newRoundState(st.round + 1),
          started: true,
          history: st.history,
          seats: st.seats,
          cycles: st.cycles,
        });
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
          totalRounds,
        });
        history = [...history, {
          round: st.round,
          pts,
          note: s.note || '',
          cause: settleCause(st),
          questions: st.questions,
          guess: st.restore?.guess,
          reveal: st.restore?.reveal,
          scores: s,
        }];
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

  const start = () => {
    const seats = pod.slice(0, POD_SIZE);
    if (!seats.length) return;
    push({
      started: true,
      history: [],
      seats: seats.map(({ id, name: nm }) => ({ id, name: nm })),
      cycles: cycleCount(seats.length),
      ...newRoundState(1),
    });
  };

  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const seated = seatIndex >= 0;
  const sourceName = state?.started
    ? roster[holderSeat(state.round, nSeats)]?.name
    : null;
  const connLabel = conn.status === 'error'
    ? '연결 실패 · 이 기기에서 진행'
    : conn.status === 'connecting' || conn.status === 'idle'
      ? '연결 중'
      : conn.mode === 'local' ? '로컬 탭 연결' : '실시간 연결';
  const lastSettle = (state?.history || []).slice(-1)[0];
  const roleTag = myRoles.map((r) => `${ROLE_LABEL[r]} · ${ROLE_KO[r]}`).join('  +  ');

  return (
    <div className="wrap">
      {smog && <div className="smog-label">S M O G &nbsp; 대기 오염 임계 초과</div>}

      <div className="bar">
        <span>POD {code}</span>
        {state?.started && <span>CYCLE {state.round}/{cycles}</span>}
        <span className="spacer" />
        <span>{connLabel}</span>
        {state?.started && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{mmss}</span>}
      </div>

      {!state?.started && (
        <>
          <p className="eyebrow">대기실 · 정화팀 편성</p>
          <h1>POD {code}</h1>
          <p>1명이어도 개시할 수 있습니다. 빈 역할은 탐문/복원 단계로 나눕니다. 진행 기기를 새로고침하면 이 팟은 리셋됩니다.</p>
          <div className="panel">
            {Array.from({ length: POD_SIZE }, (_, i) => {
              const m = pod[i];
              return (
                <div key={m?.id || `seat-${i}`} className={`log ${m ? '' : 'waiting'}`}>
                  <span className="tag">{String(i + 1).padStart(2, '0')}</span>
                  {m ? m.name : '비움'}
                  {i === 0 && m && <span className="tag" style={{ marginLeft: 8 }}>진행 기기</span>}
                </div>
              );
            })}
          </div>
          {overflow && (
            <p>앞 {POD_SIZE}명이 플레이하고, 나머지는 정산 기록을 봅니다.</p>
          )}
          {conn.status === 'error' && (
            <div className="panel warn">
              <p className="eyebrow">실시간 실패</p>
              <p style={{ color: 'var(--fg)' }}>이 기기에서 로컬로 진행합니다. 같은 브라우저 탭끼리는 로컬 모드로 붙습니다.</p>
            </div>
          )}
          {conn.mode === 'local' && conn.status === 'subscribed' && (
            <div className="panel">
              <p className="eyebrow">로컬 모드</p>
              <p style={{ color: 'var(--fg)' }}>
                이 브라우저의 탭끼리만 연결됩니다. 탭을 더 열면 역할을 나눕니다.
              </p>
            </div>
          )}
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="ghost small" type="button" onClick={() => navigator.clipboard?.writeText(String(code).toUpperCase())}>
              코드 복사
            </button>
          </div>
          {isEngine
            ? <button onClick={start} disabled={pod.length < 1}>정화 개시 ({pod.length}/{POD_SIZE})</button>
            : <p>진행 기기의 개시 신호를 기다리는 중. 1명이어도 시작할 수 있습니다.</p>}
          {!signal && <p style={{ color: 'var(--taint)' }}>시그널이 없으면 빈 원본으로 연습합니다. 가능하면 첫 화면에서 등록하세요.</p>}
        </>
      )}

      {state?.started && state.phase !== 'end' && seated && (
        <>
          <div className="between">
            <span className="role-tag">{roleTag}</span>
            <span className="num">{total}</span>
          </div>
          {nSeats === 1 && (
            <p style={{ fontSize: 13 }}>1인 연습 — 원본을 아는 채로 복원합니다. 복원 단계에서는 질의가 가려집니다.</p>
          )}

          {state.phase === 'deal' && (
            <div className="panel accent">
              <p className="eyebrow">사이클 {state.round} 개시</p>
              <h2>이번 사이클의 원본: {sourceName || '배정 중'}</h2>
              {myRoles.map((r) => (
                <p key={r} style={{ color: 'var(--fg)' }}>{ROLE_BRIEF[r]}</p>
              ))}
            </div>
          )}

          {(state.phase === 'probe' || state.phase === 'restore') && (
            <>
              {shown.includes('holder') && <HolderView st={state} send={send} smog={smog} signal={playSignal} />}
              {shown.includes('prober') && <ProberView st={state} send={send} smog={smog} starter={state.round === 1} />}
              {shown.includes('watcher') && (
                <WatcherView st={state} send={send} pollution={pollution} />
              )}
              {shown.includes('restorer') && <RestorerView st={state} send={send} smog={smog} />}
              {state.phase === 'restore' && !shown.length && (
                <p>복원 단계입니다. 질의는 가려져 있습니다.</p>
              )}
            </>
          )}

          {state.phase === 'settle' && (
            <DebriefBlock
              round={state.round}
              pts={lastSettle?.pts ?? 0}
              cause={lastSettle?.cause}
              questions={lastSettle?.questions || state.questions}
              guess={lastSettle?.guess || state.restore?.guess}
              reveal={lastSettle?.reveal || state.restore?.reveal}
              scores={lastSettle?.scores || state.restore?.scores}
              holderNote={myRoles.includes('holder')}
            />
          )}
          {state.phase === 'settle' && (
            <div className="meter clean">{meter(avgClean)} 청정 {avgClean}</div>
          )}
        </>
      )}

      {state?.started && !seated && (
        <div className="panel">
          <p className="eyebrow">기록</p>
          <p style={{ color: 'var(--fg)' }}>플레이 자리는 앞 {POD_SIZE}명입니다. 정산에서 질의와 복원을 함께 돌아보세요.</p>
          {(state.questions || []).map((q) => (
            <div key={q.id} className={`log ${q.voided ? 'voided' : ''}`}>
              <span className="tag">청정 {q.clean}</span>{q.text}
            </div>
          ))}
          {state.phase === 'settle' && lastSettle && (
            <DebriefBlock
              round={state.round}
              pts={lastSettle.pts}
              cause={lastSettle.cause}
              questions={lastSettle.questions}
              guess={lastSettle.guess}
              reveal={lastSettle.reveal}
              scores={lastSettle.scores}
            />
          )}
        </div>
      )}

      {state?.phase === 'end' && (
        <>
          <p className="eyebrow">정화 종료</p>
          <h1>{total}</h1>
          {(state.history || []).map((h) => (
            <DebriefBlock
              key={h.round}
              round={h.round}
              pts={h.pts}
              cause={h.cause || h.note}
              questions={h.questions}
              guess={h.guess}
              reveal={h.reveal}
              scores={h.scores}
            />
          ))}
          <div className="panel accent" style={{ marginTop: 16 }}>
            <p className="eyebrow">최종 보고</p>
            <p style={{ color: 'var(--fg)' }}>
              지금 팟에서 한 사람씩 답하세요 —
              <strong> 남이 복원해준 내 은유를 들었을 때 무엇이 올라왔습니까?</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
