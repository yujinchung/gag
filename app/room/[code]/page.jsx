'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRoom, useGlobalPollution } from '../../../lib/useRoom';
import {
  BALANCE, POD_SIZE, ROLE_KO, ROLE_BRIEF, PHASE_TIP,
  rolesForSeat, visibleRoles, holderSeat, cycleCount, settleCause,
  roundScore, newRoundState, meter, makeSting, worstQuestion, matchHit, scoreRestore,
} from '../../../lib/game';
import { HolderView, ProberView, WatcherView, RestorerView, Tip } from '../../../components/Views';

const NEXT = { deal: 'probe', probe: 'restore', restore: 'settle' };
const FALLBACK_SIGNAL = { situation: '(이야기 없음)', body: '', space: '', condition: '' };

function DebriefBlock({ round, pts, cause, questions, guess, reveal, scores, holderNote }) {
  const culprit = worstQuestion(questions);
  const rows = [
    { key: 'body', label: '무엇', truth: reveal?.body, guess: guess?.body, score: scores?.body },
    { key: 'space', label: '어디', truth: reveal?.space, guess: guess?.space, score: scores?.space },
    { key: 'condition', label: '달라지는 조건', truth: reveal?.condition, guess: guess?.condition, score: scores?.condition },
  ];
  return (
    <div className="panel accent">
      <p className="eyebrow">맞춰 보기 공개 · 라운드 {round}</p>
      <h2>{pts ?? 0}점</h2>
      {cause && <p style={{ color: 'var(--fg)' }}>{cause}</p>}
      {rows.map((r) => {
        const hit = matchHit(r.score);
        return (
          <div key={r.key} className={`log ${hit ? 'hit' : 'miss'}`}>
            <span className="tag">{hit ? '비슷해요' : '다른 그림'}</span>
            <strong>{r.label}</strong>
            {' · '}원래 {r.truth || '—'} / 맞힌 것 {r.guess || '아직 없음'}
            {typeof r.score === 'number' && ` (${r.score})`}
          </div>
        );
      })}
      {culprit && culprit.clean < 60 && (
        <div className="panel warn" style={{ marginTop: 12 }}>
          <p className="eyebrow">범인 질문</p>
          <h2 style={{ color: 'var(--taint)' }}>{culprit.text}</h2>
          <p style={{ color: 'var(--fg)' }}>깨끗한 점수 {culprit.clean}. {culprit.note || '이 질문에 추측이 들어갔어요.'}</p>
        </div>
      )}
      {scores?.note && <p style={{ color: 'var(--fg)' }}>{scores.note}</p>}
      {(questions || []).map((q) => (
        <div key={q.id} className={`log ${q.voided ? 'voided' : ''} ${culprit && q.id === culprit.id ? 'hot' : ''}`}>
          <span className="tag">깨끗 {q.clean}{q.voided ? ' · 막힘' : ''}</span>{q.text}
        </div>
      ))}
      {holderNote && (
        <p style={{ fontSize: 13 }}>네 고민 문장은 공개되지 않았어요. 말하고 싶으면 지금 친구에게 직접 말해도 돼요.</p>
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
      const sting = a.clean < 50
        ? makeSting('dirty', '추측이 들어갔어요!', a.note || '친구가 안 쓴 말이 섞였어요.')
        : a.clean >= 90
          ? makeSting('clean', '깨끗한 질문!', '상대의 말만 썼어요.')
          : st.sting;
      push({ ...st, questions: [...st.questions, q], sting });
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
        sting: win
          ? makeSting('block', '막아냈어요!', '그 추측이 대답에 안 섞여요.')
          : makeSting('miss', '앗, 그건 깨끗한 질문!', '질문 시간이 15초 줄었어요.'),
      });
    }
    if (a.kind === 'restoreGuess') {
      push({
        ...st,
        restore: { guess: a.guess },
        sting: makeSting('guess', '맞춰 보기 제출!', '이야기 주인이 맞는지 보고 있어요.'),
      });
    }
    if (a.kind === 'restoreScore') {
      push({ ...st, restore: { ...(st.restore || {}), scores: a.scores, reveal: a.reveal } });
    }
    if (a.kind === 'skipDeal' && st.phase === 'deal') {
      push({
        ...st,
        phase: 'probe',
        phaseEndsAt: Date.now() + BALANCE.phase.probe * 1000,
        sting: makeSting('go', '질문 시작!', '친구가 말한 단어만 써 보세요.'),
      });
    }
    if (a.kind === 'skipSettle' && st.phase === 'settle') {
      const totalRounds = st.cycles || BALANCE.rounds;
      if (st.round >= totalRounds) {
        push({ ...st, phase: 'end', sting: makeSting('go', '한 바퀴 끝!', '친구가 되살려 준 그림을 같이 말해 봐요.') });
        return;
      }
      push({
        ...st,
        ...newRoundState(st.round + 1),
        started: true,
        history: st.history,
        seats: st.seats,
        cycles: st.cycles,
        sting: makeSting('go', `라운드 ${st.round + 1}!`, '다음 이야기 주인을 봐요.'),
      });
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
      let scores = scoreRestore(signalRef.current || {}, state.restore.guess);
      try {
        const r = await fetch('/api/restore', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ truth: signalRef.current, guess: state.restore.guess }),
        });
        const remote = await r.json();
        if (typeof remote.body === 'number') scores = remote;
      } catch (e) { /* 로컬 채점으로 계속 */ }
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
        if (st.round >= totalRounds) {
          push({ ...st, phase: 'end', sting: makeSting('go', '한 바퀴 끝!', '친구가 되살려 준 그림을 같이 말해 봐요.') });
          return;
        }
        push({
          ...st,
          ...newRoundState(st.round + 1),
          started: true,
          history: st.history,
          seats: st.seats,
          cycles: st.cycles,
          sting: makeSting('go', `라운드 ${st.round + 1}!`, '다음 이야기 주인을 봐요.'),
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
      const sting = phase === 'probe'
        ? makeSting('go', '질문 시작!', '친구가 말한 단어만 써 보세요.')
        : phase === 'restore'
          ? makeSting('go', '질문은 숨겼어요!', '대답만으로 그림을 맞춰 보세요.')
          : phase === 'settle'
            ? makeSting('guess', '공개!', '어느 질문이 그림을 바꿨을까요?')
            : st.sting;
      push({ ...st, phase, history, phaseEndsAt: Date.now() + BALANCE.phase[phase] * 1000, sting });
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
    ? '연결 안 됨 · 이 화면에서 해요'
    : conn.status === 'connecting' || conn.status === 'idle'
      ? '연결 중'
      : conn.mode === 'local' ? '이 컴퓨터 탭끼리' : '여러 기기 연결됨';
  const lastSettle = (state?.history || []).slice(-1)[0];
  const roleTag = myRoles.map((r) => ROLE_KO[r]).join('  +  ');
  const stingOn = state?.sting && Date.now() - state.sting.at < 4200;

  return (
    <div className="wrap">
      {smog && <div className="smog-label">안개가 끼었어요 · 대답 일부가 가려져요</div>}

      <div className="bar">
        <Link href="/" className="brand">C L E A N &nbsp; R O O M</Link>
        <span>방 {code}</span>
        {state?.started && <span>라운드 {state.round}/{cycles}</span>}
        <span className="spacer" />
        <span>{connLabel}</span>
        {state?.started && <span className={`timer ${left <= 10 ? 'low' : ''}`}>{mmss}</span>}
      </div>

      {!state?.started && (
        <>
          <p className="eyebrow">대기실</p>
          <h1>방 {code}</h1>
          <p>혼자여도 시작할 수 있어요. 사람이 적으면 질문 시간과 맞혀 보는 시간을 나눠서 해요. 이 화면을 새로고침하면 방이 처음부터예요.</p>
          <div className="panel">
            {Array.from({ length: POD_SIZE }, (_, i) => {
              const m = pod[i];
              return (
                <div key={m?.id || `seat-${i}`} className={`log ${m ? '' : 'waiting'}`}>
                  <span className="tag">{String(i + 1).padStart(2, '0')}</span>
                  {m ? m.name : '빈자리'}
                  {i === 0 && m && <span className="tag" style={{ marginLeft: 8 }}>진행 화면</span>}
                </div>
              );
            })}
          </div>
          {overflow && (
            <p>앞 {POD_SIZE}명이 하고, 나머지는 같이 돌아보기만 해요.</p>
          )}
          {conn.status === 'error' && (
            <div className="panel warn">
              <p className="eyebrow">연결이 안 돼요</p>
              <p style={{ color: 'var(--fg)' }}>이 화면에서 바로 할 수 있어요. 같은 브라우저 탭이면 서로 붙어요.</p>
            </div>
          )}
          {conn.mode === 'local' && conn.status === 'subscribed' && (
            <div className="panel">
              <p className="eyebrow">이 컴퓨터에서만</p>
              <p style={{ color: 'var(--fg)' }}>
                탭을 더 열면 역할을 나눌 수 있어요.
              </p>
            </div>
          )}
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="ghost small" type="button" onClick={() => navigator.clipboard?.writeText(String(code).toUpperCase())}>
              코드 복사
            </button>
          </div>
          {isEngine
            ? <button onClick={start} disabled={pod.length < 1}>시작하기 ({pod.length}/{POD_SIZE})</button>
            : <p>진행 화면에서 시작하기를 눌러 주세요. 혼자여도 돼요.</p>}
          {!signal && <p style={{ color: 'var(--taint)' }}>이야기가 없으면 빈칸으로 연습해요. 가능하면 첫 화면에서 적어 주세요.</p>}
        </>
      )}

      {state?.started && stingOn && (
        <div className={`sting ${state.sting.kind}`}>
          <p className="eyebrow">{state.sting.title}</p>
          <p>{state.sting.body}</p>
        </div>
      )}

      {state?.started && state.phase !== 'end' && seated && (
        <>
          <div className="between">
            <span className="role-tag">{roleTag}</span>
            <span className="num">{total}</span>
          </div>
          {nSeats === 1 && (
            <p style={{ fontSize: 13 }}>혼자 연습 중이에요. 네 그림을 이미 아니까 맞춰 보기가 쉬울 수 있어요. 맞혀 보는 시간에는 질문이 숨겨져요.</p>
          )}

          {state.phase === 'deal' && (
            <div className="panel accent">
              <p className="eyebrow">라운드 {state.round} · 누구의 소리를 들을까</p>
              <h2>이번 이야기 주인: {sourceName || '정하는 중'}</h2>
              {myRoles.map((r) => (
                <p key={r} style={{ color: 'var(--fg)' }}>{ROLE_BRIEF[r]}</p>
              ))}
              <div style={{ height: 10 }} />
              <button type="button" onClick={() => send('action', { kind: 'skipDeal' })}>
                바로 질문 시작!
              </button>
            </div>
          )}
          {state.phase === 'deal' && <Tip>{PHASE_TIP.deal}</Tip>}

          {(state.phase === 'probe' || state.phase === 'restore') && (
            <>
              {shown.includes('holder') && <HolderView st={state} send={send} smog={smog} signal={playSignal} />}
              {shown.includes('prober') && <ProberView st={state} send={send} smog={smog} starter={state.round === 1} />}
              {shown.includes('watcher') && (
                <WatcherView st={state} send={send} pollution={pollution} />
              )}
              {shown.includes('restorer') && <RestorerView st={state} send={send} smog={smog} />}
              {state.phase === 'restore' && !shown.length && (
                <p>지금은 맞춰 보는 시간이에요. 질문은 일부러 숨겼어요.</p>
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
          {state.phase === 'settle' && <Tip>{PHASE_TIP.settle}</Tip>}
          {state.phase === 'settle' && (
            <div className="meter clean">{meter(avgClean)} 깨끗한 점수 {avgClean}</div>
          )}
          {state.phase === 'settle' && (
            <div style={{ height: 10 }} />
          )}
          {state.phase === 'settle' && (
            <button type="button" onClick={() => send('action', { kind: 'skipSettle' })}>
              {state.round >= cycles ? '한 바퀴 끝내기' : '다음 라운드!'}
            </button>
          )}
        </>
      )}

      {state?.started && !seated && (
        <div className="panel">
          <p className="eyebrow">같이 보기</p>
          <p style={{ color: 'var(--fg)' }}>하는 자리는 앞 {POD_SIZE}명이에요. 질문이 깨끗한지, 그림이 어떻게 맞았는지 같이 봐요.</p>
          {(state.questions || []).map((q) => (
            <div key={q.id} className={`log ${q.voided ? 'voided' : ''}`}>
              <span className="tag">깨끗 {q.clean}</span>{q.text}
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
          <p className="eyebrow">끝</p>
          <h1>{total}점</h1>
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
            <p className="eyebrow">한 바퀴</p>
            <p style={{ color: 'var(--fg)' }}>
              한 사람씩 말해 봐요 —
              <strong> 친구가 되살려 준 내 그림을 들었을 때, 무엇이 올라왔나요?</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
