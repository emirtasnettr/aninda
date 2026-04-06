/** İstanbul takvim günü (sabit UTC+3) — günlük metrikler için */
export function startOfIstanbulDay(ref = new Date()): Date {
  const df = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const s = df.format(ref);
  return new Date(`${s}T00:00:00+03:00`);
}

export function endOfIstanbulDay(ref = new Date()): Date {
  return new Date(startOfIstanbulDay(ref).getTime() + 24 * 60 * 60 * 1000);
}
