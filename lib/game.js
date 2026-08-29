// ─────────────────────────────────────────────────────────────
// 밸런스 다이얼 — 리허설에서 여기 숫자만 바꾸세요.
// ─────────────────────────────────────────────────────────────
export const BALANCE = {
  rounds: 4,
  phase: { deal: 20, probe: 150, restore: 60, settle: 40 }, // 초
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

export const ROLE_LABEL = {
  holder: 'SOURCE',
  prober: 'PROBE',
  watcher: 'SENTINEL',
  restorer: 'RECON',
};

export const ROLE_KO = {
  holder: '원본',
  prober: '탐침',
  watcher: '감시',
  restorer: '복원',
};

export const ROLE_BRIEF = {
  holder: '당신의 시그널입니다. 당신만 원문을 봅니다. 2문장 이내로 응답하세요.',
  prober: '승인된 12개 질의 패턴만 사용 가능. 원본이 발신한 단어만 넣으세요.',
  watcher: '오염 질의를 차단합니다. 사이클당 2회.',
  restorer: '응답만 수신됩니다. 질의는 차단되어 있습니다. 시그널을 복원하세요.',
};

// 시그널 공개 강도 — 참가자가 직접 고릅니다. 강요는 없습니다.
export const INTENSITY = [
  { id: 'light', label: '표층', desc: '가벼운 것. 오늘 짜증났던 일 정도' },
  { id: 'mid', label: '중층', desc: '요즘 계속 걸리는 것' },
  { id: 'deep', label: '심층', desc: '진짜. 말해본 적 없는 것' },
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

// 라운드마다 시계방향 로테이션 — 4라운드에 전원이 4역할을 모두 경험합니다.
export function roleFor(seatIndex, round) {
  return ROLES[(seatIndex + round - 1) % ROLES.length];
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

export function cleanCoefficient(cleanScores) {
  if (!cleanScores.length) return BALANCE.cleanFloor;
  const avg = cleanScores.reduce((a, b) => a + b, 0) / cleanScores.length;
  return Math.max(BALANCE.cleanFloor, avg / 100);
}

export function roundScore({ restoreScores, cleanScores, challengeWins, round }) {
  const restore = restoreScores.length
    ? restoreScores.reduce((a, b) => a + b, 0) / restoreScores.length
    : 0;
  const coef = cleanCoefficient(cleanScores);
  const base = restore * coef + challengeWins * BALANCE.challengeBonus;
  const mult = round === BALANCE.rounds ? BALANCE.finalRoundMultiplier : 1;
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
