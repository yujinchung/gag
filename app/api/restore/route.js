const MODEL = 'claude-haiku-4-5';

const SYSTEM = `당신은 은유 복원 심판이다.
원본 은유 카드의 3요소와 복원자가 제출한 3요소를 각각 의미 유사도로 채점한다.

채점은 표현이 아니라 의미로 한다.
- 90~100: 같은 이미지. 단어가 달라도 같은 것을 가리킨다.
- 60~89: 방향은 맞지만 결정적 속성 하나가 빠졌거나 다르다.
- 30~59: 인접한 이미지지만 다른 것을 가리킨다.
- 0~29: 무관.

note는 한국어 한 문장. 무엇을 놓쳤는지 말한다.

반드시 아래 JSON만 출력한다. 다른 텍스트, 마크다운 백틱 금지.
{"body": <0-100>, "space": <0-100>, "condition": <0-100>, "note": "<한 문장>"}`;

export async function POST(req) {
  try {
    const { truth, guess } = await req.json();

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
            content: `원본\n- 본체: ${truth.body}\n- 공간: ${truth.space}\n- 조건: ${truth.condition}\n\n복원\n- 본체: ${guess.body || '(미제출)'}\n- 공간: ${guess.space || '(미제출)'}\n- 조건: ${guess.condition || '(미제출)'}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
    const p = JSON.parse(text);
    const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));
    return Response.json({ body: clamp(p.body), space: clamp(p.space), condition: clamp(p.condition), note: p.note || '' });
  } catch (e) {
    return Response.json({ body: 50, space: 50, condition: 50, note: '심판 연결 실패 — 중립 점수로 처리했습니다.' });
  }
}
