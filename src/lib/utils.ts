export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export function getYearMonth(date: string): string {
  return date.substring(0, 7); // YYYY-MM
}

export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${parseInt(month)}월`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function parseFlexibleDate(dateStr: string): string | null {
  // Handle formats: YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD~MM.DD
  const cleaned = dateStr.trim().split('~')[0].split(' ')[0];
  const match = cleaned.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
