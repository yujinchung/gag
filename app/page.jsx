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
        <span>마음속 그림 맞히기</span>
      </div>

      {!isRealtimeConfigured() && (
        <div className="panel">
          <p className="eyebrow">이 컴퓨터에서만</p>
          <p style={{ color: 'var(--fg)' }}>
            같은 브라우저 탭끼리만 붙어요. 혼자여도 바로 시작할 수 있어요.
          </p>
        </div>
      )}

      {step === 0 && (
        <>
          <p className="eyebrow">Clean Language</p>
          <h1>오염 탐지기</h1>
          <div className="panel accent">
            <p style={{ color: 'var(--fg)', lineHeight: 1.75 }}>
              이 게임은 Clean Language를 배우는 게임이에요.
              상대가 말한 단어만 쓰고, “내 생각엔 이런 거지?”는 넣지 않는 연습입니다.
            </p>
          </div>
          <div className="panel tip">
            <p className="eyebrow">어떻게 해요?</p>
            <p style={{ color: 'var(--fg)' }}>
              한 친구의 마음속 그림을, 그 친구가 쓴 말로만 되살려 보세요.
              들어갈 방에선 네 할 일이 화면에 나와요.
            </p>
          </div>
          <button onClick={() => setStep(1)}>내 이야기 쓰기</button>
        </>
      )}

      {step === 1 && (
        <>
          <p className="eyebrow">01 / 내 이야기</p>
          <h1>지금 마음에 걸리는 것</h1>
          <p>팀이 이 그림을 맞혀 보게 돼요. 말하고 싶은 만큼만 적으면 돼요.</p>

          <div className="panel">
            <label>얼마나 깊게 말할까요</label>
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
              placeholder="예: 숙제가 며칠째 그대로야" />

            <p className="eyebrow" style={{ marginTop: 18 }}>이제 그림으로 바꿔 봐요</p>
            <label>그것은 무엇과 같나요</label>
            <input value={sig.body} onChange={(e) => setSig({ ...sig, body: e.target.value })}
              placeholder="예: 젖은 성냥" />
            <label>그것은 어디에 있나요</label>
            <input value={sig.space} onChange={(e) => setSig({ ...sig, space: e.target.value })}
              placeholder="예: 안개 낀 벌판 한가운데" />
            <label>무엇이 있어야 달라지나요</label>
            <input value={sig.condition} onChange={(e) => setSig({ ...sig, condition: e.target.value })}
              placeholder="예: 바람이 잠깐 멎어야 한다" />
          </div>

          <button className="ghost small" onClick={pullFromDeck}>생각이 안 나면 여기서 고르기</button>
          <p style={{ fontSize: 13 }}>
            여기서 고른 이야기는 다른 사람 것이에요. 그래도 게임은 같고, 아무도 네 것인지 묻지 않아요.
          </p>
          <div style={{ height: 10 }} />
          <button onClick={() => setStep(2)} disabled={!ready}>다음</button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">02 / 방 들어가기</p>
          <h1>친구와 같은 방</h1>
          <div className="panel accent">
            <label htmlFor="nm">이름</label>
            <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="화면에 보일 이름" />
            <label htmlFor="cd">방 코드</label>
            <div className="row">
              <input id="cd" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} />
              <button className="small" onClick={() => go(code)} disabled={!name.trim() || code.length < 4}>
                들어가기
              </button>
            </div>
          </div>
          <button className="ghost" onClick={() => go(makeRoomCode())} disabled={!name.trim()}>
            새 방 만들기
          </button>
          <p style={{ fontSize: 13 }}>
            네 이야기 원문은 이 기기에만 있어요. 혼자여도 시작할 수 있어요.
          </p>
        </>
      )}
    </div>
  );
}
