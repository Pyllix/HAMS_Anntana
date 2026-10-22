export function employeeIdPrefix(now = new Date()): string {
  const thaiYear = String((now.getFullYear() + 543) % 100).padStart(2, '0');
  return `GOV-${thaiYear}`;
}

export function buildNextEmployeeId(
  latestEmployeeId: string | null | undefined,
  now = new Date(),
): string {
  const prefix = employeeIdPrefix(now);

  let nextSequence = 1;
  if (latestEmployeeId?.startsWith(prefix)) {
    const parsed = Number.parseInt(latestEmployeeId.slice(prefix.length), 10);
    if (!Number.isNaN(parsed)) nextSequence = parsed + 1;
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}
