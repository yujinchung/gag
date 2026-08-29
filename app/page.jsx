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
        <span>마음속 소리 듣기</span>
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
            <p className="eyebrow">Clean Language란</p>
            <p style={{ color: 'var(--fg)' }}>
              상대가 말한 단어만 받아서 묻는 말이에요. 내 해석이나 “이런 거지?”는 넣지 않아요.
              그래서 그 사람의 마음속 소리가 그대로 들려요.
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

            <p className="eyebrow" style={{ marginTop: 18 }}>메타포를 사용해봐요</p>
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
          <div style={{ height: 10 }} />
          <button onClick={() => setStep(2)} disabled={!ready}>다음</button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="eyebrow">02 / 방 들어가기</p>
          <h1>친구와 같은 방</h1>
          <div className="panel tip">
            <p className="eyebrow">방을 왜 만들까요</p>
            <p style={{ color: 'var(--fg)' }}>
              같은 코드를 가진 친구끼리 모여, 한 사람의 마음속 소리를 함께 듣기 위해서예요.
              방 안에서는 질문하는 사람, 대답하는 사람, 맞혀 보는 사람이 나뉘어요.
            </p>
          </div>
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
            안심하세요. 내가 적은 내용은 내 기기에만 있어요. 혼자여도 시작 가능!
          </p>
        </>
      )}
    </div>
  );
}
