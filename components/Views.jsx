'use client';
import { useState } from 'react';
import { TEMPLATES, fillTemplate, holderVocabulary, meter, BALANCE } from '../lib/game';
import { fogText } from '../lib/useRoom';

// ── SOURCE ── 자기 시그널 원문은 자기 기기에만 있습니다. 전송되지 않습니다.
export function HolderView({ st, send, smog, signal }) {
  const [text, setText] = useState('');
  const last = st.questions.filter((q) => !q.voided).slice(-1)[0];
  const answered = st.answers.length >= st.questions.filter((q) => !q.voided).length;

  return (
    <>
      <div className="panel accent">
        <p className="eyebrow">시그널 원문 · 당신 기기에만 존재</p>
        <h2>{signal.situation}</h2>
        <div className="log"><span className="tag">본체</span>{signal.body}</div>
        <div className="log"><span className="tag">공간</span>{signal.space}</div>
        <div className="log"><span className="tag">조건</span>{signal.condition}</div>
      </div>

      <div className="panel">
        <p className="eyebrow">수신된 질의</p>
        <h2>{last ? fogText(last.text, smog) : '대기 중'}</h2>
        <label htmlFor="ans">응답 · 2문장 이내</label>
        <textarea id="ans" rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="원문에 없는 말이 나와도 됩니다. 시그널은 말하면서 자랍니다." />
        <div style={{ height: 8 }} />
        <button disabled={!last || answered || !text.trim()}
          onClick={() => { send('action', { kind: 'answer', text: text.trim() }); setText(''); }}>
          응답 송신
        </button>
      </div>
    </>
  );
}

