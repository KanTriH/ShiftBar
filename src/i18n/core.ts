// 轻量 i18n：以中文原文作为 key。
//   t('保存')                      中文模式原样返回，英文模式查 en.ts 词典，找不到就退回中文
//   t('已填 {n} 天', { n: 3 })     {name} 形式的插值
// 这个文件不依赖 React，所以 lib/ 里的纯函数（日期格式化、错误信息）也能直接用 translate。
import { EN } from './en'

export type Lang = 'zh' | 'en'
const STORAGE_KEY = 'shift-lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && /^zh/i.test(navigator.language) ? 'zh' : 'en'
}

let current: Lang = detect()

export const getLang = () => current
export function setLangValue(l: Lang) {
  current = l
  try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
}

export type Params = Record<string, string | number>

export function translate(key: string, params?: Params): string {
  let s = current === 'zh' ? key : (EN[key] ?? key)
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}
