/**
 * 从考研英语二 PDF 真题中解析阅读 Part A
 * 数据源：Fantasia1999/kaoyanzhenti（考场版 PDF）
 */

const QUESTION_START = { 1: 21, 2: 26, 3: 31, 4: 36 }

const OCR_MAP = [
  [/伍ms/g, 'firms'],
  [/伍m/g, 'firm'],
  [/con皿ittee/g, 'committee'],
  [/perm1ss1ve/g, 'permissive'],
  [/orgamzat10ns/g, 'organizations'],
  [/adm1mstratlon/g, 'administration'],
  [/pnvacy/g, 'privacy'],
  [/onlme/g, 'online'],
  [/transact10ns/g, 'transactions'],
  [/trustmg/g, 'trusting'],
  [/mi ght/g, 'might'],
  [/fin g erprint/g, 'fingerprint'],
  [/re g ister/g, 'register'],
  [/damag e/g, 'damage'],
  [/Foreig n/g, 'Foreign'],
  [/sava g ely/g, 'savagely'],
  [/g ely/g, 'gely'],
  [/News a ers/g, 'Newspapers'],
  [/chroniclin/g, 'chronicling'],
  [/mechamcal/g, 'mechanical'],
  [/memonzat10n/g, 'memorization'],
  [/mot1vat10n/g, 'motivation'],
  [/fbr\b/g, 'for'],
  [/\bifs\b/g, "it's"],
  [/progress9\^\^/g, 'progress,"'],
  [/\^\^/g, '"'],
  [/\/9/g, '."'],
  [/beef\^/g, 'beef,'],
  [/[\u4e00-\u9fff]/g, ''], // 去掉夹杂汉字（OCR 噪声）
]

/** 全角拉丁字符 → 半角（部分扫描 PDF 会这样） */
export function fullwidthToHalf(text) {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0xff01 && code <= 0xff5e) out += String.fromCharCode(code - 0xfee0)
    else if (ch === '\u3000') out += ' '
    else out += ch
  }
  return out
}

