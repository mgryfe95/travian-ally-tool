/** Nächster Lauf für einfache stündliche Zeitpläne (`M * * * *`); sonst undefined. */
export function nextHourlyRun(cron: string, now = new Date()): Date | undefined {
  const m = /^(\d{1,2}) \* \* \* \*$/.exec(cron.trim());
  if (!m) return undefined;
  const minute = Number(m[1]);
  if (minute > 59) return undefined;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(minute);
  if (next <= now) next.setHours(next.getHours() + 1);
  return next;
}
