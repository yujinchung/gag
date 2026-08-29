'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeRoomCode, INTENSITY } from '../lib/game';
import { isRealtimeConfigured } from '../lib/useRoom';
import deck from '../data/cards.json';

export default function Home() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [intensity, setIntensity] = useState('mid');
  const [sig, setSig] = useState({ situation: '', body: '', space: '', condition: '' });

  const router = useRouter();
  const ready = sig.situation.trim() && sig.body.trim() && sig.space.trim() && sig.condition.trim();

  const pullFromDeck = () => {
    const c = deck[Math.floor(Math.random() * deck.length)];
    setSig({ situation: c.situation, body: c.body, space: c.space, condition: c.condition });
  };

  const go = (c) => {
    if (!name.trim() || !ready) return;
    sessionStorage.setItem('cr-name', name.trim());
    sessionStorage.setItem('cr-signal', JSON.stringify({ ...sig, intensity }));
    router.push(`/room/${c.toUpperCase()}`);
  };

  return (
    <div className="wrap">
      <div className="bar">
        <span>C L E A N &nbsp; R O O M</span>
        <span className="spacer" />
        <span>2087 · 정화국</span>
      </div>

      {!isRealtimeConfigured() && (
        <div className="panel">
          <p className="eyebrow">로컬 모드</p>
          <p style={{ color: 'var(--fg)' }}>
            이 브라우저의 탭끼리만 연결됩니다. 1명이어도 바로 시작할 수 있습니다.
          </p>
        </div>
      )}

      {step === 0 && (
        <>
          <p className="eyebrow">Metaphor &amp; Clean Language</p>
          <h1>오염 탐지기</h1>
          <div className="panel accent">
            <p style={{ color: 'var(--fg)', lineHeight: 1.75 }}>
              한 사람의 시그널을, 당신의 언어를 한 글자도 섞지 않고 복원하라.
              상대가 쓴 단어만 쓴다. 할 일은 접속 후 화면에 나온다.
            </p>
          </div>
          <button onClick={() => setStep(1)}>시그널 등록</button>
        </>
      )}

      {step === 1 && (
        <>
          <p className="eyebrow">01 / 시그널 등록</p>
          <h1>당신의 시그널</h1>
          <p>지금 당신을 끄달리게 하는 문제 하나. 팀이 이걸 복원하게 됩니다.</p>

          <div className="panel">
            <label>공개 강도 — 당신이 정합니다</label>
            <div className="tpl-grid">
              {INTENSITY.map((t) => (
                <button key={t.id} className={`tpl ${intensity === t.id ? 'on' : ''}`} onClick={() => setIntensity(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13 }}>{INTENSITY.find((t) => t.id === intensity).desc}</p>
          </div>

          <div className="panel accent">
            <label>나의 힘든 현재 문제는</label>
            <input value={sig.situation} onChange={(e) => setSig({ ...sig, situation: e.target.value })}
              placeholder="예: 논문이 3개월째 제자리다" />

            <p className="eyebrow" style={{ marginTop: 18 }}>이제 그것을 은유로 바꿉니다</p>
            <label>본체 — 그건 무엇과 같습니까</label>
            <input value={sig.body} onChange={(e) => setSig({ ...sig, body: e.target.value })}
              placeholder="예: 젖은 성냥" />
            <label>공간 — 그건 어디에 있습니까</label>
            <input value={sig.space} onChange={(e) => setSig({ ...sig, space: e.target.value })}
              placeholder="예: 안개 낀 벌판 한가운데" />
            <label>조건 — 무엇이 있어야 달라집니까</label>
            <input value={sig.condition} onChange={(e) => setSig({ ...sig, condition: e.target.value })}
              placeholder="예: 바람이 잠깐 멎어야 한다" />
          </div>

          <button className="ghost small" onClick={pullFromDeck}>떠오르지 않으면 보관소에서 꺼내기</button>
          <p style={{ fontSize: 13 }}>
            보관소 시그널은 남의 것입니다. 게임은 똑같이 돌아가고, 아무도 그게 당신 것인지 묻지 않습니다.
          </p>
          <div style={{ height: 10 }} />
          <button onClick={() => setStep(2)} disabled={!ready}>등록 완료</button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">02 / 팟 접속</p>
          <h1>정화팀 배정</h1>
          <div className="panel accent">
            <label htmlFor="nm">호출명</label>
            <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="화면에 표시될 이름" />
            <label htmlFor="cd">팟 코드</label>
            <div className="row">
              <input id="cd" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} />
              <button className="small" onClick={() => go(code)} disabled={!name.trim() || code.length < 4}>
                접속
              </button>
            </div>
          </div>
          <button className="ghost" onClick={() => go(makeRoomCode())} disabled={!name.trim()}>
            새 팟 개설
          </button>
          <p style={{ fontSize: 13 }}>
            시그널 원문은 당신 기기에만 있습니다. 1명이어도 바로 플레이할 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}
