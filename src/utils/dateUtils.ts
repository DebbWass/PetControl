import { Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNow, differenceInDays, differenceInMonths, differenceInYears, addDays } from 'date-fns';
import { he as heLocale, enUS } from 'date-fns/locale';
import i18n from '../i18n';

function getLocale() {
  return i18n.language === 'he' ? heLocale : enUS;
}

export function toDate(ts: Timestamp | Date | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts && typeof (ts as any).toDate === 'function') return (ts as Timestamp).toDate();
  return null;
}

export function formatDate(ts: Timestamp | Date | undefined | null, fmt = 'dd/MM/yyyy'): string {
  const d = toDate(ts);
  if (!d) return '';
  return format(d, fmt, { locale: getLocale() });
}

export function formatDateTime(ts: Timestamp | Date | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: getLocale() });
}

export function timeAgo(ts: Timestamp | Date | undefined | null): string {
  const d = toDate(ts);
  if (!d) return '';
  return formatDistanceToNow(d, { addSuffix: true, locale: getLocale() });
}

export function daysUntil(ts: Timestamp | Date | undefined | null): number | null {
  const d = toDate(ts);
  if (!d) return null;
  return differenceInDays(d, new Date());
}

export function formatAge(birthdate: Timestamp | Date | undefined | null): string {
  const d = toDate(birthdate);
  if (!d) return '';
  const years = differenceInYears(new Date(), d);
  if (years >= 1) {
    const isHe = i18n.language === 'he';
    return `${years} ${isHe ? 'שנים' : 'years'}`;
  }
  const months = differenceInMonths(new Date(), d);
  const isHe = i18n.language === 'he';
  return `${months} ${isHe ? 'חודשים' : 'months'}`;
}

export function addDaysToNow(days: number): Date {
  return addDays(new Date(), days);
}

export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}
