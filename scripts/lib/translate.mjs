/**
 * 段落级机器翻译（导入时用，跑一遍后写入 JSON 固化）
 */
const cache = new Map()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function translateParagraph(text, delayMs = 400) {
  const key = text.slice(0, 200)
  if (cache.has(key)) return cache.get(key)

  await sleep(delayMs)

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    const res = await fetch(url)
    const data = await res.json()
    const zh =
      data?.responseData?.translatedText?.replace(/&quot;/g, '"') || ''
    if (zh && !zh.toUpperCase().includes('MYMEMORY WARNING')) {
      cache.set(key, zh)
      return zh
    }
  } catch {
    // 翻译失败留空，前端仍可看英文
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
}
