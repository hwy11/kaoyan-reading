#!/usr/bin/env node
/** 把现有 TS 手搓数据导出为 JSON（2013 质量更好） */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { year2013English2 } from '../src/data/years/2013/english-2/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/data/years/2013/english-2.json')
await fs.mkdir(path.dirname(out), { recursive: true })
await fs.writeFile(out, JSON.stringify(year2013English2, null, 2), 'utf-8')
console.log('exported', out)
