export function isHabitDue(scheduleMask: string | null | undefined, date: Date = new Date()): boolean {
  if (!scheduleMask) return true;
  if (scheduleMask.length !== 7) return true;
  const day = (date.getDay() + 6) % 7; // JS Sunday=0, convert to Monday=0
  return scheduleMask.charAt(day) !== "-";
}
