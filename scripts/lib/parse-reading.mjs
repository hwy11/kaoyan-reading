/**
 * 从考研真题网页解析阅读理解 Section，输出 JSON。
 * 供 scripts/import-years.mjs 调用。
 */
import * as cheerio from 'cheerio'

const QUESTION_START = {
  1: 21,
  2: 26,
  3: 31,
  4: 36,
}

/** 清洗网页纯文本 */
export function normalizePageText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 从 HTML 提取带结构的纯文本 */
export function htmlToStructuredText(html) {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, iframe').remove()

  $('br').replaceWith('\n')
  $('p, div, h1, h2, h3, li, tr').each((_, el) => {
    $(el).append('\n')
  })

  let text = $('body').text()
  // 补结构标记（部分站点把 Text 1 和正文粘在一起）
  text = text.replace(/(Text\s+[1-4])\s*/gi, '\n\n$1\n\n')
  text = text.replace(
    /(Section\s+[IⅡ1-2]+\s*Reading\s+Comprehension)/gi,
    '\n\n$1\n\n',
  )
  text = text.replace(/\b(2[1-9]|3[0-6])\.\s*/g, '\n\n$1. ')
  text = text.replace(/\s*\[([A-D])\]\s*/g, '\n[$1] ')
  text = text.replace(/\n([A-D])[\.\)]\s+/g, '\n$1. ')

  return normalizePageText(text)
}

/** 截取 Reading Comprehension Part A 区域 */
export function extractReadingSection(text) {
  const startMatch = text.match(
    /Section\s+[IⅡ1-2]+\s*Reading\s+Comprehension/i,
  )
  if (!startMatch) return null

  let body = text.slice(startMatch.index)
  const endPatterns = [
    /\nSection\s+[IⅢ3]+\s*(Translation|Writing)/i,
    /\nPART\s+III\s+TRANSLATION/i,
    /\nPart\s+B\b/i,
    /\nSection\s+III\s+Translation/i,
    /\nDirections:\s*Read the following text and then answer the questions by finding a subtitle/i,
    /\n【Text\s+1\s+答案解析】/,
    /\n41\.\s*_{3,}/,
  ]

  let end = body.length
  for (const pat of endPatterns) {
    const m = body.match(pat)
    if (m && m.index > 500 && m.index < end) end = m.index
  }

  body = body.slice(0, end)
  // 去掉 Directions 头部
  body = body.replace(
    /^[\s\S]*?Directions[：:][\s\S]*?\(40\s*points?\)\s*/i,
    '',
  )
  return body.trim()
}

function splitParagraphs(passageText) {
  let chunks = passageText
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // 网页常把多段粘成一块，按句号+大写拆段
  if (chunks.length <= 1 && chunks[0] && chunks[0].length > 400) {
    chunks = chunks[0]
      .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40)
  }

  return chunks.filter((p) => {
    if (p.length < 40) return false
    if (/^Text\s+\d/i.test(p)) return false
    if (/^\d{2}\.\s/.test(p)) return false
    if (/^【/.test(p)) return false
    if (/^Section\s/i.test(p)) return false
    if (/^Part\s/i.test(p)) return false
    if (/^Directions/i.test(p)) return false
    if (/^上一篇/.test(p)) return false
    if (/^下一篇/.test(p)) return false
    if (/^摘要/.test(p)) return false
    if (/^热门/.test(p)) return false
    return true
  })
}

function parseOptions(block) {
  const options = []
  const bracket = [...block.matchAll(/\[([A-D])\]\s*([\s\S]*?)(?=\n\[[A-D]\]|\n[A-D][\.\)]|$)/g)]
  if (bracket.length >= 4) {
    for (const m of bracket.slice(0, 4)) {
      options.push(m[2].replace(/\s+/g, ' ').trim())
    }
    return options
  }
  const lines = block.split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*([A-D])[\.\)]\s*(.+)/)
    if (m) options.push(m[2].trim())
  }
  return options.slice(0, 4)
}

function parseQuestions(textBlock, textNum) {
  const startNum = QUESTION_START[textNum]
  const questions = []
  const body = '\n' + textBlock

  for (let num = startNum; num <= startNum + 4; num++) {
    const nextMarker =
      num < startNum + 4
        ? `\\n${num + 1}\\.\\s`
        : `(?:\\nText\\s+[1-4]\\s|\\n【|$)`
    const re = new RegExp(`\\n${num}\\.\\s*([\\s\\S]*?)(?=${nextMarker})`)
    const m = body.match(re)
    if (!m) continue

    const chunk = m[1].trim()
    const optIdx = chunk.search(/\n\s*(?:\[[A-D]\]|[A-D][\.\)])\s*/)
    if (optIdx < 0) continue

    const qText = chunk
      .slice(0, optIdx)
      .replace(/\s+/g, ' ')
      .trim()
    const optBlock = chunk.slice(optIdx)
    const options = parseOptions(optBlock)

    if (qText && options.length === 4) {
      questions.push({ number: num, text: qText, options })
    }
  }

  return questions
}

export function parseReadingPassages(sectionText) {
  const passages = []
  const parts = sectionText.split(/(?:^|\n)Text\s+(\d)\s*(?:\n|$)/i)

  // split 结果: [前导, '1', text1内容, '2', text2内容, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const textNum = Number(parts[i])
    if (textNum < 1 || textNum > 4) continue

    let block = parts[i + 1] || ''
    // 截到下一篇 Text 或答案解析
    block = block.split(/\nText\s+\d\s*\n/i)[0]
    block = block.split(/\n【Text\s+\d/i)[0]
    block = block.split(/\nText\s+\d\s*$/i)[0]

    const qStart = block.search(new RegExp(`\\n${QUESTION_START[textNum]}\\.\\s`))
    if (qStart < 0) continue

    const passageBody = block.slice(0, qStart).trim()
    const questionBody = block.slice(qStart).trim()
    const paragraphs = splitParagraphs(passageBody)
    const questions = parseQuestions(questionBody, textNum)

    if (paragraphs.length === 0) continue

    passages.push({
      textNumber: textNum,
      title: `Text ${textNum}`,
      paragraphs: paragraphs.map((en) => ({ en, zh: '' })),
      questions,
      vocabulary: {},
    })
  }

  return passages
}

export function buildYearGroup(year, passages) {
  return {
    year,
    exams: [
      {
        type: 'english-2',
        label: '英语二',
        passages: passages.map((p) => ({
          id: `${year}-en2-text${p.textNumber}`,
          year,
          exam: 'english-2',
          textNumber: p.textNumber,
          title: p.title,
          paragraphs: p.paragraphs,
          questions: p.questions,
          vocabulary: p.vocabulary || {},
        })),
      },
    ],
  }
}
