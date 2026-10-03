const MAP: Record<string, string> = {
  shop_not_found: '找不到这家店铺，请检查店铺码',
  name_required: '请填写你的名字',
  name_claimed: '这个名字已被注册员工使用，请登录后填写，或换一个名字',
  not_authenticated: '请先登录',
  CONFIRM_EMAIL: '注册成功，请到邮箱点击确认链接后再登录',
  'Invalid login credentials': '邮箱或密码不正确',
  'User already registered': '该邮箱已注册，请直接登录',
  'Email not confirmed': '邮箱尚未确认，请先点击邮件中的确认链接',
}
export function errMsg(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e)
  for (const k of Object.keys(MAP)) if (raw.includes(k)) return MAP[k]
  return raw || '出错了，请重试'
}
