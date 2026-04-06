export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  category: string;
  type: 'income' | 'expense';
  createdAt: string;
  source: 'manual' | 'ocr' | 'excel';
}

export interface MonthlyBudget {
  yearMonth: string; // YYYY-MM
  plans: Record<string, number>;
  initialBalance: number;
}

export interface AppSettings {
  id: number;
  categories: {
    income: string[];
    expense: string[];
  };
  claudeApiKey?: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  '신시아 후원',
  '공동체모임지원비',
  '봄 MT',
  '여름 단기 선교',
  '겨울수련회',
  '여름수련회',
  '경조사',
  '생일축하(케이크or기프티콘)',
  '청년부실 비품',
  '교역자 심방비',
  '성탄 파티',
  '수험생 위로 행사',
  '임원 LT',
  '신입생 환영회 & 송구영신 전야제',
];

export const DEFAULT_INCOME_CATEGORIES = [
  '이월금',
  '재정청구 및 2025년 예산',
  '겨울수련회 회비',
  '여름 수련회 회비',
  '단기 선교 회비',
  '단기 선교 바자회',
  '단기 선교 찬조',
  '단기 선교 보험금',
  '단기 선교 차액',
  '찬양 대회 상금',
  '카드이자',
];
