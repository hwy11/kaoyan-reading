# 考研英语阅读

左英右中对照，点击单词自动查 ECDICT 释义，中文可隐藏。

## 启动

```bash
cd ~/Desktop/kaoyan-reading
npm install
npm run dev
```

打开 http://localhost:5173

## 批量导入年份（2011–2025）

阅读数据按年存放在 `src/data/years/{年份}/english-2.json`。新增或更新某年：

```bash
# 导入全部年份（抓取真题 + 机翻中文，约 15–30 分钟）
npm run import:years

# 只导入指定年
node scripts/import-years.mjs 2014 2015

# 只抓英文和题目，不翻译（快）
npm run import:years:en
```

数据来源 URL 配置在 `scripts/manifest.json`。解析逻辑在 `scripts/lib/parse-reading.mjs`，以后要改抓取规则只动这里。

2013 年是手搓校对版（质量更好），其余年份由导入脚本自动生成。

## 部署（Vercel）

```bash
npm run build
npx vercel --prod
```

线上查词走 `/api/dict`（Free Dictionary + 机翻），本地 `npm run dev` 仍用 ECDICT 全量词典。

## 查词

`npm run dev` 会同时启动网页 + ECDICT 本地词典（约 77 万词）。查过的词缓存在浏览器 localStorage。

## 目录结构

```
src/data/years/
  2011/english-2.json
  2012/english-2.json
  ...
scripts/
  manifest.json      # 各年真题网页地址
  import-years.mjs   # 批量导入入口
```
