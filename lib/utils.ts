// Pure utility functions — usable in both server (API routes) and client (components)

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(n: number): string {
  return '$' + Math.abs(Math.round(n)).toLocaleString();
}

export function generateYearMonths(year = new Date().getFullYear()): string[] {
  return Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`,
  );
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
