# 上线、配置与运维指南

这份文档写给**要自己部署、维护 ShiftBar 的人**（店主自己或帮忙的开发者）。只是想用它排班的店长和员工，请看 [README](../README.md)。

目录：[上线指南](#上线指南) · [配置参考](#配置参考) · [数据与安全](#数据与安全) · [日常运维](#日常运维) · [常见问题](#常见问题) · [已知限制](#已知限制)

先决条件：一个 [Supabase](https://supabase.com) 账号（存数据、管登录）和一个能托管静态网页的服务（本文以 Vercel 为例）。想先不注册任何东西体验一下，见 [README 的"先试试看"](../README.md#先试试看不用注册)。

## 上线指南

按顺序做完 1 到 3，再逐项过一遍 [上线检查清单](#4-上线检查清单)。

### 1. 创建并配置 Supabase 项目

1. 在 [supabase.com](https://supabase.com) 新建项目，记下数据库密码（只用于直连数据库，前端用不到）。
2. 打开 **SQL Editor > New query**，把下面六个文件的内容**按顺序**粘贴并运行（每个都要运行成功再运行下一个）：

   | 顺序 | 文件 | 作用 |
   |---|---|---|
   | 1 | [`0001_init.sql`](../supabase/migrations/0001_init.sql) | 基础表、行级安全策略、访客用的 RPC 函数 |
   | 2 | [`0002_locations_tasks_settings.sql`](../supabase/migrations/0002_locations_tasks_settings.sql) | 多门店、当日任务、店铺设置（一周起始日 / 假日地区 / PDF 样式） |
   | 3 | [`0003_overnight_shifts.sql`](../supabase/migrations/0003_overnight_shifts.sql) | 支持跨午夜排班 |
   | 4 | [`0004_delete_account.sql`](../supabase/migrations/0004_delete_account.sql) | 用户自己注销账号的函数 `delete_my_account()` |
   | 5 | [`0005_shop_code_toggle.sql`](../supabase/migrations/0005_shop_code_toggle.sql) | 店长可以选择是否开启店铺码绑定（`shops.code_enabled`） |
   | 6 | [`0006_member_skills_training.sql`](../supabase/migrations/0006_member_skills_training.sql) | 员工会什么岗位（技能矩阵）和培训班次（`member_positions`、`shifts.training`） |

   [`supabase/reset.sql`](../supabase/reset.sql) 会**清空全部数据**并删除这些表和函数，只在需要从头重来时使用，**绝不要在有真实数据的库上运行**。
3. **Authentication > Providers > Email**：决定是否开启 "Confirm email"（见下面的[配置参考](#supabase-认证设置)）。
4. **Project Settings > API**：复制 **Project URL** 和 **anon public** key，下一步要用。**不要复制 `service_role` key，它能绕过全部权限，绝不能出现在前端或这个仓库里。**

### 2. 部署前端（以 Vercel 为例）

1. 把代码推到 GitHub，在 [vercel.com](https://vercel.com) 用 GitHub 登录，**Add New > Project** 选这个仓库。框架选 Vite，构建命令 `npm run build`，输出目录 `dist`（一般会自动识别）。
2. 在 **Environment Variables** 添加：

   | 变量 | 值 |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | anon public key |

   **漏填的话线上会变成演示模式**（数据只存在每个人自己的浏览器里，店长和员工之间互相看不到）。环境变量在**构建时**写入，改了之后必须重新部署。
3. 部署完成后得到类似 `https://xxx.vercel.app` 的地址。`vercel.json` 和 `public/_redirects` 已经让 `/manager`、`/s/xxx` 这类前端路由刷新时不会 404（Netlify / Cloudflare Pages 同样适用）。
4. 在 Vercel 项目的 **Settings > Deployment Protection** 里确认**没有**要求访客登录 Vercel，否则员工点开链接看到的是 Vercel 的登录页。

### 3. 告诉 Supabase 你的网址

回到 Supabase 的 **Authentication > URL Configuration**：

- **Site URL**：填部署后的地址，例如 `https://xxx.vercel.app`。
- **Redirect URLs**：加入 `https://xxx.vercel.app/reset-password`（本地开发再加 `http://localhost:5173/reset-password`）。

不做这一步，注册确认邮件和重置密码邮件里的链接会指向错误的地址，或被 Supabase 拒绝。

### 4. 上线检查清单

用一个**测试邮箱**，在线上地址上完整走一遍。不要用有真实数据的店长账号测试"注销"，它会永久删除整家店。

- [ ] 打开线上地址，登录页**没有**"演示模式"提示框（有的话说明环境变量没生效，检查后重新部署）
- [ ] 以店长注册 → 创建店铺 → 在"设置"里设置营业时间、岗位
- [ ] 复制"设置"里的报班链接，用无痕窗口打开，用一个名字报班；回到店长页的"可用时间"能看到
- [ ] 在排班页拖出一个班次 → 发布本周
- [ ] 员工注册 → 输入店铺码和同一个名字绑定 → 能看到刚发布的班次
- [ ] 员工点"导出到日历"，导入手机日历，时间正确（含跨午夜的班次）
- [ ] 店长点"导出 PDF"，两种样式都正常
- [ ] "忘记密码"：邮件能收到，点链接能设置新密码并用新密码登录
- [ ] 测试员工账号点"注销账号"，之后能用同一个邮箱重新注册
- [ ] 手机上打开员工页，布局正常
- [ ] 想清楚是否开启邮箱确认和自定义发信（见下），以及备份方案（见[日常运维](#日常运维)）

## 配置参考

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `VITE_SUPABASE_URL` | 上线必填 | Supabase 项目地址。留空 = 演示模式 |
| `VITE_SUPABASE_ANON_KEY` | 上线必填 | 公开的 anon key（可以出现在前端，保护数据的是行级安全策略）。留空 = 演示模式 |

本地开发：`cp .env.example .env.local` 后填入。`.env.local` 已在 `.gitignore` 里，不会被提交。

### Supabase 认证设置

| 设置 | 位置 | 建议 |
|---|---|---|
| Site URL / Redirect URLs | Authentication > URL Configuration | 必须配置，见上 |
| Confirm email | Authentication > Providers > Email | **关闭**：注册后立刻能用，但任何人可以用不存在的邮箱注册。**开启**：需要点邮件确认，更规范，但要保证邮件能发出去。试用阶段可以关，正式推广前建议开 |
| 发信额度 | Authentication > SMTP Settings | Supabase 自带的发信服务额度很低，注册和重置密码邮件在用户多了以后可能发不出去。正式使用请配置自己的 SMTP 服务（如 Resend、SendGrid、Postmark 等） |

## 数据与安全

### 表

| 表 | 说明 |
|---|---|
| `shops` | 店铺。`hours`：7 天营业时间（分钟数，可超过 1440 表示跨午夜）；`code`：员工报班用的店铺码；`week_start`、`region`、`pdf_style`：设置项 |
| `locations` | 门店。新建店铺时自动创建第一家 |
| `positions` | 岗位标签（名称 + 颜色） |
| `members` | 员工。`status`：`trial` / `regular`；`user_id` 为空表示还没注册的访客 |
| `availability` | 员工报的可用时间。`location_ids` 为空 = 任意门店 |
| `shifts` | 班次，属于某家门店；属于它**开始的那一天** |
| `daily_tasks` | 当日任务，每家门店每天一条 |
| `publications` | 哪一周（周起始日期）已发布 |

### 谁能做什么（行级安全 RLS）

- **店长**（`shops.owner_id`）：读写自己店铺的全部数据，别人的店铺看不到。
- **注册员工**：只能读自己的员工记录，以及属于自己、且**已发布的周**的班次和当日任务。
- **访客（未登录）**：不能直接读写任何表，只能调用这几个函数：`get_shop_public`（店名、营业时间、员工名字列表）、`get_guest_availability`、`submit_availability`。已被注册员工认领的名字，访客不能覆盖也读不到（`name_claimed`）。
- **认领**：员工注册后用 `claim_member(店铺码, 名字)` 把同名的访客记录绑到自己账号下，之前报的班自动归过来。
- **注销**：`delete_my_account()` 只能删除"当前登录的自己"（见下）。

### 密钥怎么放

- 前端只用公开的 **anon key**。真正的权限控制在数据库里，所以 anon key 出现在前端是正常的。
- **`service_role` key 永远不要放进前端、这个仓库、或任何会被构建进网页的变量里。** 本项目不需要它。注销账号这类需要高权限的操作，由数据库函数（`security definer`）完成，且函数内部只允许操作调用者自己。

### 注销账号会删除什么

要求输入自己的邮箱确认。**删除后无法恢复，没有"冷静期"。**

- **店长**：账号、名下所有店铺，以及店铺下的门店、岗位、员工记录、报班、班次、当日任务、发布记录。员工自己的账号不会被删除，但他们会看不到班表。
- **员工**：账号，以及自己的员工记录和这些记录下的报班、班次。店长不再看得到这个人，已发布班表里属于他的班次也会消失。

### 个人信息提醒

系统会保存员工的姓名、邮箱和出勤时间，这些属于个人信息。上线前请确认你的使用方式符合所在地的隐私要求（例如加拿大的 PIPEDA 及各省法规），并告知员工收集了什么、用来做什么。注销功能可以满足"删除我的数据"的请求。这不构成法律建议。

## 日常运维

### 升级到新版本

1. **先在 Supabase 的 SQL Editor 运行新增的迁移文件**（按文件编号顺序，只运行还没运行过的）。迁移都是增量的，不会删除已有数据。
2. **再合并代码**，Vercel 会自动重新部署。
3. 用上面的检查清单挑相关的几项在线上验证一下。

顺序不能反：新版前端依赖新的表或字段，迁移没跑就部署，相关页面会报错。数据库迁移**不能自动回滚**；前端出问题时可以在 Vercel 的 Deployments 里把上一个版本"Promote to Production"，目前的几个迁移都做成了向后兼容，旧前端可以继续和新数据库一起工作（以后新增的迁移也请保持这一点）。

### 备份

- Supabase 免费版**不一定包含自动备份**（以 Supabase 当前政策和你的套餐为准），付费版有每日备份。班表和报班记录是你们的运营数据，建议至少定期手动导出一份。
- 手动导出：在 Supabase 的 **Project Settings > Database** 复制连接字符串，然后运行
  ```bash
  pg_dump "你的连接字符串" --schema=public --data-only -f backup-$(date +%F).sql
  ```
  （需要安装 PostgreSQL 客户端工具。）
- 员工班表也可以随时用"导出 PDF"留档。

### 项目被暂停

Supabase 免费版的项目长时间没有访问会被暂停，暂停后网站会打不开数据。去 Supabase 控制台点 **Restore** 即可恢复，数据不会丢。每周至少有人用一次可以避免，或升级套餐。

### 监控

- 网站访问和构建：Vercel 控制台。
- 数据库、登录、邮件发送：Supabase 控制台的 Logs 和 Auth 页面。
- 代码变更是否安全：见 [开发指南](DEVELOPMENT.md#ci-与分支保护)。

## 常见问题

**线上打开后登录页有"演示模式"提示，店长和员工互相看不到数据。**
托管平台上没有设置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，或设置后没有重新部署。补上变量并重新部署。

**员工打开链接，看到的是 Vercel 的登录页。**
Vercel 的 Deployment Protection 开着。到项目 Settings > Deployment Protection 关掉 Vercel Authentication，并使用正式域名（不要用带分支名的预览地址）。

**重置密码邮件里的链接打不开，或指向 localhost。**
Supabase 的 Site URL / Redirect URLs 没配置或配错，见[上线指南第 3 步](#3-告诉-supabase-你的网址)。链接只能用一次且有时效，失效后到登录页重新申请。

**注册后收不到确认邮件。**
先看垃圾邮件文件夹。如果开启了 "Confirm email"，邮件靠 Supabase 自带的发信服务发送，额度很低，需要配置自己的 SMTP。

**员工看不到班表。**
依次检查：店长是否已经点了"发布本周"；员工是否已经用店铺码和名字绑定（没绑定时员工页显示的是"绑定你的店铺"）；店长是否修改过"一周从哪天开始"（修改会让已发布的周变回草稿，需要重新发布）。

**提示"这个名字已被注册员工使用"。**
这个名字已经有人注册并认领了。本人请登录后再填；如果是另一个同名的人，请换一个名字（例如加上姓氏或数字）。

**保存跨午夜的班次、或点"注销账号"时报错。**
通常是对应的迁移没有运行：跨午夜需要 `0003`，注销需要 `0004`，设置里的"店铺码"开关需要 `0005`，员工页的岗位技能和培训标记需要 `0006`。按顺序补运行即可。

**提示 `Could not find the 'training' column of 'shifts' in the schema cache`。**
还没有运行迁移 `0006`（或运行后接口层还没刷新）。在 SQL Editor 里运行 `0006_member_skills_training.sql`；已经运行过的话，再执行一次 `notify pgrst, 'reload schema';`。

**报错 `new row violates row-level security policy`。**
操作被权限规则拒绝了：没有登录，或者登录的账号不是这家店的店长。

**手机上拖不动班次。**
店长端的拖拽排班是为鼠标 / 触控笔设计的，手机上建议只用来查看。员工端在手机上完全可用。

**CI 显示红叉。**
在 GitHub 仓库的 Actions 页点进失败的运行，看是类型检查、测试还是构建这一步失败，日志里有具体的文件和行号。

## 已知限制

这些是已经知道、暂时没有处理的地方，上线前请评估是否影响你们：

- **访客只靠名字识别**（和不登录的表单一样）：同一家店里重名的访客会写到同一条记录里；任何拿到报班链接的人都能看到员工名字列表。链接不要发到公开的群里。
- **一家店只有一个管理账号**（创建店铺的人），没有副店长 / 组长一起排班的功能。
- **没有通知**：班表发布后不会自动提醒员工，需要店长自己通知。
- **跨午夜的班次只显示在开始的那一天**：次日的排班页不会显示前一晚延续过来的那一段，也不会检查它和次日清晨班次的冲突。
- **店长端不适合触屏**：拖拽排班依赖鼠标或触控笔。
- **法定假日提醒**只覆盖联邦通用、ON、BC、AB、SK、QC，按日期规则本地计算，**仅供参考**，遇周末顺延和假日工资规定请以官方公告为准。
- **注销没有冷静期**，删除后无法恢复。
- **数据库权限规则没有自动化测试**（只手工验证过），也没有浏览器端到端测试，拖拽排班没有自动化覆盖。
