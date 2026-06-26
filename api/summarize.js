export const config = {
  api: { bodyParser: false }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Stream에서 body 직접 읽기
    const rawBody = await new Promise((resolve, reject) => {
      let data = ''
      req.on('data', chunk => { data += chunk })
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })

    let body
    try {
      body = JSON.parse(rawBody)
    } catch {
      return res.status(400).json({ error: 'body 파싱 실패: ' + rawBody.slice(0, 100) })
    }

    const text = body?.text
    if (!text) return res.status(400).json({ error: '회의록 내용 없음' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 없음' })

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
        messages: [{
          role: 'user',
          content: `다음 회의록을 분석해서 JSON만 반환해. 코드블록 없이 순수 JSON만.

{"summary":"핵심 요약","decisions":["결정1"],"pending":["미확인1"],"actions":["액션1 (담당자)"]}

회의록:
${text}`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(500).json({
        error: `Anthropic ${response.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 200)}`
      })
    }

    const raw = data.content?.[0]?.text || ''
    const clean = raw.replace(/```json|```/g, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) }
    catch (e) { return res.status(500).json({ error: 'JSON 파싱 실패: ' + raw.slice(0, 200) }) }

    return res.status(200).json(parsed)

  } catch (e) {
    return res.status(500).json({ error: '예외: ' + e.message })
  }
}
