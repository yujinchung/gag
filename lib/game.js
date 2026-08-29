// ─────────────────────────────────────────────────────────────
// 밸런스 다이얼 — 리허설에서 여기 숫자만 바꾸세요.
// ─────────────────────────────────────────────────────────────
export const BALANCE = {
  rounds: 4,
  phase: { deal: 10, probe: 150, restore: 60, settle: 45 }, // 초
  cleanFloor: 0.4,          // 청정 계수 하한
  challengeBonus: 15,       // 챌린지 성공
  challengePenaltySec: 15,  // 챌린지 실패 시 탐문 시간 차감
  challengesPerRound: 2,
  smogThreshold: 70,        // 전체 오염 임계 (%)
  smogDuration: 60,         // 스모그 지속 (초)
  pollutionPerBadQuestion: 4,   // 청정도 50 미만 질문 1개당 상승치
  pollutionDecayPer15s: 2,
  pollutionCleanse: 3,      // 챌린지 성공 시 하락치
  crossWatchRound: 3,       // 교차 감시 사이클
  echoRound: 4,             // ECHO 사이클 — 은유 3요소만 공개, 원문은 비공개
  echoWindowSec: 45,
  echoGain: 30,
  echoFail: 10,
  finalRoundMultiplier: 2,
};

export const ROLES = ['holder', 'prober', 'watcher', 'restorer'];
export const POD_SIZE = ROLES.length;

export const ROLE_LABEL = {
  holder: '주인',
  prober: '질문',
  watcher: '지킴이',
  restorer: '맞히기',
};

export const ROLE_KO = {
  holder: '이야기 주인',
  prober: '질문하는 사람',
  watcher: '지킴이',
  restorer: '그림 맞히기',
};

export const ROLE_BRIEF = {
  holder: '이건 네 이야기야. 친구가 물으면 짧게 대답해 줘.',
  prober: '친구가 말한 단어로만 물어봐. 네 추측은 넣지 마.',
  watcher: '누가 답을 정해주는 질문을 하면 막아. 한 라운드에 두 번이야.',
  restorer: '질문은 안 보여. 대답만 듣고 그림이 뭔지 맞춰 봐.',
};

export const ROLE_TIP = {
  holder: '길게 설명하지 않아도 돼. 친구가 말한 그림을 이어서 말해 봐.',
  prober: '"힘들었겠다"처럼 네 생각을 넣으면 점수가 떨어져. 친구가 쓴 말만 골라.',
  watcher: '"~라는 거지?"처럼 답을 밀어 넣는 질문이 더러운 질문이야. 그걸 막아.',
  restorer: '대답에만 나온 그림을 따라가. 질문에서 슬쩍 들어온 말은 무시해.',
};

export const PHASE_TIP = {
  deal: '준비됐으면 바로 질문을 시작해도 돼. 네 할 일만 보면 돼.',
  probe: '친구가 한 말만 쓰는 게 Clean Language야. 내 해석을 섞지 마.',
  restore: '질문은 몰래 보면 반칙이야. 대답만으로 맞히는 게 이 게임의 재미야.',
  settle: '어느 질문이 그림을 바꿨는지 찾아봐. 범인을 찾는 시간이야.',
};

export const INTENSITY = [
  { id: 'light', label: '가벼운 이야기', desc: '오늘 살짝 짜증 났던 일 정도' },
  { id: 'mid', label: '요즘 마음', desc: '요즘 자꾸 마음에 걸리는 것' },
  { id: 'deep', label: '깊은 이야기', desc: '아직 잘 말 안 해본 것. 안 해도 괜찮아' },
];


// 클린 랭귀지 12 템플릿. {X}, {Y}는 보유자가 쓴 단어로 채웁니다.
export const TEMPLATES = [
  { id: 1, text: '그 {X}는 어떤 종류의 {X}인가요?', slots: 1 },
  { id: 2, text: '{X}에 대해 그 밖에 또 있나요?', slots: 1 },
  { id: 3, text: '그 {X}는 어디에 있나요?', slots: 1 },
  { id: 4, text: '그 {X}는 어디쯤에 있나요?', slots: 1 },
  { id: 5, text: '그 {X}는 무엇과 같나요?', slots: 1 },
  { id: 6, text: '{X}와 {Y} 사이에 관계가 있나요?', slots: 2 },
  { id: 7, text: '{X} 직전에는 무슨 일이 있나요?', slots: 1 },
  { id: 8, text: '그 {X}는 어디에서 오나요?', slots: 1 },
  { id: 9, text: '그 {X}는 무엇이 일어나길 바라나요?', slots: 1 },
  { id: 10, text: '{X}가 되려면 무엇이 필요한가요?', slots: 1 },
  { id: 11, text: '그 {X}가 그렇게 될 수 있나요?', slots: 1 },
  { id: 12, text: '{X}일 때 {Y}에는 무슨 일이 일어나나요?', slots: 2 },
];

