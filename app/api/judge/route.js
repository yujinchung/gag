// 질문 청정도 심판. 빠른 응답이 게임 리듬을 만들기 때문에 Haiku를 씁니다.
const MODEL = 'claude-haiku-4-5';

const SYSTEM = `당신은 클린 랭귀지(Clean Language) 심판이다.
탐문자의 질문이 보유자의 언어를 오염시켰는지 채점한다.

채점 기준(clean 0~100):
- 100: 보유자가 실제로 말한 단어만 사용. 새로운 명사/형용사/해석 없음.
- 70~95: 클린 템플릿을 지켰지만 조사나 어미가 미묘하게 방향을 유도함.
- 40~69: 보유자가 쓰지 않은 개념어를 끼워 넣음. 요약이나 바꿔 말하기.
- 0~39: 해석 주입("~라는 뜻이죠?"), 유도 질문, 예/아니오 강요, 조언.

note는 한국어 한 문장. 오염된 정확한 단어를 지목하고 왜 오염인지 말한다.
청정도 90 이상이면 note는 무엇이 좋았는지 한 문장.

반드시 아래 JSON만 출력한다. 다른 텍스트, 마크다운 백틱 금지.
{"clean": <0-100 정수>, "note": "<한 문장>"}`;

export async function POST(req) {
  try {
    const { question, holderWords = [], answers = [] } = await req.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `보유자가 지금까지 실제로 쓴 단어:\n${holderWords.join(', ') || '(아직 없음 — 첫 질문)'}\n\n보유자의 답변 원문:\n${answers.map((a, i) => `A${i + 1}. ${a}`).join('\n') || '(없음)'}\n\n채점할 질문:\n"${question}"`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    return Response.json({
      clean: Math.max(0, Math.min(100, Number(parsed.clean) || 0)),
      note: parsed.note || '',
    });
  } catch (e) {
    // 심판이 죽어도 게임은 멈추지 않습니다. 중립 점수로 통과시킵니다.
    return Response.json({ clean: 70, note: '심판 연결 실패 — 중립 점수로 처리했습니다.' });
  }
}
