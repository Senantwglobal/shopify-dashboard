export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const text = body?.text
    if (!text) return res.status(400).json({ error: '회의록 내용이 없습니다.' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'API 키 미설정 (ANTHROPIC_API_KEY)' })

    const prompt = `다음 회의록을 분석해서 JSON만 반환해. 코드블록 없이 순수 JSON만 반환해.

{"summary":"핵심 요약 2~3줄","decisions":["결정사항1","결정사항2"],"pending":["미확인1","미확인2"],"actions":["액션아이템1 (담당자)","액션아이템2 (담당자)"]}

회의록:
${text}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({
        error: `Anthropic 오류 ${response.status}: ${data?.error?.message || JSON.stringify(data)}`
      })
    }

    const raw = data.content?.[0]?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'JSON 파싱 실패. AI 응답: ' + raw.slice(0, 200) })
    }

    return res.status(200).json(parsed)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
