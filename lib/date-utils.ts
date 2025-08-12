export function getPastWeekDates(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
  });
}