import { NavLink } from 'react-router-dom'
import { Field, Segmented, Select, cn, useToast } from '../../components/ui'
import { useManager } from './ManagerLayout'
import { api } from '../../data'
import { errMsg } from '../../lib/errors'
import { REGIONS, regionLabel } from '../../lib/holidays'
import { translate as t } from '../../i18n/core'
import type { ShopPatch } from '../../data/api'
import type { PdfStyle, WeekStartDay } from '../../lib/types'

/** 设置页顶部的子页面切换 */
export function SettingsTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn('press flex h-8 items-center rounded-control px-3 text-[13px] font-medium', isActive ? 'bg-accent-soft text-accent' : 'text-mute hover:bg-sunken hover:text-ink')
  return (
    <div className="mb-8">
      <h1 className="text-xl font-semibold tracking-tight">{t('设置')}</h1>
      <nav className="mt-4 flex gap-1" aria-label={t('设置分类')}>
        <NavLink to="/manager/settings" end className={tab}>{t('店铺')}</NavLink>
        <NavLink to="/manager/settings/preferences" className={tab}>{t('排班偏好')}</NavLink>
        <NavLink to="/manager/settings/account" className={tab}>{t('账号')}</NavLink>
      </nav>
    </div>
  )
}

export default function ScheduleSettings() {
  const { shop, setShop } = useManager()
  const toast = useToast()

  const save = async (patch: ShopPatch, ok?: string) => {
    try { await api.updateShop(shop.id, patch); setShop({ ...shop, ...patch }); if (ok) toast(ok) } catch (e) { toast(errMsg(e)) }
  }
  const changeWeekStart = (v: string) => {
    const next = Number(v) as WeekStartDay
    if (next === shop.week_start) return
    if (!window.confirm(t('切换一周的起始日后，已经发布的周会变成未发布，需要重新发布。确定切换吗？'))) return
    save({ week_start: next }, t('已切换，请到排班页重新发布需要员工看到的周'))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <SettingsTabs />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('一周从哪天开始')}</h2>
          <p className="mt-1 text-sm text-mute">{t('影响排班页、报班表、员工班表和导出 PDF 里每一周的起止。')}</p>
        </div>
        <div>
          <Segmented value={String(shop.week_start)} onChange={changeWeekStart} options={[{ value: '1', label: t('周一开始') }, { value: '0', label: t('周日开始') }]} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('法定假日提醒')}</h2>
          <p className="mt-1 text-sm text-mute">{t('选择你的店所在地区，遇到法定假日时，排班页、报班表、员工班表和 PDF 里会标出假日名称。')}</p>
        </div>
        <Field label={t('地区')} hint={t('假日提醒仅供参考，遇周末顺延、假日工资等规定请以所在省份官方公告为准。')}>
          <Select value={shop.region} onChange={(e) => save({ region: e.target.value })}>
            {REGIONS.map((r) => <option key={r.value} value={r.value}>{regionLabel(r)}</option>)}
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('导出 PDF 的默认样式')}</h2>
          <p className="mt-1 text-sm text-mute">{t('导出时也可以临时切换，这里只决定默认选哪一种。')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { v: 'table', title: t('表格'), desc: t('每天一张表：序号、姓名、上下班时间、岗位。适合打印张贴。') },
            { v: 'timeline', title: t('时间条'), desc: t('每人一行，用彩色横条显示一天的上班时段，并统计每天总工时。') },
          ] as { v: PdfStyle; title: string; desc: string }[]).map((o) => (
            <button key={o.v} onClick={() => save({ pdf_style: o.v })} aria-pressed={shop.pdf_style === o.v}
              className={cn('press rounded-panel border p-4 text-left', shop.pdf_style === o.v ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken')}>
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="mt-1 text-xs text-mute">{o.desc}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
