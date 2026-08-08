import { format, formatDistanceToNow, startOfDay, subDays } from 'date-fns'

export function todayIso() {
  return startOfDay(new Date()).toISOString()
}

export function daysAgoIso(days: number) {
  return startOfDay(subDays(new Date(), days)).toISOString()
}

export function formatDate(date: string | number | Date) {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDatetime(date: string | number | Date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function formatRelativeTime(date: string | number | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}