// 슬롯에 단어가 들어가면 조사가 틀어집니다("성냥는"). 받침 보고 고칩니다.
const JOSA_PAIRS = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와']];
export function fixJosa(s) {
  return s.replace(/([가-힣])(은|는|이|가|을|를|과|와)(?=\s|$|[.,?!])/g, (m, ch, j) => {
    const hasJong = (ch.charCodeAt(0) - 0xac00) % 28 !== 0;
    const pair = JOSA_PAIRS.find((p) => p.includes(j));
    return pair ? ch + (hasJong ? pair[0] : pair[1]) : m;
  });
}

export function fillTemplate(tpl, x, y) {
  return fixJosa(tpl.text.replaceAll('{X}', x || '___').replaceAll('{Y}', y || '___'));
}

// 라운드마다 시계방향 로테이션 — 4인일 때 전원이 4역할을 모두 경험합니다.
export function roleFor(seatIndex, round) {
  return ROLES[(seatIndex + round - 1) % ROLES.length];
}

export function cycleCount(memberCount) {
  return Math.min(BALANCE.rounds, Math.max(1, memberCount));
}

export function holderSeat(round, memberCount) {
  const n = Math.max(1, Math.min(POD_SIZE, memberCount));
  if (n === 4) return ((1 - round) % ROLES.length + ROLES.length) % ROLES.length;
  return (round - 1) % n;
}

/**
 * 인원별 역할. SOURCE와 RECON이 같은 사람인 경우는 1인 연습뿐.
 * 2인: 원본+감시 vs 탐침(복원 페이즈에 질의 셔터)
 * 3인: 원본+감시 / 탐침 / 복원
 * 4인: 시계방향 1역할
 */
export function rolesForSeat(seatIndex, round, memberCount) {
  const n = Math.max(1, Math.min(POD_SIZE, memberCount));
  if (seatIndex < 0 || seatIndex >= n) return [];
  if (n === 1) return [...ROLES];
  if (n === 4) return [roleFor(seatIndex, round)];
  const holder = holderSeat(round, n);
  if (n === 2) {
    return seatIndex === holder ? ['holder', 'watcher'] : ['prober', 'restorer'];
  }
  const prober = round % n;
  const restorer = (round + 1) % n;
  const roles = [];
  if (seatIndex === holder) roles.push('holder', 'watcher');
  if (seatIndex === prober) roles.push('prober');
  if (seatIndex === restorer) roles.push('restorer');
  return roles;
}

export function visibleRoles(myRoles, phase) {
  if (phase === 'probe') {
    const live = myRoles.filter((r) => r !== 'restorer');
    // 맞히기만 맡은 사람은 질문 시간에도 대답을 듣게 해요. 빈 화면이면 재미가 없어요.
    return live.length ? live : ['restorer'];
  }
  if (phase === 'restore') return myRoles.filter((r) => r === 'restorer');
  return [];
}

export function cleanStreak(questions) {
  let n = 0;
  for (const q of [...(questions || [])].reverse()) {
    if (q.voided) continue;
    if (q.clean >= 70) n += 1;
    else break;
  }
  return n;
}

export function makeSting(kind, title, body) {
  return { kind, title, body, at: Date.now() };
}

export function worstQuestion(questions) {
  const live = (questions || []).filter((q) => !q.voided);
  return [...live].sort((a, b) => a.clean - b.clean)[0] || null;
}

export function matchHit(score) {
  return (score ?? 0) >= 70;
}

