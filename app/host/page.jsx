'use client';
import { useEffect } from 'react';
import { useGlobalPollution } from '../../lib/useRoom';
import { BALANCE, meter } from '../../lib/game';

export default function Host() {
  const { pollution, smog, board, requestBoard } = useGlobalPollution({ podCode: null });

  useEffect(() => {
    document.body.dataset.air = smog ? 'smog' : pollution >= 35 ? 'haze' : 'clear';
  }, [pollution, smog]);

  useEffect(() => {
    requestBoard();
    const t = setInterval(requestBoard, 5000);
    return () => clearInterval(t);
  }, [requestBoard]);

  const rows = Object.values(board).sort((a, b) => b.score - a.score);

  return (
    <div className="host">
      <div className="wrap wide" style={{ paddingTop: 28 }}>
        <div className="between">
          <h1 style={{ letterSpacing: '.3em', fontSize: 26 }}>C L E A N &nbsp; R O O M</h1>
          <span className="num" style={{ fontSize: 22, color: smog ? 'var(--taint)' : 'var(--clean)' }}>
            {smog ? 'SMOG' : 'CLEAR'}
          </span>
        </div>

        <div className="panel">
          <div className="between">
            <span className="eyebrow">대기 오염도 · 전 구역 공용 · 임계 {BALANCE.smogThreshold}%</span>
            <span className="num" style={{ color: pollution >= BALANCE.smogThreshold ? 'var(--taint)' : 'var(--amber)' }}>
              {Math.round(pollution)}%
            </span>
          </div>
          <div className={`meter ${pollution >= BALANCE.smogThreshold ? 'taint' : 'amber'}`} style={{ fontSize: 22 }}>
            {meter(pollution, 40)}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">정화 순위 · 점수 · 청정도</p>
          {rows.map((r, i) => (
            <div key={r.pod} className="board-row">
              <span className="rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="name">POD {r.pod}</span>
              <span className={`meter ${r.clean < 60 ? 'taint' : 'clean'}`}>{meter(r.clean, 20)}</span>
              <span className="num" style={{ fontSize: 20, textAlign: 'right' }}>{r.score}</span>
            </div>
          ))}
          {!rows.length && <p>팟이 접속하면 여기에 나타납니다.</p>}
        </div>
      </div>
    </div>
  );
}