export function cleanOcr(text) {
  let s = fullwidthToHalf(text)
  for (const [re, rep] of OCR_MAP) s = s.replace(re, rep)
  // 清理奇怪点号：p·r·o·d·u·c·e·d → produced；[A·] → [A]
  s = s.replace(/·/g, '')
  // 空白坍缩
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function isPageNoise(line) {
  const t = line.trim()
  if (!t) return true
  if (/^-?\d+-?$/.test(t)) return true
  if (/^\d{4}年/.test(t)) return true
  if (/英语[（(]二[）)]/.test(t)) return true
  if (/第\s*\d+\s*页/.test(t)) return true
  if (/共\s*\d+\s*页/.test(t)) return true
  if (/^ANSWER SHEET/i.test(t)) return true
  return false
}

function endsSentence(buf) {
  const s = buf.trim()
  if (/\b(Mr|Mrs|Ms|Dr|Prof|Jr|Sr|vs|etc|U\.S|U\.K|a\.m|p\.m|e\.g|i\.e)\.$/i.test(s)) {
    return false
  }
  return /[.!?]["'”’]?$/.test(s)
}

/**
 * 把 PDF 行还原成段落。
 * 优先用版式缩进（-layout）：段首通常有 ≥3 空格缩进；
 * 没有缩进信息时，退回「句末 + 下一行大写」启发式。
 */
export function linesToParagraphs(lines, { useIndent = false } = {}) {
  const paras = []
  let buf = ''

  const flush = () => {
    const cleaned = cleanOcr(buf)
    if (cleaned.length > 30) paras.push(cleaned)
    buf = ''
  }

  for (const raw of lines) {
    if (isPageNoise(raw)) {
      // 页码噪声：不要因此强制切段，除非缓冲区已经像段落结束
      continue
    }

    const indent = raw.match(/^( *)/)?.[1].length ?? 0
    const line = raw.trim()
    if (!line) {
      if (buf && endsSentence(buf)) flush()
      continue
    }

    if (!buf) {
      buf = line
      continue
    }

    const indentBreak = useIndent && indent >= 3 && endsSentence(buf)
    const heuristicBreak =
      !useIndent && endsSentence(buf) && /^["'“‘A-Z]/.test(line)

    if (indentBreak || heuristicBreak) {
      flush()
      buf = line
    } else {
      buf += ' ' + line
    }
  }
  flush()
  return paras
}

export function extractReadingSection(fullText) {
  const start =
    fullText.search(/Section\s+II\s+Reading\s+Comprehension/i) >= 0
      ? fullText.search(/Section\s+II\s+Reading\s+Comprehension/i)
      : fullText.search(/Reading\s+Comprehension/i)
  if (start < 0) return null

  let body = fullText.slice(start)
  const endMatch = body.match(
    /\n(?:Section\s+III|PART\s+III|Part\s+B|Section\s+Ⅲ|Translation)\b/i,
  )
  if (endMatch) body = body.slice(0, endMatch.index)
  return body
}

function parseOptions(block) {
  const options = []
  // [A] xxx  或  A. xxx  或  A) xxx
  const re = /(?:\[([A-D])\]|([A-D])[\.\)])\s*([^\n\[]+)/g
  let m
  while ((m = re.exec(block)) !== null) {
    const opt = cleanOcr(m[3])
    if (opt && opt.length > 1) options.push(opt.replace(/\s+/g, ' ').trim())
  }
  const uniq = []
  for (const o of options) {
    if (!uniq.includes(o)) uniq.push(o)
    if (uniq.length === 4) break
  }
  return uniq
}

function parseQuestions(questionBody, textNum) {
  const startNum = QUESTION_START[textNum]
  const questions = []
  let body =
    '\n' +
    questionBody
      .replace(/\f/g, '\n')
      .replace(/·/g, '')
      .replace(/\[\s*([A-D])\s*\]/g, '[$1]')

  for (let num = startNum; num <= startNum + 4; num++) {
    const next =
      num < startNum + 4
        ? `\\n\\s*${num + 1}\\.`
        : `(?:\\n\\s*Text\\s*\\d|\\n\\s*Section|$)`
    const re = new RegExp(
      `\\n\\s*${num}\\.\\s*([\\s\\S]*?)(?=${next})`,
      'i',
    )
    const m = body.match(re)
    if (!m) continue

    let chunk = m[1].replace(/\n+/g, '\n').trim()
    // [A] xxx 或单独一行 A. / A)
    const optIdx = chunk.search(/(?:\[([A-D])\]|([A-D])[\.\)])\s+\S/)
    if (optIdx < 0) continue

    let qText = cleanOcr(chunk.slice(0, optIdx).replace(/\n/g, ' '))
    // PDF 常把题干末尾空白/句号拆到下一行
    qText = qText.replace(/\s*\.\s*$/, '').trim()
    if (!/[_…]+$|________/.test(qText)) qText += ' ________'
    qText = qText.replace(/\s{2,}/g, ' ').trim()

    const options = parseOptions(chunk.slice(optIdx))
    if (qText.length > 10 && options.length === 4) {
      questions.push({ number: num, text: qText, options })
    }
  }
  return questions
}

export function parseReadingPassages(sectionText) {
  const passages = []
  // Text 1 / Text1 / form-feed + Text
  const parts = sectionText.split(/(?:\f|\n)\s*Text\s*([1-4])\s*(?:\n|$)/i)

  for (let i = 1; i < parts.length; i += 2) {
    const textNum = Number(parts[i])
    if (textNum < 1 || textNum > 4) continue

    let block = parts[i + 1] || ''
    block = block.split(/(?:\f|\n)\s*Text\s*[1-4]\s*(?:\n|$)/i)[0]

    const qStartNum = QUESTION_START[textNum]
    const qMatch = block.match(
      new RegExp(`(?:\\f|\\n)\\s*${qStartNum}\\.\\s`),
    )
    if (!qMatch) continue

    const passageBody = block.slice(0, qMatch.index)
    const questionBody = block.slice(qMatch.index)

    const lines = passageBody.replace(/\f/g, '\n').split('\n')
    // 有明显缩进段首时用版式分段，否则用句末启发式
    const indentHits = lines.filter((l) => /^ {3,}\S/.test(l)).length
    const paragraphs = linesToParagraphs(lines, {
      useIndent: indentHits >= 2,
    })
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

  // 去重：同 textNumber 取段落更多的
  const byNum = new Map()
  for (const p of passages) {
    const prev = byNum.get(p.textNumber)
    if (!prev || p.paragraphs.length > prev.paragraphs.length) {
      byNum.set(p.textNumber, p)
    }
  }
  return [...byNum.values()].sort((a, b) => a.textNumber - b.textNumber)
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