// ── PROBE ── 승인된 12패턴, 원본이 발신한 단어만.
export function ProberView({ st, send, smog }) {
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [busy, setBusy] = useState(false);
  const vocab = holderVocabulary(st.answers.map((a) => a.text));
  const scores = st.questions.filter((q) => !q.voided).map((q) => q.clean);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
  const last = st.questions.slice(-1)[0];
  const waiting = st.questions.filter((q) => !q.voided).length > st.answers.length;

  async function ask() {
    const text = fillTemplate(tpl, x, y);
    setBusy(true);
    let judged = { clean: 70, note: '' };
    try {
      const r = await fetch('/api/judge', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text, holderWords: vocab, answers: st.answers.map((a) => a.text) }),
      });
      judged = await r.json();
    } catch (e) { /* 심판이 죽어도 게임은 계속됩니다 */ }
    send('action', { kind: 'question', text, ...judged });
    setBusy(false); setX(''); setY('');
  }

  return (
    <>
      <div className="panel">
        <div className="between">
          <span className="eyebrow">누적 청정도</span>
          <span className="num" style={{ color: avg < 60 ? 'var(--taint)' : 'var(--clean)' }}>{avg}</span>
        </div>
        <div className={`meter ${avg < 60 ? 'taint' : 'clean'}`}>{meter(avg)}</div>
      </div>

      <div className="panel accent">
        <p className="eyebrow">승인 질의 패턴 12</p>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`tpl ${tpl.id === t.id ? 'on' : ''}`} onClick={() => setTpl(t)}>
              {t.text.replace('{X}', 'X').replace('{Y}', 'Y')}
            </button>
          ))}
        </div>

        <label>X — 원본이 발신한 단어만</label>
        <select value={x} onChange={(e) => setX(e.target.value)}>
          <option value="">{vocab.length ? '선택하세요' : '첫 질의는 자유 입력'}</option>
          {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        {!vocab.length && (
          <input style={{ marginTop: 6 }} value={x} onChange={(e) => setX(e.target.value)} placeholder="예: 그것" />
        )}
        {tpl.slots === 2 && (
          <>
            <label>Y</label>
            <select value={y} onChange={(e) => setY(e.target.value)}>
              <option value="">선택하세요</option>
              {vocab.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </>
        )}

        <div className="panel" style={{ margin: '12px 0 0', background: 'var(--bg)' }}>
          {fillTemplate(tpl, x, y)}
        </div>
        <div style={{ height: 8 }} />
        <button onClick={ask} disabled={busy || waiting || !x}>
          {busy ? '정화 판정 중…' : waiting ? '응답 수신 대기' : '질의 송신'}
        </button>
      </div>

      {last && (
        <div className={`panel ${last.clean < 60 ? 'warn' : ''}`}>
          <div className="between">
            <span className="eyebrow">직전 질의</span>
            <span className="num" style={{ color: last.clean < 60 ? 'var(--taint)' : 'var(--clean)' }}>{last.clean}</span>
          </div>
          <p style={{ color: 'var(--fg)' }}>{last.note}</p>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">응답 로그</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && <p>수신 없음.</p>}
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
          <span className="eyebrow">대기 오염도 · 10팟 공용</span>
          <span className="num" style={{ color: 'var(--taint)' }}>{Math.round(pollution)}%</span>
        </div>
        <div className="meter taint">{meter(pollution)}</div>
        <p style={{ fontSize: 13 }}>{BALANCE.smogThreshold}% 돌파 시 전 구역 스모그. 모든 팟의 수신이 손상됩니다.</p>
      </div>

      {crossWatch && (
        <div className="panel accent">
          <p className="eyebrow">사이클 3 — 교차 감시</p>
          <p style={{ color: 'var(--fg)' }}>인접 팟 감시로 전환됐습니다. 차단 성공 시 우리 팟 +20, 상대 팟 −10.</p>
        </div>
      )}

      <div className="panel">
        <div className="between">
          <span className="eyebrow">질의 로그</span>
          <span className="num">차단권 {'●'.repeat(st.challengesLeft)}{'○'.repeat(BALANCE.challengesPerRound - st.challengesLeft)}</span>
        </div>
        {[...st.questions].reverse().map((q) => (
          <div key={q.id} className={`log ${q.voided ? 'voided' : ''}`}>
            <span className="tag">청정 {q.clean}</span>{q.text}
            {!q.voided && st.challengesLeft > 0 && (
              <div style={{ marginTop: 6 }}>
                <button className="small danger" onClick={() => send('action', { kind: 'challenge', qid: q.id })}>
                  차단
                </button>
              </div>
            )}
          </div>
        ))}
        {!st.questions.length && <p>질의 없음.</p>}
      </div>
      <p style={{ fontSize: 13 }}>차단 성공 +15점, 대기 오염 −3%. 실패 시 탐침 시간 15초 손실.</p>
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
        <p className="eyebrow">응답만 수신됨 · 질의 채널 차단</p>
        {st.answers.map((a, i) => <div key={i} className="log"><span className="tag">A{i + 1}</span>{fogText(a.text, smog)}</div>)}
        {!st.answers.length && <p>수신 대기 중.</p>}
      </div>

      <div className="panel">
        <label>본체 — 무엇에 비유되었나</label>
        <input value={g.body} onChange={(e) => setG({ ...g, body: e.target.value })} disabled={sent} />
        <label>공간 — 어디에 있나</label>
        <input value={g.space} onChange={(e) => setG({ ...g, space: e.target.value })} disabled={sent} />
        <label>조건 — 무엇이 있어야 달라지나</label>
        <input value={g.condition} onChange={(e) => setG({ ...g, condition: e.target.value })} disabled={sent} />
        <div style={{ height: 12 }} />
        <button onClick={() => send('action', { kind: 'restoreGuess', guess: g })}
          disabled={sent || st.phase !== 'restore'}>
          {sent ? '전송 완료 · 대조 중' : st.phase === 'restore' ? '복원안 전송' : '복원 단계에서 열립니다'}
        </button>
      </div>
      <p style={{ fontSize: 13 }}>원본과의 대조는 원본 보유자 기기에서 이뤄집니다.</p>
    </>
  );
}
