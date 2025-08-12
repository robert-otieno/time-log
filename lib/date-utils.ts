export function formatISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getPastWeekDates(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });
}
