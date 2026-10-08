import { fromISO, pad } from './time'

export interface IcsEvent { id: string; day: string; start: number; end: number; title: string; note?: string }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
/** min 可以超过 1440（跨午夜）：超出的整天要落到后一天的日期上 */
function stamp(day: string, min: number) {
  const d = fromISO(day)
  d.setDate(d.getDate() + Math.floor(min / 1440))
  const m = min % 1440
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`
}

/** 生成 .ics（浮动本地时间，导入 Google / Apple / Outlook 日历后按本机时区显示） */
export function buildIcs(events: IcsEvent[], calName: string) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shift Scheduler//ZH', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(calName)}`]
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@shift-scheduler`, `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.day, e.start)}`, `DTEND:${stamp(e.day, e.end)}`,
      `SUMMARY:${esc(e.title)}`)
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadFile(name: string, content: string, mime = 'text/calendar;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
