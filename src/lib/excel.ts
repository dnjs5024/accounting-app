import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

interface MonthlyData {
  yearMonth: string;
  expenses: Transaction[];
  incomes: Transaction[];
  plans: Record<string, number>;
  initialBalance: number;
}

function isIncomeCategory(cat: string): boolean {
  const incomeKeywords = ['이월금', '재정청구', '회비', '바자회', '찬조', '보험금', '차액', '상금', '이자', '캐쉬백'];
  return incomeKeywords.some((k) => cat.includes(k));
}

/** 요약 시트 생성 */
function buildSummarySheet(
  label: string,
  expenses: Transaction[],
  incomes: Transaction[],
  plans: Record<string, number>,
  initialBalance: number
): XLSX.WorkSheet {
  const expenseByCategory: Record<string, number> = {};
  expenses.forEach((tx) => {
    expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
  });
  const incomeByCategory: Record<string, number> = {};
  incomes.forEach((tx) => {
    incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
  });

  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
  const expensePlanTotal = Object.entries(plans).filter(([k]) => !isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0);
  const incomePlanTotal = Object.entries(plans).filter(([k]) => isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0);
  const endBalance = initialBalance + totalIncome - totalExpense;

  const rows: (string | number | null)[][] = [
    [null, `${label} 회계안`],
    [],
    [null, null, null, '초기 잔고', '기말 잔고'],
    [null, null, null, initialBalance, endBalance],
    [],
    [null, '지출', null, null, null, null, null, '수입'],
    [null, '계획', expensePlanTotal, null, null, null, null, '계획', incomePlanTotal],
    [null, '실제', totalExpense, null, null, null, null, '실제', totalIncome],
    [],
    [null, '지출', null, null, null, null, null, '수입'],
    [null, null, null, '계획', '실제', '차이', null, null, null, '계획', '실제', '차이'],
    [null, '합계', null, expensePlanTotal, totalExpense, expensePlanTotal - totalExpense, null, '합계', null, incomePlanTotal, totalIncome, totalIncome - incomePlanTotal],
  ];

  const expenseCategories = [...new Set([...Object.keys(expenseByCategory), ...Object.keys(plans).filter((k) => !isIncomeCategory(k))])];
  const incomeCategories = [...new Set([...Object.keys(incomeByCategory), ...Object.keys(plans).filter((k) => isIncomeCategory(k))])];
  const maxRows = Math.max(expenseCategories.length, incomeCategories.length);

  for (let i = 0; i < maxRows; i++) {
    const row: (string | number | null)[] = [null];
    if (i < expenseCategories.length) {
      const cat = expenseCategories[i];
      const plan = plans[cat] || 0;
      const actual = expenseByCategory[cat] || 0;
      row.push(cat, null, plan, actual, plan - actual);
    } else {
      row.push(null, null, null, null, null);
    }
    row.push(null);
    if (i < incomeCategories.length) {
      const cat = incomeCategories[i];
      const plan = plans[cat] || 0;
      const actual = incomeByCategory[cat] || 0;
      row.push(cat, null, plan, actual, actual - plan);
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 3 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 3 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  return ws;
}

/** 거래 시트 생성 */
function buildTransactionSheet(
  label: string,
  expenses: Transaction[],
  incomes: Transaction[]
): XLSX.WorkSheet {
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);

  const txRows: (string | number | null)[][] = [
    [null, `${label} 거래 내역`],
    [null, '지출', null, null, null, null, '수입'],
    [null, '날짜', '금액', '설명', '카테고리', null, '날짜', '금액', '설명', '카테고리'],
  ];

  const sortedExp = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const sortedInc = [...incomes].sort((a, b) => a.date.localeCompare(b.date));
  const maxTx = Math.max(sortedExp.length, sortedInc.length);

  for (let i = 0; i < maxTx; i++) {
    const row: (string | number | null)[] = [null];
    if (i < sortedExp.length) {
      row.push(sortedExp[i].date, sortedExp[i].amount, sortedExp[i].description, sortedExp[i].category);
    } else {
      row.push(null, null, null, null);
    }
    row.push(null);
    if (i < sortedInc.length) {
      row.push(sortedInc[i].date, sortedInc[i].amount, sortedInc[i].description, sortedInc[i].category);
    }
    txRows.push(row);
  }

  txRows.push([null, `${label} 지출 총액`, totalExpense, null, null, null, `${label} 수입 총액`, totalIncome]);

  const ws = XLSX.utils.aoa_to_sheet(txRows);
  ws['!cols'] = [
    { wch: 3 }, { wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 25 },
    { wch: 3 }, { wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 25 },
  ];
  return ws;
}

/** 월별 회계안 Excel (시트2개: 요약 + 거래) */
export function generateMonthlyExcel(data: MonthlyData): XLSX.WorkBook {
  const [, month] = data.yearMonth.split('-');
  const label = `${parseInt(month)}월`;
  const wb = XLSX.utils.book_new();

  const summaryWs = buildSummarySheet(label, data.expenses, data.incomes, data.plans, data.initialBalance);
  XLSX.utils.book_append_sheet(wb, summaryWs, `${label} 회계안`);

  const txWs = buildTransactionSheet(label, data.expenses, data.incomes);
  XLSX.utils.book_append_sheet(wb, txWs, `${label} 거래`);

  return wb;
}

/** 전체 회계안 Excel (전체 요약 + 전체 거래 + 월별 요약&거래 시트들) */
export function generateFullExcel(
  allTransactions: Transaction[],
  monthlyPlans: Record<string, { plans: Record<string, number>; initialBalance: number }>,
  globalPlans: Record<string, number>,
  globalInitialBalance: number
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const allExpenses = allTransactions.filter((t) => t.type === 'expense');
  const allIncomes = allTransactions.filter((t) => t.type === 'income');

  // 전체 요약 시트
  const fullSummary = buildSummarySheet('전체', allExpenses, allIncomes, globalPlans, globalInitialBalance);
  XLSX.utils.book_append_sheet(wb, fullSummary, '전체 회계안');

  // 전체 거래 시트
  const fullTx = buildTransactionSheet('전체', allExpenses, allIncomes);
  XLSX.utils.book_append_sheet(wb, fullTx, '지출&수입');

  // 월별 시트들
  const months = [...new Set(allTransactions.map((t) => t.date.substring(0, 7)))].sort();
  for (const ym of months) {
    const [, m] = ym.split('-');
    const label = `${parseInt(m)}월`;
    const mExpenses = allTransactions.filter((t) => t.type === 'expense' && t.date.startsWith(ym));
    const mIncomes = allTransactions.filter((t) => t.type === 'income' && t.date.startsWith(ym));
    const mp = monthlyPlans[ym] || { plans: {}, initialBalance: 0 };

    const mSummary = buildSummarySheet(label, mExpenses, mIncomes, mp.plans, mp.initialBalance);
    XLSX.utils.book_append_sheet(wb, mSummary, `${label} 회계안`);

    const mTx = buildTransactionSheet(label, mExpenses, mIncomes);
    XLSX.utils.book_append_sheet(wb, mTx, `${label} 거래`);
  }

  return wb;
}

export function downloadExcel(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}
