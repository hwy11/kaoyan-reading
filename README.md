# 考研英语阅读

左英右中对照，单击查词，双击标记生词，中文可隐藏。

## 启动

```bash
cd ~/Desktop/kaoyan-reading
npm install
npm run dev
```

打开 http://localhost:5173

## 数据说明

阅读原文来自考场版 PDF（[Fantasia1999/kaoyanzhenti](https://github.com/Fantasia1999/kaoyanzhenti)），按**真实段落**切分，不是按句子硬切。目前收录 **2011–2025 英语二** 全部阅读 Part A。

## 批量导入 / 更新

```bash
# 从 scripts/pdfs/ 下的 PDF 重新提取 + 翻译（推荐）
npm run import:pdf

# 只提取英文和题目，不翻译
npm run import:pdf:en

# 指定年份
node scripts/import-from-pdf.mjs 2011 2015 2021
```

PDF 放到 `scripts/pdfs/{年}年考研英语二真题.pdf`。个别年份（如 2021）PDF 扫描质量差时，脚本会自动回退到网页源。

## 查词

`npm run dev` 同时启动网页 + ECDICT 本地词典。线上 Vercel 使用 `/api/dict` 轻量查词。

## 部署

```bash
npx vercel --prod --scope hwy11s-projects
```

生产地址：https://kaoyan-reading.vercel.app
