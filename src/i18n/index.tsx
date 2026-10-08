import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Translate } from '@phosphor-icons/react'
import { getLang, setLangValue, translate } from './core'
import type { Lang } from './core'

export { translate } from './core'
export type { Lang } from './core'

interface I18nState { lang: Lang; setLang: (l: Lang) => void; t: typeof translate }
const Ctx = createContext<I18nState>({ lang: getLang(), setLang: () => {}, t: translate })
export const useI18n = () => useContext(Ctx)
export const useT = () => useContext(Ctx).t

/**
 * 切换语言时 lang 变化，Provider 重新渲染；
 * 需要整棵页面树重新渲染的地方用 useI18n().lang 作为 key（见 App.tsx）。
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang())
  const setLang = useCallback((l: Lang) => { setLangValue(l); setLangState(l) }, [])
  useEffect(() => {
    setLangValue(lang)
    document.title = translate('ShiftBar - 小店排班工具')
  }, [lang])
  return <Ctx.Provider value={{ lang, setLang, t: translate }}>{children}</Ctx.Provider>
}

/** 顶栏上的语言切换按钮：显示"另一种"语言，一点就切 */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const next: Lang = lang === 'zh' ? 'en' : 'zh'
  return (
    <button
      onClick={() => setLang(next)}
      aria-label={lang === 'zh' ? 'Switch to English' : 'Switch to Chinese'}
      className={`press inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-medium text-mute hover:bg-sunken hover:text-ink ${className ?? ''}`}
    >
      <Translate size={16} />
      {lang === 'zh' ? 'English' : '中文'}
    </button>
  )
}
