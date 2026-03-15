import dayjs from 'dayjs'

export function formatDate(value: string | Date, fmt = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) return ''
  return dayjs(value).format(fmt)
}
