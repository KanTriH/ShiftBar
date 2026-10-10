// 重新生成 README 里的截图（docs/screenshots/zh 和 docs/screenshots/en）。界面改了、截图过期时用它。
//
// 做法：驱动本机的 Chrome，打开"演示模式"的网页，固定日期（周三，本周周一 = 2026-10-05），
// 用固定的演示数据截图；英文那套会先把演示数据换成英文名字，免得英文界面里全是中文人名。
//
// 用法（在仓库根目录，两个终端）：
//   终端 1：演示模式的开发服务器（环境变量留空 = 演示模式）
//       Windows PowerShell:  $env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_ANON_KEY=''; npx vite --port 5180
//       macOS / Linux:       VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --port 5180
//   终端 2：
//       npm i --no-save playwright-core      # 只装驱动，不下载浏览器，也不会写进 package.json
//       node scripts/readme-screenshots.mjs
//
// 可选环境变量：BASE_URL（默认 http://localhost:5180）、CHROME_PATH（Chrome / Edge 可执行文件的路径）
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')
const BASE = process.env.BASE_URL ?? 'http://localhost:5180'
const KEY = 'shift-scheduler-demo-v2' // demoApi.ts 里的 localStorage 键名

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p))
if (!executablePath) throw new Error('找不到 Chrome / Edge，请设置环境变量 CHROME_PATH')

// 英文截图用英文的演示数据
const EN_DATA = {
  shop: 'Morning Tea House',
  locations: { '中央店': 'Central', '北区店': 'North' },
  members: { '林晓': 'Lin', '周屿': 'Owen', '陈嘉禾': 'Jia', '吴桐': 'Tony', '许安然': 'Anna', '高见': 'Kai' },
  tasks: ['Floor mats (use the vacuum)\nSyrup pump\nWindows', 'Weekly inventory'],
}

const browser = await chromium.launch({ executablePath, headless: true })
let count = 0

async function newPage(lang, { width, height, scale }) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'light',
    locale: lang === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'America/Toronto',
  })
  const page = await ctx.newPage()
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00-04:00'))
  await page.goto(BASE + '/')
  await page.evaluate(([k, l]) => { localStorage.removeItem(k); localStorage.setItem('shift-lang', l) }, [KEY, lang])
  await page.goto(BASE + '/') // 重新载入，生成种子数据
  await page.waitForLoadState('networkidle')
  if (lang === 'en') {
    await page.evaluate(([k, d]) => {
      const db = JSON.parse(localStorage.getItem(k))
      db.shops[0].name = d.shop
      for (const l of db.locations) l.name = d.locations[l.name] ?? l.name
      for (const m of db.members) m.name = d.members[m.name] ?? m.name
      db.tasks.forEach((t, i) => { t.text = d.tasks[i] ?? t.text })
      localStorage.setItem(k, JSON.stringify(db))
    }, [KEY, EN_DATA])
  }
  return page
}
const login = (page, id) => page.evaluate(([k, id]) => { const db = JSON.parse(localStorage.getItem(k)); db.session = id; localStorage.setItem(k, JSON.stringify(db)) }, [KEY, id])
async function save(page, lang, name, opts = {}) {
  const dir = path.join(OUT, lang)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name + '.png')
  if (opts.locator) await opts.locator.screenshot({ path: file })
  else await page.screenshot({ path: file, fullPage: opts.fullPage ?? false, clip: opts.clip })
  count++
  console.log('已保存', path.relative(ROOT, file), (fs.statSync(file).size / 1024).toFixed(0) + ' KB')
}

for (const lang of ['zh', 'en']) {
  // 0. 首页：等排班卡片里的演示动画播到"班次被拎起、拖动中"那一帧
  let page = await newPage(lang, { width: 1440, height: 790, scale: 1.5 })
  await page.goto(BASE + '/')
  await page.waitForSelector('h1')
  await page.waitForTimeout(5600)
  await save(page, lang, 'landing', { clip: { x: 0, y: 0, width: 1440, height: 740 } })
  await page.context().close()

  // 1. 店长：按天排班（周一，含另一家门店的灰色斜纹班次）
  page = await newPage(lang, { width: 1280, height: 820, scale: 1.5 })
  await login(page, 'u-boss')
  await page.goto(BASE + '/manager')
  await page.waitForSelector('div[role=tablist][aria-label] > button')
  await page.locator('div[role=tablist][aria-label] > button').first().click()
  await page.waitForSelector('[data-shift]')
  await page.waitForTimeout(500)
  await save(page, lang, 'manager-schedule', { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 930 } })

  // 2. 店长：导出的 PDF 班表，时间条和表格两种样式
  await page.goto(BASE + '/manager/print?week=2026-10-05&style=timeline&loc=l-main')
  await page.waitForSelector('table')
  await page.waitForTimeout(500)
  await save(page, lang, 'pdf-timeline', { locator: page.locator('div.bg-white').first() })
  await page.goto(BASE + '/manager/print?week=2026-10-05&style=table&loc=l-main')
  await page.waitForSelector('table')
  await page.waitForTimeout(500)
  await save(page, lang, 'pdf-table', { clip: { x: 160, y: 80, width: 960, height: 760 } })

  // 3. 员工：我的班表 + 本周工时
  await login(page, 'u-lin')
  await page.goto(BASE + '/me')
  await page.waitForSelector('text=cashier')
  await page.waitForTimeout(500)
  await save(page, lang, 'staff-schedule', { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 640 } })
  await page.context().close()

  // 4. 访客报班（手机尺寸，不用注册）
  page = await newPage(lang, { width: 390, height: 844, scale: 2 })
  await page.goto(BASE + '/s/zhaomu01')
  await page.waitForSelector('input[list="known-names"]')
  await page.fill('input[list="known-names"]', lang === 'zh' ? '沈知微' : 'Nora')
  await page.getByRole('button', { name: lang === 'zh' ? '下一周' : 'Next week' }).click()
  await page.waitForTimeout(500)
  const allDay = page.getByRole('button', { name: lang === 'zh' ? '全天' : 'All day', exact: true })
  await allDay.nth(0).click()
  await allDay.nth(1).click()
  await allDay.nth(3).click()
  await page.getByLabel(lang === 'zh' ? '备注' : 'Note').first().fill(lang === 'zh' ? '下午有课，最好排晚班' : 'Evening shift preferred')
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  await page.waitForTimeout(300)
  await save(page, lang, 'guest-availability-mobile', { clip: { x: 0, y: 0, width: 390, height: 844 } })
  await page.context().close()
}

await browser.close()
console.log(`\n共 ${count} 张截图，已写入 ${path.relative(ROOT, OUT)}`)
