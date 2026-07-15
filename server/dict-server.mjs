/**
 * 本地 ECDICT 词典服务 — 开发时由 Vite 代理 /api/dict 到这里。
 * 首次启动会加载约 200MB 词库到内存，之后查词毫秒级响应。
 */
import http from 'node:http'
import { searchWord, findLemma } from 'ecdict'

const PORT = Number(process.env.DICT_PORT) || 3456

function formatText(text) {
  if (!text) return ''
  return text.replace(/\\n/g, '；').replace(/\s+/g, ' ').trim()
}

function lookup(rawWord) {
  const word = rawWord.trim().toLowerCase()
  if (!word || !/^[a-z'-]+$/.test(word)) return null

  let result = searchWord(word, { caseInsensitive: true })
  if (!result?.translation) {
    const lemma = findLemma(word, true)
    if (lemma?.word && lemma.word !== word) {
      result = searchWord(lemma.word, { caseInsensitive: true })
    }
  }
  if (!result?.translation) return null

  return {
    word: result.word,
    phonetic: result.phonetic || '',
    translation: formatText(result.translation),
    definition: formatText(result.definition),
    tag: result.tag || '',
    collins: result.collins || '',
    oxford: result.oxford || '',
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/dict' && req.method === 'GET') {
    const word = url.searchParams.get('word') || ''
    const result = lookup(word)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (result) {
      res.writeHead(200)
      res.end(JSON.stringify(result))
    } else {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not found', word }))
    }
    return
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`[dict] ECDICT ready → http://localhost:${PORT}/api/dict?word=hello`)
})
