#!/usr/bin/env node
/**
 * 批量导入 2011–2025 考研英语二阅读理解
 *
 * 用法：
 *   node scripts/import-years.mjs              # 导入全部年份
 *   node scripts/import-years.mjs 2013 2014    # 只导入指定年
 *   node scripts/import-years.mjs --no-translate # 只抓英文，不翻译
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from './manifest.json' with { type: 'json' }
import {
  htmlToStructuredText,
  extractReadingSection,
  parseReadingPassages,
  buildYearGroup,
} from './lib/parse-reading.mjs'
import { translatePassages } from './lib/translate.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src/data/years')

const args = process.argv.slice(2)
const noTranslate = args.includes('--no-translate')
const years = args.filter((a) => /^\d{4}$/.test(a))

async function fetchPageText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return htmlToStructuredText(html)
}

async function importYear(year, url) {
  console.log(`\n[${year}] 抓取 ${url}`)
  const text = await fetchPageText(url)
  const section = extractReadingSection(text)
  if (!section) {
    console.warn(`[${year}] 未找到 Reading Comprehension 区域，跳过`)
    return false
  }

  const passages = parseReadingPassages(section)
  if (passages.length === 0) {
    console.warn(`[${year}] 未解析到阅读篇章，跳过`)
    return false
  }

  console.log(
    `[${year}] 解析到 ${passages.length} 篇，` +
      passages.map((p) => `${p.paragraphs.length}段`).join(' / '),
  )

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
  console.log(`[${year}] 已写入 ${path.relative(ROOT, outPath)}`)
  return true
}

async function main() {
  const targetYears = years.length
    ? years.map(Number)
    : Object.keys(manifest).map(Number).sort()

  let ok = 0
  let fail = 0

  for (const year of targetYears) {
    const url = manifest[String(year)]
    if (!url) {
      console.warn(`[${year}] manifest 中无 URL，跳过`)
      fail++
      continue
    }
    try {
      const success = await importYear(year, url)
      success ? ok++ : fail++
    } catch (err) {
      console.error(`[${year}] 失败:`, err.message)
      fail++
    }
  }

  console.log(`\n完成：成功 ${ok} 年，失败/跳过 ${fail} 年`)
  if (ok > 0) {
    console.log('接下来运行 npm run dev 即可在首页看到新年份。')
  }
}

main()
