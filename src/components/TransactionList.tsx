import { useState, useEffect, useMemo } from 'react';
import { useTransactions, deleteTransaction, updateTransaction } from '../hooks/useTransactions';
import { getSettings } from '../lib/db';
import { formatCurrency, getMonthLabel } from '../lib/utils';
import type { Transaction, AppSettings } from '../types';

const PAGE_SIZE = 10;

interface Props {
  onChanged: () => void;
}

export default function TransactionList({ onChanged }: Props) {
  const [monthFilter, setMonthFilter] = useState('');
  const [expCatFilter, setExpCatFilter] = useState('');
  const [incCatFilter, setIncCatFilter] = useState('');
  const [expSearch, setExpSearch] = useState('');
  const [incSearch, setIncSearch] = useState('');
  const [expPage, setExpPage] = useState(0);
  const [incPage, setIncPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const allTransactions = useTransactions();

  const months = useMemo(() => {
    const set = new Set(allTransactions.map((t) => t.date.substring(0, 7)));
    return [...set].sort();
  }, [allTransactions]);

  // 월 필터 적용
  const monthFiltered = useMemo(() => {
    if (!monthFilter) return allTransactions;
    return allTransactions.filter((t) => t.date.startsWith(monthFilter));
  }, [allTransactions, monthFilter]);

  const allExpenses = monthFiltered.filter((t) => t.type === 'expense');
  const allIncomes = monthFiltered.filter((t) => t.type === 'income');

  // 카테고리 목록 (각각)
  const expCategories = useMemo(() => [...new Set(allExpenses.map((t) => t.category))].sort(), [allExpenses]);
  const incCategories = useMemo(() => [...new Set(allIncomes.map((t) => t.category))].sort(), [allIncomes]);

  // 카테고리 + 검색 필터
  const filteredExpenses = useMemo(() => {
    let list = allExpenses;
    if (expCatFilter) list = list.filter((t) => t.category === expCatFilter);
    if (expSearch) list = list.filter((t) =>
      t.description.includes(expSearch) || t.category.includes(expSearch) || t.amount.toString().includes(expSearch)
    );
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [allExpenses, expCatFilter, expSearch]);

  const filteredIncomes = useMemo(() => {
    let list = allIncomes;
    if (incCatFilter) list = list.filter((t) => t.category === incCatFilter);
    if (incSearch) list = list.filter((t) =>
      t.description.includes(incSearch) || t.category.includes(incSearch) || t.amount.toString().includes(incSearch)
    );
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [allIncomes, incCatFilter, incSearch]);

  const totalExpense = filteredExpenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = filteredIncomes.reduce((s, t) => s + t.amount, 0);

  // 페이지 리셋
  useEffect(() => { setExpPage(0); }, [monthFilter, expCatFilter, expSearch]);
  useEffect(() => { setIncPage(0); }, [monthFilter, incCatFilter, incSearch]);

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteTransaction(id);
    onChanged();
  };

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditData({ date: tx.date, amount: tx.amount, description: tx.description, category: tx.category });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateTransaction(editingId, editData);
    setEditingId(null);
    onChanged();
  };

  const renderTable = (
    type: 'expense' | 'income',
    items: Transaction[],
    page: number,
    setPage: (p: number) => void,
    catFilter: string,
    setCatFilter: (v: string) => void,
    search: string,
    setSearch: (v: string) => void,
    categories: string[]
  ) => {
    const isExpense = type === 'expense';
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const paged = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const total = items.reduce((s, t) => s + t.amount, 0);
    const editCats = settings
      ? isExpense ? settings.categories.expense : settings.categories.income
      : [];

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* 헤더 */}
        <div className={`px-4 py-3 border-b ${isExpense ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-semibold ${isExpense ? 'text-red-700' : 'text-green-700'}`}>
              {isExpense ? '지출' : '수입'}
              <span className="ml-1 text-xs font-normal text-gray-400">({items.length}건)</span>
            </h3>
            <span className={`text-sm font-bold ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex gap-2">
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs">
              <option value="">전체 카테고리</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..." className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" />
          </div>
        </div>

        {/* 테이블 */}
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">날짜</th>
              <th className="text-right px-3 py-2">금액</th>
              <th className="text-left px-3 py-2">설명</th>
              <th className="text-left px-3 py-2">카테고리</th>
              <th className="text-center px-3 py-2 w-16">작업</th>
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
                    <select value={editData.category || ''} onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      className="w-full text-xs border border-blue-300 rounded px-1 py-1">
                      <option value="">선택</option>
                      {editCats.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button onClick={handleSaveEdit} className="text-blue-600 hover:text-blue-800 font-bold text-xs mr-1">V</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 text-xs">X</button>
                  </td>
                </tr>
              ) : (
                <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 cursor-pointer" onClick={() => handleEdit(tx)}>{tx.date}</td>
                  <td className="px-3 py-1.5 text-right cursor-pointer" onClick={() => handleEdit(tx)}>{tx.amount.toLocaleString()}</td>
                  <td className="px-3 py-1.5 cursor-pointer" onClick={() => handleEdit(tx)}>{tx.description}</td>
                  <td className="px-3 py-1.5 text-gray-500 cursor-pointer" onClick={() => handleEdit(tx)}>{tx.category}</td>
                  <td className="px-3 py-1.5 text-center">
                    <button onClick={() => handleDelete(tx.id)} className="text-red-300 hover:text-red-500 text-xs font-medium">삭제</button>
                  </td>
                </tr>
              )
            )}
            {paged.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-300">내역 없음</td></tr>
            )}
          </tbody>
        </table>

        {/* 페이징 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 border-t bg-gray-50 text-xs">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">이전</button>
            <span className="text-gray-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100">다음</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 월별 필터 (통일) + 요약 */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4 flex-wrap">
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium">
          <option value="">전체 월</option>
          {months.map((m) => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
        </select>
        <div className="flex gap-4 ml-auto text-sm">
          <span className="text-green-600 font-medium">수입 {formatCurrency(totalIncome)}</span>
          <span className="text-red-600 font-medium">지출 {formatCurrency(totalExpense)}</span>
          <span className={`font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            잔고 {formatCurrency(totalIncome - totalExpense)}
          </span>
        </div>
      </div>

      {/* 지출 / 수입 분리 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderTable('expense', filteredExpenses, expPage, setExpPage, expCatFilter, setExpCatFilter, expSearch, setExpSearch, expCategories)}
        {renderTable('income', filteredIncomes, incPage, setIncPage, incCatFilter, setIncCatFilter, incSearch, setIncSearch, incCategories)}
      </div>
    </div>
  );
}
