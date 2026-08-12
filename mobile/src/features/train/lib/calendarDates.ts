export function getTodayDateString() {
  return toDateString(new Date());
}

export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateString: string, amount: number) {
  const date = parseDateString(dateString);
  date.setDate(date.getDate() + amount);
  return toDateString(date);
}

export function daysBetween(fromDate: string, toDate: string) {
  const from = parseDateString(fromDate);
  const to = parseDateString(toDate);

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function formatDisplayDate(dateString: string) {
  const date = parseDateString(dateString);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(dateString: string) {
  const date = parseDateString(dateString);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isPastDate(dateString: string) {
  return daysBetween(getTodayDateString(), dateString) < 0;
}

export function isFutureDate(dateString: string) {
  return daysBetween(getTodayDateString(), dateString) > 0;
}

export function hasDatePassedByHours(dateString: string, hours = 24) {
  const start = parseDateString(dateString);
  const threshold = start.getTime() + hours * 60 * 60 * 1000;
  return Date.now() >= threshold;
}

export function getMonthStart(dateString = getTodayDateString()) {
  const date = parseDateString(dateString);
  return toDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getMonthEnd(dateString = getTodayDateString()) {
  const date = parseDateString(dateString);
  return toDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}
