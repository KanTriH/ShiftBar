import { translate } from '../i18n/core'

/** 报错关键字 -> 中文提示（显示时再按语言翻译）。导出给词典完整性测试用 */
export const ERROR_MESSAGES: Record<string, string> = {
  shop_not_found: '找不到这家店铺，请检查店铺码',
  name_required: '请填写你的名字',
  name_claimed: '这个名字已被注册员工使用，请登录后填写，或换一个名字',
  forbidden: '你没有这个操作的权限，请联系店长',
  only_registered: '只有已经注册账号的员工才能设为管理员',
  'row-level security': '你没有这个操作的权限，请联系店长',
  shifts_no_overlap: '这个人在这个时间已经有班次了（可能是另一位管理员刚排的），已为你刷新',
  'exclusion constraint': '这个人在这个时间已经有班次了（可能是另一位管理员刚排的），已为你刷新',
  shift_conflict: '这个班次刚被别人改过或删除了，已为你刷新',
  claim_disabled: '这家店铺没有开启店铺码绑定，请直接用店长发的报班链接报班',
  not_authenticated: '请先登录',
  CONFIRM_EMAIL: '注册成功，请到邮箱点击确认链接后再登录',
  'Invalid login credentials': '邮箱或密码不正确',
  'User already registered': '该邮箱已注册，请直接登录',
  'Email not confirmed': '邮箱尚未确认，请先点击邮件中的确认链接',
  'New password should be different': '新密码不能和旧密码相同',
  'at least 6 characters': '密码至少 6 位',
  'Auth session missing': '重置链接已失效，请重新申请',
  'rate limit': '操作太频繁，请过几分钟再试',
  'For security purposes': '操作太频繁，请过几分钟再试',
}
export function errMsg(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e)
  for (const k of Object.keys(ERROR_MESSAGES)) if (raw.includes(k)) return translate(ERROR_MESSAGES[k])
  return translate(raw) || translate('出错了，请重试')
}
