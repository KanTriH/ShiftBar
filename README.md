# 班表 Shift Scheduler 2.0

给需要手动排班的小店（奶茶店、餐厅、零售店）用的排班工具。

- **员工**：不注册也能用名字报班；注册后可查看已发布的班表、按周/双周/月统计工时、导出 `.ics` 到日历。
- **店长**：设置营业时间与岗位标签，查看所有人的可用时间，在时间轴上拖拽排班，区分试工/正式，按周发布。

技术栈：Vite + React + TypeScript + Tailwind v4 + Supabase（Postgres / Auth / RLS）。

## 快速体验（不需要 Supabase）

```bash
npm install
npm run dev
```

没有配置环境变量时自动进入**演示模式**：数据保存在浏览器 localStorage，登录页有一键进入店长/员工的演示账号，访客报班链接是 `/s/zhaomu01`。

## 连接 Supabase

1. 在 [supabase.com](https://supabase.com) 新建项目。
2. 打开 **SQL Editor > New query**，**按顺序**粘贴并运行：
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)：创建基础表、行级安全策略（RLS）和访客用的 RPC 函数。
   2. [`supabase/migrations/0002_locations_tasks_settings.sql`](supabase/migrations/0002_locations_tasks_settings.sql)：多门店、当日任务、店铺设置（一周起始日 / 假日地区 / PDF 样式）。
   3. [`supabase/migrations/0003_overnight_shifts.sql`](supabase/migrations/0003_overnight_shifts.sql)：支持跨午夜排班。

   已经运行过前面迁移的数据库只需要按顺序补运行后面的，不会丢数据。**升级时先运行迁移，再部署新版前端。** 需要从头重来时先运行 [`supabase/reset.sql`](supabase/reset.sql)（会清空全部数据）。
3. **Authentication > Providers > Email**：开发阶段建议关闭 "Confirm email"，否则注册后要先点邮件里的确认链接才能登录。
4. **Project Settings > API** 复制 Project URL 和 anon public key：

   ```bash
   cp .env.example .env.local
   # 填入 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
   ```
5. 重启 `npm run dev`，登录页上的"演示模式"提示消失即表示已连接。

## 数据与权限模型

| 表 | 说明 |
|---|---|
| `shops` | 店铺，`hours` 为 7 天营业时间（分钟数），`code` 为员工报班用的店铺码；`week_start`（一周起始日）、`region`（法定假日地区）、`pdf_style`（默认 PDF 样式）为设置项 |
| `locations` | 门店。同一批员工可在多家门店排班；新建店铺时自动创建第一家 |
| `positions` | 岗位标签（名称 + 颜色），店长自定义 |
| `members` | 员工，`status` 为 `trial` / `regular`，`user_id` 为空表示尚未注册的访客 |
| `availability` | 员工报的可用时间（按日期，分钟为单位），`location_ids` 为员工能去的门店，空 = 任意门店 |
| `shifts` | 店长排的班次，属于某家门店 |
| `daily_tasks` | 当日任务（每家门店每天一条文本），发布后员工可见 |
| `publications` | 某店某周（周一日期）是否已发布 |

- 店长（`shops.owner_id`）可读写自己店铺的全部数据。
- 员工只能读自己的成员记录；**只有已发布周**的、属于自己的班次才可读。
- 访客不直接访问表，只能通过 RPC：`get_shop_public`、`get_guest_availability`、`submit_availability`。
  已被注册员工认领的名字，访客不能覆盖也读不到（`name_claimed`）。
- 员工注册后用 `claim_member(店铺码, 名字)` 认领同名的访客记录，之前报的班自动归到账号下。

## 功能说明

