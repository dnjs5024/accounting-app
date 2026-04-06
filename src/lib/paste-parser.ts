export interface ParsedRow {
  date?: string;
  amount?: string;
  description?: string;
  category?: string;
}

export type ColumnType = 'date' | 'amount' | 'description' | 'category';

/**
 * 붙여넣기 텍스트를 파싱하여 거래 데이터 배열로 변환
 *
 * 자동 감지:
 * - 전체 행: 날짜 + 금액 + 설명 + 카테고리
 * - 금액만: ₩40,000 여러 줄
 * - 설명+카테고리: 공동체 모임 지원비    공동체모임지원비
 * - 단일 컬럼: 한 줄에 하나씩
 *
 * sourceColumn: 붙여넣기가 발생한 컬럼 (힌트)
 */
export function parsePastedText(text: string, sourceColumn?: ColumnType): ParsedRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  // 1줄이면 멀티라인 붙여넣기 아님
  if (lines.length === 1 && !lines[0].includes('\t')) return [];

  // 먼저 전체 행 파싱 시도 (날짜가 포함된 경우)
  const fullParsed = lines.map((l) => parseFullLine(l.trim())).filter(Boolean) as ParsedRow[];
  if (fullParsed.length === lines.length && fullParsed.every((r) => r.date && r.amount)) {
    return fullParsed;
  }

  // 각 줄의 내용을 분석해서 어떤 데이터인지 판단
  const detected = detectColumnTypes(lines, sourceColumn);
  return detected;
}

/** 전체 행 파싱 (날짜 + 금액 + 설명 + 카테고리) */
function parseFullLine(line: string): ParsedRow | null {
  let parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  }
  if (parts.length < 2) return null;

  // 날짜 찾기
  let dateStr: string | null = null;
  let datePartEnd = 0;
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    dateStr = parseDate(parts.slice(0, i + 1).join(' '));
    if (dateStr) { datePartEnd = i + 1; break; }
  }
  if (!dateStr) return null;

  const remaining = parts.slice(datePartEnd);
  if (remaining.length < 1) return null;

  // 금액 찾기
  let amount = '';
  let amountIdx = -1;
  for (let i = 0; i < remaining.length; i++) {
    const parsed = parseAmount(remaining[i]);
    if (parsed) { amount = parsed; amountIdx = i; break; }
  }
  if (!amount) return null;

  const afterAmount = remaining.slice(amountIdx + 1);
  let description = '';
  let category = '';

  if (afterAmount.length >= 2) {
    category = afterAmount[afterAmount.length - 1];
    description = afterAmount.slice(0, -1).join(' ');
  } else if (afterAmount.length === 1) {
    description = afterAmount[0];
  }

  return { date: dateStr, amount, description, category };
}

/** 컬럼 타입 자동 감지 후 파싱 */
function detectColumnTypes(lines: string[], sourceColumn?: ColumnType): ParsedRow[] {
  return lines.map((line) => {
    const trimmed = line.trim();

    // 탭이나 2+공백으로 분리
    let parts = trimmed.split('\t').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) {
      parts = trimmed.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
    }

    // 여러 컬럼이 있는 경우: 각 파트가 뭔지 판별
    if (parts.length >= 2) {
      return parseMultiParts(parts);
    }

    // 단일 값: sourceColumn 힌트 사용
    const single = trimmed;
    if (sourceColumn === 'amount' || isAmountLike(single)) {
      const amt = parseAmount(single);
      return amt ? { amount: amt } : { description: single };
    }
    if (sourceColumn === 'date' || isDateLike(single)) {
      const d = parseDate(single);
      return d ? { date: d } : { description: single };
    }
    if (sourceColumn === 'category') {
      return { category: single };
    }
    // 기본: 설명으로
    return { description: single };
  });
}

/** 여러 파트로 나뉜 한 줄 파싱 */
function parseMultiParts(parts: string[]): ParsedRow {
  const row: ParsedRow = {};
  const used = new Set<number>();

  // 1) 날짜 찾기
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    const combined = parts.slice(0, i + 1).join(' ');
    const d = parseDate(combined);
    if (d) {
      row.date = d;
      for (let j = 0; j <= i; j++) used.add(j);
      break;
    }
  }

  // 2) 금액 찾기
  for (let i = 0; i < parts.length; i++) {
    if (used.has(i)) continue;
    const amt = parseAmount(parts[i]);
    if (amt) {
      row.amount = amt;
      used.add(i);
      break;
    }
  }

  // 3) 남은 파트: 마지막이 카테고리, 나머지가 설명
  const remaining = parts.filter((_, i) => !used.has(i));
  if (remaining.length >= 2) {
    row.category = remaining[remaining.length - 1];
    row.description = remaining.slice(0, -1).join(' ');
  } else if (remaining.length === 1) {
    // 금액이 있으면 설명, 없으면 카테고리일 수도 → 설명으로
    row.description = remaining[0];
  }

  return row;
}

function isAmountLike(text: string): boolean {
  return /^[₩\s]*[\d,]+\s*원?$/.test(text.trim());
}

function isDateLike(text: string): boolean {
  return /\d{4}[년.\-/]/.test(text);
}

function parseDate(text: string): string | null {
  const korMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    return `${korMatch[1]}-${korMatch[2].padStart(2, '0')}-${korMatch[3].padStart(2, '0')}`;
  }
  const stdMatch = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (stdMatch) {
    return `${stdMatch[1]}-${stdMatch[2].padStart(2, '0')}-${stdMatch[3].padStart(2, '0')}`;
  }
  return null;
}

function parseAmount(text: string): string | null {
  const cleaned = text.replace(/[₩원\s]/g, '').replace(/,/g, '');
  if (/^\d+$/.test(cleaned) && parseInt(cleaned) > 0) {
    return cleaned;
  }
  return null;
}
