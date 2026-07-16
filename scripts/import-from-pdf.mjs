#!/usr/bin/env node
/**
 * 从 PDF 真题批量导入 2011–2025 英语二阅读
 *
 *   node scripts/import-from-pdf.mjs
 *   node scripts/import-from-pdf.mjs 2011 2015
 *   node scripts/import-from-pdf.mjs --no-translate
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import {
  extractReadingSection,
  parseReadingPassages,
  buildYearGroup,
  fullwidthToHalf,
} from './lib/parse-pdf.mjs'
import { translatePassages } from './lib/translate.mjs'

/** PDF 扫不出来时的网页备用源 */
const WEB_FALLBACK = {
  2021: 'https://www.educity.cn/kyyy/5254438.html',
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PDF_DIR = path.join(__dirname, 'pdfs')
const OUT_DIR = path.join(ROOT, 'src/data/years')

const args = process.argv.slice(2)
const noTranslate = args.includes('--no-translate')
const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number)

function pdfPath(year) {
  return path.join(PDF_DIR, `${year}年考研英语二真题.pdf`)
}

function extractPdfText(year) {
  const pdf = pdfPath(year)
  const out = path.join(__dirname, 'raw-text', `${year}.txt`)
  // -layout 保留缩进，便于按段首缩进还原段落
  try {
    execFileSync('pdftotext', ['-layout', pdf, out], { stdio: 'pipe' })
  } catch {
    execFileSync('pdftotext', [pdf, out], { stdio: 'pipe' })
  }
  return out
}

async function fetchWebText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, iframe').remove()
  $('br').replaceWith('\n')
  $('p, div, h1, h2, h3, li').each((_, el) => {
    $(el).append('\n\n')
  })
  let text = $('body').text()
  text = text.replace(/(Text\s*[1-4])\s*/gi, '\n\n$1\n\n')
  text = text.replace(/\b(2[1-9]|3[0-6])\.\s*/g, '\n\n$1. ')
  text = text.replace(/\s*\[([A-D])\]\s*/g, '\n[$1] ')
  return text.replace(/\n{3,}/g, '\n\n')
}

async function importYear(year) {
  const pdf = pdfPath(year)
  let section = null

  try {
    await fs.access(pdf)
    console.log(`\n[${year}] 提取 PDF…`)
    const txtPath = extractPdfText(year)
    let fullText = fullwidthToHalf(await fs.readFile(txtPath, 'utf-8'))
    section = extractReadingSection(fullText)
    if (!section) {
      console.warn(`[${year}] layout 未找到阅读区，尝试 raw…`)
      execFileSync('pdftotext', [pdf, txtPath], { stdio: 'pipe' })
      fullText = fullwidthToHalf(await fs.readFile(txtPath, 'utf-8'))
      section = extractReadingSection(fullText)
    }
  } catch {
    console.warn(`[${year}] 缺少可用 PDF`)
  }

  async function tryWeb() {
    if (!WEB_FALLBACK[year]) return null
    console.log(`[${year}] 改用网页源…`)
    try {
      const webText = await fetchWebText(WEB_FALLBACK[year])
      await fs.writeFile(
        path.join(__dirname, 'raw-text', `${year}-web.txt`),
        webText,
        'utf-8',
      )
      return extractReadingSection(webText)
    } catch (e) {
      console.warn(`[${year}] 网页源失败:`, e.message)
      return null
    }
  }

  if (!section) {
    section = await tryWeb()
  }
  if (!section) {
    console.warn(`[${year}] 未找到 Reading Comprehension`)
    return false
  }

  let passages = parseReadingPassages(section)
  const summary = (ps) =>
    ps
      .map((p) => `T${p.textNumber}:${p.paragraphs.length}p/${p.questions.length}q`)
      .join(' ')
  console.log(`[${year}] ${summary(passages)}`)

  const okCount = (ps) =>
    ps.filter(
      (p) =>
        p.paragraphs.length >= 2 &&
        p.paragraphs.reduce((n, x) => n + x.en.length, 0) > 800,
    ).length

  // PDF 解析质量不够时，再试网页
  if (okCount(passages) < 3) {
    const webSection = await tryWeb()
    if (webSection) {
      const webPassages = parseReadingPassages(webSection)
      console.log(`[${year}] 网页解析 ${summary(webPassages)}`)
      if (okCount(webPassages) > okCount(passages)) {
        passages = webPassages
      }
    }
  }

  if (okCount(passages) < 3) {
    console.warn(`[${year}] 质量不足（合格 ${okCount(passages)}/4），跳过写入`)
    return false
  }

  if (!noTranslate) {
    console.log(`[${year}] 翻译中…`)
    await translatePassages(passages, (done, total, title) => {
      process.stdout.write(`\r[${year}] 翻译 ${done}/${total} (${title})   `)
    })
    console.log()
  }

  const group = buildYearGroup(year, passages)
  const dir = path.join(OUT_DIR, String(year))
  await fs.mkdir(dir, { recursive: true })
  const outPath = path.join(dir, 'english-2.json')
  await fs.writeFile(outPath, JSON.stringify(group, null, 2), 'utf-8')
  console.log(`[${year}] → ${path.relative(ROOT, outPath)}`)
  return true
}

async function main() {
  await fs.mkdir(path.join(__dirname, 'raw-text'), { recursive: true })

  const target = years.length
    ? years
    : Array.from({ length: 15 }, (_, i) => 2011 + i)

  let ok = 0
  let fail = 0
  for (const year of target) {
    try {
      ;(await importYear(year)) ? ok++ : fail++
    } catch (e) {
      console.error(`[${year}] 失败:`, e.message)
      fail++
    }
  }
  console.log(`\n完成：成功 ${ok}，失败/跳过 ${fail}`)
}

main()
