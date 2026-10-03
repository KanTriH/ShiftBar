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
2. 打开 **SQL Editor > New query**，粘贴并运行 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)。
   它会创建全部表、行级安全策略（RLS）和访客用的 RPC 函数。需要重来时先运行 [`supabase/reset.sql`](supabase/reset.sql)。
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
| `shops` | 店铺，`hours` 为 7 天营业时间（分钟数），`code` 为员工报班用的店铺码 |
| `positions` | 岗位标签（名称 + 颜色），店长自定义 |
| `members` | 员工，`status` 为 `trial` / `regular`，`user_id` 为空表示尚未注册的访客 |
| `availability` | 员工报的可用时间（按日期，分钟为单位） |
| `shifts` | 店长排的班次 |
| `publications` | 某店某周（周一日期）是否已发布 |

- 店长（`shops.owner_id`）可读写自己店铺的全部数据。
- 员工只能读自己的成员记录；**只有已发布周**的、属于自己的班次才可读。
- 访客不直接访问表，只能通过 RPC：`get_shop_public`、`get_guest_availability`、`submit_availability`。
  已被注册员工认领的名字，访客不能覆盖也读不到（`name_claimed`）。
- 员工注册后用 `claim_member(店铺码, 名字)` 认领同名的访客记录，之前报的班自动归到账号下。

## 已知限制

- 访客报班只靠名字识别（和不登录的表单一样），同店重名的访客会写到同一条记录里。
- 班次不能跨午夜；营业时间最晚到 24:00。
- 排班时间轴使用鼠标/触控笔拖拽，触屏手机上建议只用于查看。
- 界面文案目前为简体中文，未做多语言。
