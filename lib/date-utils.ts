export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatISODateString(isoDate: string, locale = "en-US"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error('Expected date in "YYYY-MM-DD" format');
  const [, y, mo, d] = m;

  // Use UTC to avoid timezone shifts
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}