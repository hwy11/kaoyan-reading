/**
 * 段落级机器翻译（导入时用，跑一遍后写入 JSON 固化）
 * 使用 Google 公开翻译接口 + 磁盘缓存，可断点续跑。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.join(__dirname, '../.translate-cache.json')

const memory = new Map()

function loadDiskCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    for (const [k, v] of Object.entries(data)) memory.set(k, v)
  } catch {
    // no cache
  }
}

function saveDiskCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(memory)), 'utf-8')
}

loadDiskCache()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function cacheKey(text) {
  return text.slice(0, 120) + '|' + text.length
}

function chunkText(text, maxLen = 900) {
  if (text.length <= maxLen) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]
  const chunks = []
  let buf = ''
  for (const s of sentences) {
    if ((buf + s).length > maxLen && buf) {
      chunks.push(buf.trim())
      buf = s
    } else {
      buf += s
    }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

async function translateOnce(text) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
    encodeURIComponent(text)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  // data[0] 是 [[translated, original, ...], ...]
  const parts = data?.[0]
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => p?.[0] || '').join('')
}

export async function translateParagraph(text, delayMs = 120) {
  const key = cacheKey(text)
  if (memory.has(key)) return memory.get(key)

  try {
    const parts = chunkText(text)
    const zhParts = []
    for (const part of parts) {
      await sleep(delayMs)
      let zh = ''
      try {
        zh = await translateOnce(part)
      } catch {
        await sleep(800)
        zh = await translateOnce(part)
      }
      if (zh) zhParts.push(zh)
    }
    const joined = zhParts.join('')
    if (joined) {
      memory.set(key, joined)
      if (memory.size % 15 === 0) saveDiskCache()
      return joined
    }
  } catch {
    // ignore
  }
  return ''
}

export async function translatePassages(passages, onProgress) {
  let done = 0
  const total = passages.reduce((n, p) => n + p.paragraphs.length, 0)

  for (const passage of passages) {
    for (const para of passage.paragraphs) {
      if (!para.zh) {
        para.zh = await translateParagraph(para.en)
      }
      done++
      onProgress?.(done, total, passage.title)
    }
  }
  saveDiskCache()
}