- **多门店**：设置里添加门店后，排班页出现门店切换，员工报班时可多选能去的门店。同一个人在其他门店的班次会以灰色斜纹显示，时间冲突会告警。只有一家门店时这些选项都不显示。
- **当日任务**：排班页每天下方可以写这一天上班的人要做的事，员工页和导出的 PDF 里都会显示。
- **一周起始日**：设置 > 排班偏好，可选周一或周日。切换后已发布的周会重置为草稿，需要重新发布。
- **法定假日**：设置 > 排班偏好选择地区（联邦通用 / ON / BC / AB / SK / QC），假日会在排班页、报班表、员工班表和 PDF 里提醒。名称按日期规则本地计算，**仅供参考**，遇周末顺延和假日工资规定请以官方公告为准。
- **PDF 导出**：排班页「导出 PDF」，可选表格或时间条样式、按门店或全部门店输出；默认样式在设置里选。

## 多语言（中文 / English）

每个页面的顶栏都有语言切换按钮，选择会记在浏览器里；第一次访问时跟随浏览器语言（中文浏览器显示中文，其他显示英文）。

实现很轻量，没有引入第三方库：代码里用中文原文当 key，写作 `t('保存')`、`t('已填 {n} 天', { n: 3 })`，英文词典在 [`src/i18n/en.ts`](src/i18n/en.ts)。**新增界面文案时，在代码里写 `t('中文')`，再到 `en.ts` 补一条英文**；漏了的话英文界面会退回显示中文，不会报错。日期（`9月28日` / `Sep 28`）、星期、法定假日名称、PDF 里的标题和表头也跟随语言。

店长录入的内容（店名、员工名、岗位名、门店名、当日任务）按原样显示，不会被翻译。

## 跨午夜排班

营业到午夜以后的店（餐厅、酒吧、奶茶店晚班）可以把关门时间设到次日凌晨：设置 > 店铺 > 营业时间里，关门时间直接填 `01:00`，系统发现它早于开门时间，就自动当作次日（旁边会出现「次日」标记）。排班和报班同理：开始 17:45、结束填 `01:00`，就是跨午夜的班次。

班次属于它**开始的那一天**，工时、发布、PDF 都按这一天计算；时间轴上用一条竖线标出午夜；导出日历时结束时间会落到次日的日期上。一个班次最长 24 小时，营业时间最晚可到次日 24:00。

## 已知限制

- 访客报班只靠名字识别（和不登录的表单一样），同店重名的访客会写到同一条记录里。
- 跨午夜的班次只显示在它开始的那一天；同一个人前一晚的班延续到次日凌晨时，次日的排班页不会显示这一段，也不会检查和次日清晨班次的冲突。
- 排班时间轴使用鼠标/触控笔拖拽，触屏手机上建议只用于查看。
- 界面文案目前为简体中文，未做多语言。

## 部署到公网（让其他设备也能打开）

`localhost:5173` 只在你自己的电脑上有效。要让手机、其他电脑、员工访问，需要部署前端（Supabase 已经在云端，不用再部署）。以 Vercel 为例，Netlify / Cloudflare Pages 同理：

1. 把代码推到 GitHub，在 [vercel.com](https://vercel.com) 用 GitHub 登录，**Add New > Project** 选择这个仓库。
2. 框架选 Vite（会自动识别），构建命令 `npm run build`，输出目录 `dist`。
3. 在 **Environment Variables** 里添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（值和 `.env.local` 一样）。**漏填的话线上会变成演示模式。** 环境变量在构建时写入，改了之后要重新部署。
4. 部署完成后得到类似 `https://xxx.vercel.app` 的地址。回到 Supabase：**Authentication > URL Configuration**，把 **Site URL** 改成这个地址（并把它加入 Redirect URLs），否则注册确认邮件里的链接还会指向 localhost。
5. 之后员工用的报班链接就是 `https://xxx.vercel.app/s/店铺码`（"设置"页复制的链接会自动用当前域名）。

`vercel.json` 和 `public/_redirects` 让 `/manager`、`/s/xxx` 这类前端路由刷新时不会 404。

只是想在同一个 Wi-Fi 下临时用手机看一眼：运行 `npm run dev -- --host`，用终端里显示的 `Network` 地址（形如 `http://192.168.x.x:5173`）打开即可。
