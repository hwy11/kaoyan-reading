/**
 * Vercel Serverless 查词 API（线上用，不打包 ECDICT）
 * 本地开发仍走 server/dict-server.mjs + ECDICT
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const word = (req.query.word || '').trim().toLowerCase()
  if (!word || !/^[a-z'-]+$/.test(word)) {
    return res.status(400).json({ error: 'invalid word' })
  }

  try {
    let phonetic = ''
    let definition = ''
    let translation = ''

    const dictRes = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    )
    if (dictRes.ok) {
      const entries = await dictRes.json()
      const entry = entries[0]
      phonetic = entry?.phonetic || entry?.phonetics?.[0]?.text || ''
      const defs = []
      for (const m of entry?.meanings || []) {
        const pos = m.partOfSpeech ? `${m.partOfSpeech}. ` : ''
        for (const d of m.definitions?.slice(0, 2) || []) {
          if (d.definition) defs.push(pos + d.definition)
        }
      }
      definition = defs.slice(0, 4).join('；')
    }

    const transRes = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`,
    )
    if (transRes.ok) {
      const transData = await transRes.json()
      const t = transData?.responseData?.translatedText || ''
      if (t && !t.toUpperCase().includes('MYMEMORY WARNING')) {
        translation = t
      }
    }

    if (!translation && definition) {
      const defTransRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(definition.slice(0, 200))}&langpair=en|zh-CN`,
      )
      if (defTransRes.ok) {
        const d = await defTransRes.json()
        translation = d?.responseData?.translatedText || definition
      }
    }

    if (!translation && !definition) {
      return res.status(404).json({ error: 'not found', word })
    }

    return res.status(200).json({
      word,
      phonetic,
      translation: translation || definition,
      definition,
      tag: '',
    })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
