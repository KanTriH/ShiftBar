# 开发指南

这份文档写给**想读代码、改代码、贡献代码的人**。部署和运维请看 [DEPLOYMENT.md](DEPLOYMENT.md)，产品介绍请看 [README](../README.md)。

目录：[架构](#架构) · [本地运行](#本地运行不需要任何账号) · [开发](#开发)

## 架构

| 部分 | 技术 |
|---|---|
| 前端 | Vite 8 · React 19 · TypeScript · Tailwind CSS v4 · React Router · Phosphor 图标 |
| 后端 | [Supabase](https://supabase.com)：Auth（登录）· Postgres（数据）· 行级安全策略 RLS（权限）· RPC 函数（访客入口、注销账号） |
| 测试 / CI | Vitest · GitHub Actions |
| 托管 | 任意静态托管（Vercel / Netlify / Cloudflare Pages）；仓库已带 Vercel 的路由配置 |

```
浏览器（React 单页应用，托管在 Vercel）
   │  supabase-js（只用公开的 anon key）
   ▼
Supabase
 ├─ Auth      注册 / 登录 / 重置密码邮件
 ├─ Postgres  shops · locations · positions · members · availability · shifts · daily_tasks · publications
 │            每张表都开了行级安全：谁能读、谁能写，由数据库自己强制执行
 └─ RPC 函数  访客报班 · 员工认领名字 · 注销账号（security definer，只能操作"自己"）
```

没有自己的服务器，没有 API 层：权限全靠数据库的行级安全，前端拿到的只是一把公开的 anon key。

**演示模式**：没配置 Supabase 密钥时，前端自动换成一个行为一致的本地数据层（`src/data/demoApi.ts`，数据存在浏览器 localStorage），所以不用任何账号就能完整体验，测试也基于它。`src/data/index.ts` 根据环境变量选择用哪一个。

## 本地运行（不需要任何账号）

需要 Node.js **22.12 或更高版本**。

```bash
git clone https://github.com/KanTriH/shift-scheduler.git
cd shift-scheduler
npm install
npm run dev
```

打开 http://localhost:5173 。没有配置环境变量时自动进入**演示模式**，登录页有一键进入"店长"和"员工林晓"的按钮；员工报班链接是 `/s/zhaomu01`。演示数据只保存在你自己的浏览器里。

## 开发

### 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # 类型检查 + 生产构建
npm run preview      # 本地预览构建结果
npm run typecheck    # 只做类型检查
npm test             # 运行全部测试（Vitest）
npm run test:watch   # 改代码时自动重跑
```

### 目录结构

```
src/
  pages/            页面：首页、登录、重置密码、访客报班、员工页
    manager/        店长端：排班、可用时间、员工、设置（店铺 / 排班偏好 / 账号）、PDF
  components/       DayTimeline（拖拽时间轴）、AvailabilityForm（报班表单）、DeleteAccountModal、ui
  data/             数据层：api.ts（接口）、supabaseApi.ts（真实后端）、demoApi.ts（演示模式）
  lib/              纯逻辑：时间与周边界、冲突判断、报班校验、假日、.ics、错误提示、类型
  i18n/             中英文：core.ts（翻译函数）、en.ts（英文词典）
  test/setup.ts     测试公共启动文件（固定语言）
public/
  brand/            ShiftBar 品牌素材原文件（logo / mark / icon / favicon，深浅两版），未做任何修改
  favicon-*.svg     网页标签页图标（浅色 / 深色，随系统切换）
docs/
  DEPLOYMENT.md     上线、配置与运维指南
  DEVELOPMENT.md    本文
  assets/           README 用的 logo（字标转成了矢量路径）
  screenshots/      README 截图（zh / en 两套）
scripts/            生成 README 的 logo 和截图的脚本
supabase/
  migrations/       数据库迁移（按编号顺序运行）
  reset.sql         清空并删除全部表和函数（危险）
.github/workflows/  CI
```

### 新增数据库改动

新建 `supabase/migrations/000N_xxx.sql`，写成**增量**的（`add column if not exists`、`create or replace function` 等），并在 PR 里写明"合并前需先运行此迁移"。同步更新 `reset.sql`，让它能清理新增的对象。新增的访客入口或高权限函数要用 `security definer` 并限制只能操作调用者自己。

### 新增界面文案（中英文）

代码里用中文原文当 key：`t('保存')`、`t('已填 {n} 天', { n: 3 })`，然后到 [`src/i18n/en.ts`](../src/i18n/en.ts) 补一条英文，占位符两边必须一致。**忘了补，测试会直接失败。** 店长录入的内容（店名、员工名、岗位名、门店名、当日任务）按原样显示，不翻译。

### 测试

目前有 130 多个测试，覆盖三类东西：

- **纯逻辑**（`src/lib/*.test.ts`）：一周从周一 / 周日开始、跨午夜时间解析与显示、报班校验、排班冲突判断、加拿大各省法定假日（含复活节、维多利亚日等浮动假日）、`.ics` 导出（跨午夜、跨年、转义）。
- **中英文词典**（`src/i18n/i18n.test.ts`）：界面里每一句中文都必须有英文，占位符一致，没有无人使用的残留词条。
- **业务规则**（`src/data/demoApi.test.ts`）：访客报班、已注册员工的名字不能被覆盖、员工认领、**发布后员工才看得到班次**、修改一周起始日会重置发布、注销账号只删自己的数据等。

写测试的注意点：应用的默认语言跟随浏览器语言，所以测试启动时统一固定为中文（`src/test/setup.ts`），需要测英文的测试自己调用 `setLangValue('en')`，不要依赖运行环境。

### CI 与分支保护

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 在每次推送到 `main` 和每个 PR 上自动运行：类型检查 → 测试 → 构建（Node 22）。建议在 GitHub 仓库 **Settings > Branches** 给 `main` 加保护规则：要求通过 PR 合并、要求状态检查 `check` 通过、禁止强制推送和删除。`main` 会被 Vercel 自动部署到线上，保护它等于保护线上网站。

### 品牌素材与 README 截图

**品牌素材**（ShiftBar）：

- `public/brand/` 里是设计稿的原文件，不要手改；网站标签页图标用的是其中的 `favicon-light.svg` / `favicon-dark.svg`（拷贝在 `public/` 下，`index.html` 里按系统深浅色切换）。
- 网页里的 Logo 是 [`src/components/ui.tsx`](../src/components/ui.tsx) 里的 `Logo` 组件：图形与 `shiftbar-mark-*.svg` 一致，颜色走 `index.css` 里的 `--logo-*` 变量（取自设计稿的深浅两套配色），所以会跟着深浅色模式切换；"ShiftBar" 字标用 Fredoka 600 字体（通过 `@fontsource/fredoka` 自带，不依赖外部网络）。
- 品牌名 "ShiftBar" 不翻译。而"班表 / Shifts"仍然是普通名词，用在 PDF 标题、日历名这类地方。

**README 用的 logo**（`docs/assets/`）：设计稿里的字标是用 Fredoka 字体写的文字，GitHub 显示 SVG 图片时不加载网页字体，字标会变样。所以用脚本把字标转成矢量路径：

```bash
pip install fonttools
python scripts/make-readme-logo.py
```

**README 截图**（`docs/screenshots/`）：界面改了、截图过期时重新生成。脚本驱动本机的 Chrome，在固定日期的演示数据上截图，中文和英文各一套：

```bash
# 终端 1：演示模式的开发服务器（环境变量留空 = 演示模式）
#   macOS / Linux：   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite --port 5180
#   Windows PowerShell：$env:VITE_SUPABASE_URL=''; $env:VITE_SUPABASE_ANON_KEY=''; npx vite --port 5180

# 终端 2
npm i --no-save playwright-core        # 只装驱动，不会写进 package.json，也不下载浏览器
node scripts/readme-screenshots.mjs
```

脚本用的是本机已有的 Chrome / Edge；找不到时设置环境变量 `CHROME_PATH`。
