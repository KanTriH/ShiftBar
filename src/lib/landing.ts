import type { Role } from './types'

/**
 * 登录后"我的页面"该去哪里。以数据库里的事实为准，其次才看注册时选的身份：
 *  1. 有自己的店铺 -> 店长页
 *  2. 已经绑定了某家店的员工记录 -> 员工页
 *  3. 都没有：注册时选的是店长 -> 店长页（去创建店铺）；否则 -> 员工页（去绑定店铺）
 */
export function homeFor(opts: { hasOwnedShop: boolean; hasMembership: boolean; role: Role | null }): '/manager' | '/me' {
  if (opts.hasOwnedShop) return '/manager'
  if (opts.hasMembership) return '/me'
  return opts.role === 'manager' ? '/manager' : '/me'
}

/**
 * 店长页发现当前账号没有自己的店铺时：这到底是新店长（该看到"创建你的店铺"），
 * 还是一个已经绑定了店铺的员工走错了地方（该送回员工页）？
 *
 * 员工会走到店长页的常见路径：从 /manager 的地址进入（书签、历史记录、别人发的链接）→ 被要求登录 →
 * 登录后回到登录前想去的 /manager。这时不能让员工看到"创建你的店铺"。
 * 只要已经绑定了员工记录就送去员工页；没绑定的账号仍然可以创建店铺（比如注册时误选了"员工"的店长）。
 */
export function isStaffInWrongPlace(opts: { hasOwnedShop: boolean; hasMembership: boolean }): boolean {
  return !opts.hasOwnedShop && opts.hasMembership
}
