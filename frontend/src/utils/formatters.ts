/** Форматирование суммы в короткий вид: 1.2 трлн / 1.2 млрд / 340 млн */
export function fmtTenge(amount: number): string {
  if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(1)} трлн`;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} млрд`;
  if (amount >= 1_000_000) {
    const mln = Math.round(amount / 1_000_000);
    // 1000 млн → 1 млрд
    if (mln >= 1000) return `${(amount / 1_000_000_000).toFixed(1)} млрд`;
    return `${mln} млн`;
  }
  return amount.toLocaleString('ru-RU');
}

/** Полное форматирование суммы: 1234567 → "1 234 567" */
export function fmtAmount(amount: number): string {
  return amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

/** Форматирование даты: ISO → DD.MM.YYYY */
export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
