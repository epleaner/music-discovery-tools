export function relativeTime(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const then = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} days ago`;

  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk} wk ago`;

  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo} mo ago`;
}
