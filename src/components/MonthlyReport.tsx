import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings, updateSettings } from '../lib/db';
import { useTransactions, updateTransaction } from '../hooks/useTransactions';
import { generateMonthlyExcel, generateFullExcel, downloadExcel } from '../lib/excel';
import { formatCurrency, getMonthLabel } from '../lib/utils';
import type { AppSettings, Transaction } from '../types';

function isIncomeCategory(cat: string): boolean {
  const incomeKeywords = ['이월금', '재정청구', '회비', '바자회', '찬조', '보험금', '차액', '상금', '이자', '캐쉬백'];
  return incomeKeywords.some((k) => cat.includes(k));
}

export default function Report() {
  const allTransactions = useTransactions();
  const months = useMemo(() => {
    const set = new Set(allTransactions.map((t) => t.date.substring(0, 7)));
    return [...set].sort();
  }, [allTransactions]);

  const [view, setView] = useState<'all' | 'monthly'>('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [plans, setPlans] = useState<Record<string, number>>({});
  const [initialBalance, setInitialBalance] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [expPage, setExpPage] = useState(0);
  const [incPage, setIncPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const PAGE_SIZE = 10;

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // 월별 예산 로드
  const budget = useLiveQuery(
    () => (view === 'monthly' && selectedMonth ? db.budgets.get(selectedMonth) : undefined),
    [view, selectedMonth]
  );

  // 전체 예산 로드 (yearMonth = 'all')
  const globalBudget = useLiveQuery(
    () => (view === 'all' ? db.budgets.get('all') : undefined),
    [view]
  );

  useEffect(() => {
    if (view === 'monthly' && budget) {
      setPlans(budget.plans);
      setInitialBalance(budget.initialBalance);
    } else if (view === 'all' && globalBudget) {
      setPlans(globalBudget.plans);
      setInitialBalance(globalBudget.initialBalance);
    } else {
      setPlans({});
      setInitialBalance(0);
    }
  }, [budget, globalBudget, view]);

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) {
      setSelectedMonth(months[months.length - 1]);
    }
  }, [months, selectedMonth]);

  // 현재 보고있는 거래
  const filtered = useMemo(() => {
    if (view === 'all') return allTransactions;
    return allTransactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [allTransactions, view, selectedMonth]);

  const expenses = filtered.filter((t) => t.type === 'expense');
  const incomes = filtered.filter((t) => t.type === 'income');

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
  const endBalance = initialBalance + totalIncome - totalExpense;

  // 설정의 전체 카테고리 + 거래에서 나온 카테고리 + 계획에서 나온 카테고리 모두 합침
  const allExpenseCategories = [...new Set([
    ...(settings?.categories.expense || []),
    ...Object.keys(expenseByCategory),
    ...Object.keys(plans).filter((k) => !isIncomeCategory(k)),
  ])];
  const allIncomeCategories = [...new Set([
    ...(settings?.categories.income || []),
    ...Object.keys(incomeByCategory),
    ...Object.keys(plans).filter((k) => isIncomeCategory(k)),
  ])];

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  const handlePlanChange = (category: string, value: number) => {
    setPlans((prev) => ({ ...prev, [category]: value }));
  };

  const handleCatRename = (oldName: string) => {
    setEditingCat(oldName);
    setEditCatName(oldName);
  };

  const handleCatRenameSave = async () => {
    if (!editingCat || !editCatName.trim() || editCatName === editingCat) {
      setEditingCat(null);
      return;
    }
    // plans 키 변경
    setPlans((prev) => {
      const next = { ...prev };
      if (next[editingCat]) {
        next[editCatName.trim()] = next[editingCat];
        delete next[editingCat];
      }
      return next;
    });
    // 설정 카테고리 변경
    if (settings) {
      const updated = {
        categories: {
          expense: settings.categories.expense.map((c) => c === editingCat ? editCatName.trim() : c),
          income: settings.categories.income.map((c) => c === editingCat ? editCatName.trim() : c),
        },
      };
      await updateSettings(updated);
      setSettings({ ...settings, ...updated });
    }
    // 거래 데이터의 카테고리도 일괄 변경
    const txToUpdate = allTransactions.filter((t) => t.category === editingCat);
    for (const tx of txToUpdate) {
      await updateTransaction(tx.id, { category: editCatName.trim() });
    }
    setEditingCat(null);
  };

  const handlePlanPaste = (categories: string[], startIdx: number, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;
    e.preventDefault();
    const amounts = text.trim().split('\n')
      .map((line) => {
        const cleaned = line.trim().replace(/[₩원\s,]/g, '');
        return parseInt(cleaned) || 0;
      });
    setPlans((prev) => {
      const next = { ...prev };
      for (let i = 0; i < amounts.length; i++) {
        const catIdx = startIdx + i;
        if (catIdx < categories.length) {
          next[categories[catIdx]] = amounts[i];
        }
      }
      return next;
    });
  };

  const saveBudget = async () => {
    const key = view === 'all' ? 'all' : selectedMonth;
    await db.budgets.put({ yearMonth: key, plans, initialBalance });
    alert('저장되었습니다.');
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditData({ date: tx.date, amount: tx.amount, description: tx.description, category: tx.category });
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    await updateTransaction(editingId, editData);
    setEditingId(null);
  };

  const renderDetailTable = (
    type: 'expense' | 'income',
    items: Transaction[],
    page: number,
    setPage: (p: number) => void
  ) => {
    const isExpense = type === 'expense';
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const cats = settings
      ? isExpense ? settings.categories.expense : settings.categories.income
      : [];

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className={`px-4 py-3 ${isExpense ? 'bg-red-50' : 'bg-green-50'}`}>
          <h3 className={`font-semibold ${isExpense ? 'text-red-700' : 'text-green-700'}`}>
            {isExpense ? '지출' : '수입'} 상세 ({items.length}건)
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">날짜</th>
              <th className="text-right px-3 py-2">금액</th>
              <th className="text-left px-3 py-2">설명</th>
              <th className="text-left px-3 py-2">카테고리</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((tx) =>
              editingId === tx.id ? (
                <tr key={tx.id} className="border-t border-blue-200 bg-blue-50/50">
                  <td className="px-2 py-1">
                    <input type="date" value={editData.date || ''} onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                      className="w-full text-xs border border-blue-300 rounded px-1 py-1" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" value={editData.amount || ''} onChange={(e) => setEditData({ ...editData, amount: parseInt(e.target.value) || 0 })}
                      className="w-full text-xs border border-blue-300 rounded px-1 py-1 text-right" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="text" value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="w-full text-xs border border-blue-300 rounded px-1 py-1" />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <select value={editData.category || ''} onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                        className="flex-1 text-xs border border-blue-300 rounded px-1 py-1">
                        <option value="">선택</option>
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={handleEditSave} className="text-blue-600 hover:text-blue-800 font-bold px-1">V</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 px-1">X</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => handleEditClick(tx)}>
                  <td className="px-3 py-1.5">{tx.date}</td>
                  <td className="px-3 py-1.5 text-right">{tx.amount.toLocaleString()}</td>
                  <td className="px-3 py-1.5">{tx.description}</td>
                  <td className="px-3 py-1.5 text-gray-500">{tx.category}</td>
                </tr>
              )
            )}
            {paged.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-300">내역 없음</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-t bg-gray-50 text-xs">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">
              이전
            </button>
            <span className="text-gray-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">
              다음
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleAutoBalance = () => {
    if (view === 'all') return;
    const monthIdx = months.indexOf(selectedMonth);
    if (monthIdx <= 0) return;
    const prevMonth = months[monthIdx - 1];
    const prevTx = allTransactions.filter((t) => t.date.startsWith(prevMonth));
    const prevIncome = prevTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    db.budgets.get(prevMonth).then((prevBudget) => {
      const prevInitial = prevBudget?.initialBalance || 0;
      setInitialBalance(prevInitial + prevIncome - prevExpense);
    });
  };

  const handleDownloadMonthly = () => {
    if (!selectedMonth) return;
    const wb = generateMonthlyExcel({
      yearMonth: selectedMonth,
      expenses,
      incomes,
      plans,
      initialBalance,
    });
    const [year, month] = selectedMonth.split('-');
    downloadExcel(wb, `${year}년_${parseInt(month)}월_회계안.xlsx`);
  };

  const handleDownloadFull = async () => {
    // 모든 월별 예산 로드
    const allBudgets = await db.budgets.toArray();
    const monthlyPlans: Record<string, { plans: Record<string, number>; initialBalance: number }> = {};
    allBudgets.forEach((b) => {
      if (b.yearMonth !== 'all') {
        monthlyPlans[b.yearMonth] = { plans: b.plans, initialBalance: b.initialBalance };
      }
    });
    const wb = generateFullExcel(allTransactions, monthlyPlans, plans, initialBalance);
    downloadExcel(wb, `전체_회계안.xlsx`);
  };

  const viewLabel = view === 'all' ? '전체' : (selectedMonth ? getMonthLabel(selectedMonth) : '월 선택');

  return (
    <div className="space-y-6">
      {/* 상단 컨트롤 */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3 flex-wrap">
        {/* 전체/월별 전환 */}
        <button
          onClick={() => setView('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'all' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setView('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'monthly' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          월별
        </button>

        {view === 'monthly' && months.length > 0 && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
            >
              {months.map((m) => (
                <option key={m} value={m}>{getMonthLabel(m)}</option>
              ))}
            </select>
            <button onClick={handleAutoBalance} className="text-xs text-blue-500 hover:text-blue-700">
              전월 잔고 자동 계산
            </button>
          </>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">초기 잔고:</label>
          <input
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(parseInt(e.target.value) || 0)}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-32 text-right"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={saveBudget} className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors">
            예산 저장
          </button>
          {view === 'all' ? (
            <button onClick={handleDownloadFull} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              전체 Excel 다운로드
            </button>
          ) : (
            <button onClick={handleDownloadMonthly} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              월별 Excel 다운로드
            </button>
          )}
        </div>
      </div>

      {view === 'monthly' && months.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          거래 데이터가 없습니다. 먼저 거래를 입력해주세요.
        </div>
      )}

      {(view === 'all' || (view === 'monthly' && months.length > 0)) && <>
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-xs text-gray-500">초기 잔고</p>
          <p className="text-lg font-bold">{formatCurrency(initialBalance)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-xs text-gray-500">{viewLabel} 수입</p>
          <p className="text-lg font-bold text-green-500">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-xs text-gray-500">{viewLabel} 지출</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-xs text-gray-500">기말 잔고</p>
          <p className={`text-lg font-bold ${endBalance >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{formatCurrency(endBalance)}</p>
        </div>
      </div>

      {/* 카테고리별 계획/실제/차이 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-red-50 px-4 py-3">
            <h3 className="font-semibold text-red-700">지출</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">카테고리</th>
                <th className="text-right px-4 py-2">계획</th>
                <th className="text-right px-4 py-2">실제</th>
                <th className="text-right px-4 py-2">차이</th>
              </tr>
            </thead>
            <tbody>
              {allExpenseCategories.map((cat, idx) => {
                const plan = plans[cat] || 0;
                const actual = expenseByCategory[cat] || 0;
                const diff = plan - actual;
                return (
                  <tr key={cat} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      {editingCat === cat ? (
                        <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                          onBlur={handleCatRenameSave}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCatRenameSave(); if (e.key === 'Escape') setEditingCat(null); }}
                          className="!text-xs !py-0.5 !px-1 !rounded w-full" autoFocus />
                      ) : (
                        <span className="cursor-pointer hover:text-toss-blue transition-colors" onClick={() => handleCatRename(cat)}>{cat}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" value={plan || ''} onChange={(e) => handlePlanChange(cat, parseInt(e.target.value) || 0)}
                        onPaste={(e) => handlePlanPaste(allExpenseCategories, idx, e)}
                        className="w-24 text-right border border-gray-200 rounded px-1 py-0.5 text-xs" placeholder="0" />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{actual.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diff.toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="px-4 py-2">합계</td>
                <td className="px-4 py-2 text-right">{Object.entries(plans).filter(([k]) => !isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{totalExpense.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{(Object.entries(plans).filter(([k]) => !isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0) - totalExpense).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-green-50 px-4 py-3">
            <h3 className="font-semibold text-green-700">수입</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2">카테고리</th>
                <th className="text-right px-4 py-2">계획</th>
                <th className="text-right px-4 py-2">실제</th>
                <th className="text-right px-4 py-2">차이</th>
              </tr>
            </thead>
            <tbody>
              {allIncomeCategories.map((cat, idx) => {
                const plan = plans[cat] || 0;
                const actual = incomeByCategory[cat] || 0;
                const diff = actual - plan;
                return (
                  <tr key={cat} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      {editingCat === cat ? (
                        <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                          onBlur={handleCatRenameSave}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleCatRenameSave(); if (e.key === 'Escape') setEditingCat(null); }}
                          className="!text-xs !py-0.5 !px-1 !rounded w-full" autoFocus />
                      ) : (
                        <span className="cursor-pointer hover:text-toss-blue transition-colors" onClick={() => handleCatRename(cat)}>{cat}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" value={plan || ''} onChange={(e) => handlePlanChange(cat, parseInt(e.target.value) || 0)}
                        onPaste={(e) => handlePlanPaste(allIncomeCategories, idx, e)}
                        className="w-24 text-right border border-gray-200 rounded px-1 py-0.5 text-xs" placeholder="0" />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{actual.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diff.toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="px-4 py-2">합계</td>
                <td className="px-4 py-2 text-right">{Object.entries(plans).filter(([k]) => isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{totalIncome.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{(totalIncome - Object.entries(plans).filter(([k]) => isIncomeCategory(k)).reduce((s, [, v]) => s + v, 0)).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 거래 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderDetailTable('expense', expenses, expPage, setExpPage)}
        {renderDetailTable('income', incomes, incPage, setIncPage)}
      </div>
      </>}
    </div>
  );
}