export function settleCause(st) {
  const qs = st.questions || [];
  const live = qs.filter((q) => !q.voided);
  const worst = [...live].sort((a, b) => a.clean - b.clean)[0];
  const scores = st.restore?.scores || {};
  const bodyLow = (scores.body ?? 100) < 70;
  if (!st.restore?.guess) return '아직 그림을 맞혀 보지 않았어요.';
  if (worst && worst.clean < 50 && bodyLow) {
    return `깨끗한 점수가 ${worst.clean}인 질문에 추측이 들어갔고, 맞힌 그림이 달라졌어요.`;
  }
  if (worst && worst.clean < 60) {
    return `제일 덜 깨끗했던 질문 점수는 ${worst.clean}. ${worst.note || ''}`.trim();
  }
  return scores.note || '맞춰 보기가 끝났어요.';
}

// 보유자 답변에서 뽑아낸 단어만 탐문자의 슬롯 후보가 됩니다.
export function holderVocabulary(answers) {
  const stop = new Set(['그리고', '그런데', '하지만', '그냥', '조금', '정말', '지금', '거기', '여기', '이거', '그거']);
  const words = answers
    .join(' ')
    .replace(/[.,!?"'()~…·\n]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(이|가|은|는|을|를|에|에서|으로|로|과|와|도|만|의|께|처럼|보다)$/, ''))
    .filter((w) => w.length >= 2 && !stop.has(w));
  return [...new Set(words)];
}

/** 심판이 죽어도 추측 단어는 바로 잡히게. 질문에 넣은 단어만 봐요. */
export function scoreSlots(slots = [], holderWords = []) {
  const filled = (slots || []).map((w) => String(w || '').trim()).filter(Boolean);
  if (!holderWords.length) {
    return { clean: 80, note: '첫 질문이에요. 대답이 오면 그 단어만 써요.' };
  }
  const extra = filled.filter((w) => !holderWords.includes(w));
  if (!extra.length) {
    return { clean: 95, note: '친구가 말한 단어만 썼어요.' };
  }
  return { clean: 28, note: `"${extra[0]}"는 친구가 안 쓴 말이에요.` };
}

function overlapScore(truth, guess) {
  const t = String(truth || '').trim();
  const g = String(guess || '').trim();
  if (!t || !g) return 20;
  if (t === g) return 100;
  if (t.includes(g) || g.includes(t)) return 88;
  const tw = t.split(/\s+/).filter((w) => w.length >= 2);
  const gw = g.split(/\s+/).filter((w) => w.length >= 2);
  const hit = tw.filter((w) => gw.some((x) => x.includes(w) || w.includes(x)));
  if (!tw.length) return 20;
  const ratio = hit.length / tw.length;
  if (ratio >= 0.5) return 78;
  if (ratio > 0) return 42;
  return 18;
}

export function scoreRestore(truth = {}, guess = {}) {
  const body = overlapScore(truth.body, guess.body);
  const space = overlapScore(truth.space, guess.space);
  const condition = overlapScore(truth.condition, guess.condition);
  const avg = (body + space + condition) / 3;
  return {
    body, space, condition,
    note: avg >= 70 ? '그림이 꽤 비슷해요.' : '맞힌 그림이 원래와 달라요. 어느 질문이 바꿨는지 봐요.',
  };
}

export function cleanCoefficient(cleanScores) {
  if (!cleanScores.length) return BALANCE.cleanFloor;
  const avg = cleanScores.reduce((a, b) => a + b, 0) / cleanScores.length;
  return Math.max(BALANCE.cleanFloor, avg / 100);
}

export function roundScore({ restoreScores, cleanScores, challengeWins, round, totalRounds = BALANCE.rounds }) {
  const restore = restoreScores.length
    ? restoreScores.reduce((a, b) => a + b, 0) / restoreScores.length
    : 0;
  const coef = cleanCoefficient(cleanScores);
  const base = restore * coef + challengeWins * BALANCE.challengeBonus;
  const mult = round === totalRounds ? BALANCE.finalRoundMultiplier : 1;
  return Math.round(base * mult);
}

export function newRoundState(round) {
  return {
    round,
    phase: 'deal',
    phaseEndsAt: Date.now() + BALANCE.phase.deal * 1000,
    questions: [],   // { id, text, clean, note, voided }
    answers: [],     // { text }
    challengesLeft: BALANCE.challengesPerRound,
    challengeWins: 0,
    restore: null,   // { guess, scores, reveal }
  };
}

export function meter(value, width = 20) {
  const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function makeRoomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
}
