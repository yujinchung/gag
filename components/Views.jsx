'use client';
import { useState } from 'react';
import { TEMPLATES, fillTemplate, holderVocabulary, meter, BALANCE, cleanStreak, ROLE_TIP, scoreSlots } from '../lib/game';
import { fogText } from '../lib/useRoom';

export function Tip({ children }) {
  return (
    <div className="panel tip">
      <p className="eyebrow">팁</p>
      <p style={{ color: 'var(--fg)' }}>{children}</p>
    </div>
  );
}

// ── 이야기 주인 ── 자기 이야기 원문은 자기 기기에만 있습니다.
export function HolderView({ st, send, smog, signal }) {
  const [text, setText] = useState('');
  const last = st.questions.filter((q) => !q.voided).slice(-1)[0];
  const answered = st.answers.length >= st.questions.filter((q) => !q.voided).length;

  return (
    <>
      <div className="panel accent">
        <p className="eyebrow">네 이야기 · 이 화면에만 보여요</p>
        <h2>{signal.situation}</h2>
        <div className="log"><span className="tag">무엇</span>{signal.body}</div>
        <div className="log"><span className="tag">어디</span>{signal.space}</div>
        <div className="log"><span className="tag">어떻게 달라지나</span>{signal.condition}</div>
      </div>

      <Tip>{ROLE_TIP.holder}</Tip>

      {last && last.clean < 50 && (
        <div className="panel warn">
          <p className="eyebrow">추측이 들어왔어요 · 따라가지 마</p>
          <p style={{ color: 'var(--fg)' }}>{last.note || '이 질문에 친구가 안 쓴 말이 있어요. 그 단어를 대답에 넣지 마.'}</p>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">지금 온 질문</p>
        <h2>{last ? fogText(last.text, smog) : '아직 질문이 없어요'}</h2>
        <label htmlFor="ans">대답 · 두 문장 안에</label>
        <textarea id="ans" rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="이야기에 없는 말을 꺼내도 돼요. 그림은 말하면서 자라요." />
        <div style={{ height: 8 }} />
        <button disabled={!last || answered || !text.trim()}
          onClick={() => { send('action', { kind: 'answer', text: text.trim() }); setText(''); }}>
          대답 보내기
        </button>
      </div>
    </>
  );
}

// ── PROBE ── 승인된 12패턴, 원본이 발신한 단어만.
export function ProberView({ st, send, smog, starter }) {
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [busy, setBusy] = useState(false);
  const vocab = holderVocabulary(st.answers.map((a) => a.text));
  const scores = st.questions.filter((q) => !q.voided).map((q) => q.clean);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
  const last = st.questions.slice(-1)[0];
  const waiting = st.questions.filter((q) => !q.voided).length > st.answers.length;
  const streak = cleanStreak(st.questions);

  async function ask() {
    const text = fillTemplate(tpl, x, y);
    setBusy(true);
    const slots = [x, y];
    let judged = scoreSlots(slots, vocab);
    try {
      const r = await fetch('/api/judge', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: text, holderWords: vocab, answers: st.answers.map((a) => a.text), slots,
        }),
      });
      const remote = await r.json();
      if (typeof remote.clean === 'number' && remote.note) judged = remote;
    } catch (e) { /* 로컬 채점으로 계속 */ }
    send('action', { kind: 'question', text, ...judged });
    setBusy(false); setX(''); setY('');
  }

  return (
    <>
      <div className="panel">
        <div className="between">
          <span className="eyebrow">깨끗한 점수</span>
          <span className="num" style={{ color: avg < 60 ? 'var(--taint)' : 'var(--clean)' }}>{avg}</span>
        </div>
        <div className={`meter ${avg < 60 ? 'taint' : 'clean'}`}>{meter(avg)}</div>
        {streak >= 2 && <p style={{ fontSize: 13, color: 'var(--clean)' }}>깨끗한 질문 {streak}번 연속!</p>}
      </div>

      <div className="panel">
        <p className="eyebrow">친구가 말한 단어 {vocab.length}</p>
        {vocab.length
          ? <div className="log">{vocab.map((w) => <span key={w} className="tag">{w}</span>)}</div>
          : <p>첫 질문은 네가 단어를 넣어도 돼요. 대답이 오면 그 단어만 써요.</p>}
      </div>

      <Tip>
        {starter
          ? '첫 질문은 아래 맨 앞 문장으로 시작해 봐. 친구가 말한 말만 넣는 게 Clean Language야.'
          : ROLE_TIP.prober}
      </Tip>

      <div className="panel accent">
        {starter && <p className="eyebrow">이 문장으로 시작해도 좋아요</p>}
        <p className="eyebrow">질문 문장 12개</p>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`tpl ${tpl.id === t.id ? 'on' : ''}`} onClick={() => setTpl(t)}>
              {t.text.replaceAll('{X}', 'X').replaceAll('{Y}', 'Y')}
            </button>
          ))}
        </div>

        <label>X — 친구가 말한 단어</label>
        <select value={x} onChange={(e) => setX(e.target.value)}>
          <option value="">{vocab.length ? '단어를 고르세요' : '첫 질문은 직접 넣어도 돼요'}</option>
          {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        {!vocab.length && (
          <input style={{ marginTop: 6 }} value={x} onChange={(e) => setX(e.target.value)} placeholder="예: 그것" />
        )}
        {tpl.slots === 2 && (
          <>
            <label>Y</label>
            <select value={y} onChange={(e) => setY(e.target.value)}>
              <option value="">단어를 고르세요</option>
              {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </>
        )}

        <div className="panel" style={{ margin: '12px 0 0', background: 'var(--bg)' }}>
          {fillTemplate(tpl, x, y)}
        </div>
        <div style={{ height: 8 }} />
        <button onClick={ask} disabled={busy || waiting || !x}>
          {busy ? '깨끗한지 보는 중…' : waiting ? '대답을 기다리는 중' : '질문 보내기'}
        </button>
      </div>

      {last && (
        <div className={`panel ${last.clean < 60 ? 'warn' : ''}`}>
          <div className="between">
            <span className="eyebrow">{last.clean < 50 ? '앗, 추측이 섞였어요' : '방금 질문'}</span>
            <span className="num" style={{ color: last.clean < 60 ? 'var(--taint)' : 'var(--clean)' }}>{last.clean}</span>
          </div>
          <p style={{ color: 'var(--fg)' }}>{last.note}</p>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">친구가 한 대답</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && <p>아직 대답이 없어요.</p>}
      </div>
    </>
  );
}

// ── SENTINEL ── 오염 질의 차단. 사이클 3에는 인접 팟을 감시합니다.
export function WatcherView({ st, send, pollution, crossWatch }) {
  return (
    <>
      <div className="panel warn">
        <div className="between">
          <span className="eyebrow">공기가 탁한 정도 · 모든 방이 같이 숨 쉬어요</span>
          <span className="num" style={{ color: 'var(--taint)' }}>{Math.round(pollution)}%</span>
        </div>
        <div className="meter taint">{meter(pollution)}</div>
        <p style={{ fontSize: 13 }}>{BALANCE.smogThreshold}%가 되면 안개가 끼고, 대답 일부가 가려져요.</p>
      </div>

      <Tip>{ROLE_TIP.watcher}</Tip>

      {crossWatch && (
        <div className="panel accent">
          <p className="eyebrow">옆 방 보기</p>
          <p style={{ color: 'var(--fg)' }}>지금은 옆 방 질문을 봐요. 막으면 우리 팀 +20, 옆 팀 −10.</p>
        </div>
      )}

      <div className="panel">
        <div className="between">
          <span className="eyebrow">질문 목록</span>
          <span className="num" style={{ fontSize: 22, letterSpacing: '.12em' }}>
            {'●'.repeat(st.challengesLeft)}{'○'.repeat(BALANCE.challengesPerRound - st.challengesLeft)}
          </span>
        </div>
        <p style={{ fontSize: 13 }}>방금 온 질문을 빨리 막으면 그림이 안 바뀌어요. 실패하면 질문 시간이 15초 줄어요.</p>
        {[...st.questions].reverse().map((q, i) => (
          <div key={q.id} className={`log ${q.voided ? 'voided' : ''} ${i === 0 && !q.voided ? 'hot' : ''}`}>
            <span className="tag">{i === 0 && !q.voided ? '방금' : `깨끗 ${q.clean}`}</span>
            {i === 0 && !q.voided && <span className="tag">깨끗 {q.clean}</span>}
            {q.text}
            {!q.voided && st.challengesLeft > 0 && (
              <div style={{ marginTop: 6 }}>
                <button className={i === 0 ? 'danger' : 'small danger'} onClick={() => send('action', { kind: 'challenge', qid: q.id })}>
                  이 질문은 추측이야
                </button>
              </div>
            )}
          </div>
        ))}
        {!st.questions.length && <p>아직 질문이 없어요. 추측이 들어오면 여기서 막아요.</p>}
      </div>
    </>
  );
}

// ── RECON ── 응답만 수신. 질의는 차단되어 보이지 않습니다.
export function RestorerView({ st, send, smog }) {
  const [g, setG] = useState({ body: '', space: '', condition: '' });
  const sent = !!st.restore?.guess;

  return (
    <>
      <div className="panel accent">
        <p className="eyebrow">{st.phase === 'probe' ? '듣는 중 · 질문은 비밀' : '대답만 보여요 · 질문은 숨겼어요'}</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && (
          <p>{st.phase === 'probe' ? '대답이 오면 마음속에 그림을 그려 보세요. 질문은 보면 안 돼요.' : '아직 대답이 없어요.'}</p>
        )}
      </div>

      <Tip>{st.phase === 'probe' ? '지금은 듣기만. 질문이 새어 들어오면 그림이 바뀌어요. 대답에만 나온 말을 기억해.' : ROLE_TIP.restorer}</Tip>

      <div className="panel">
        <label>그것은 무엇과 같았나요</label>
        <input value={g.body} onChange={(e) => setG({ ...g, body: e.target.value })} disabled={sent} />
        <label>그것은 어디에 있었나요</label>
        <input value={g.space} onChange={(e) => setG({ ...g, space: e.target.value })} disabled={sent} />
        <label>무엇이 있어야 달라지나요</label>
        <input value={g.condition} onChange={(e) => setG({ ...g, condition: e.target.value })} disabled={sent} />
        <div style={{ height: 12 }} />
        <button onClick={() => send('action', { kind: 'restoreGuess', guess: g })}
          disabled={sent || st.phase !== 'restore'}>
          {sent ? '보냈어요 · 맞는지 보는 중' : st.phase === 'restore' ? '이게 그 그림이야!' : '맞혀 보는 시간에 열려요'}
        </button>
      </div>
      <p style={{ fontSize: 13 }}>맞았는지는 이야기 주인 화면에서 확인해요.</p>
    </>
  );
}
