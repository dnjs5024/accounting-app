import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTransactions, deleteTransaction, updateTransaction } from '../hooks/useTransactions';
import { getSettings } from '../lib/db';
import { formatCurrency, getMonthLabel } from '../lib/utils';
import type { Transaction, AppSettings } from '../types';

const PAGE_SIZE = 20;

interface Props {
  onChanged: () => void;
}

export default function TransactionList({ onChanged }: Props) {
  const [view, setView] = useState<'all' | 'expense' | 'income'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getSettings().then(setSettings); }, []);

  const allTransactions = useTransactions();

  const months = useMemo(() => {
    const set = new Set(allTransactions.map((t) => t.date.substring(0, 7)));
    return [...set].sort();
  }, [allTransactions]);

  const filtered = useMemo(() => {
    let list = allTransactions;
    if (view !== 'all') list = list.filter((t) => t.type === view);
    if (monthFilter) list = list.filter((t) => t.date.startsWith(monthFilter));
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    if (search) list = list.filter((t) =>
      t.description.includes(search) || t.category.includes(search) || t.amount.toString().includes(search)
    );
    return list.sort((a, b) => b.date.localeCompare(a.date)); // 최신순
  }, [allTransactions, view, monthFilter, categoryFilter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // 필터 변경 시 초기화
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [view, monthFilter, categoryFilter, search]);

  // 무한 스크롤
  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [observerCallback]);

  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  // 카테고리 목록 (지출/수입 분류)
  const expCategories = useMemo(() =>
    [...new Set(allTransactions.filter((t) => t.type === 'expense').map((t) => t.category))].sort()
  , [allTransactions]);
  const incCategories = useMemo(() =>
    [...new Set(allTransactions.filter((t) => t.type === 'income').map((t) => t.category))].sort()
  , [allTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteTransaction(id);
    onChanged();
  };

  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditData({ date: tx.date, amount: tx.amount, description: tx.description, category: tx.category, type: tx.type });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateTransaction(editingId, editData);
    setEditingId(null);
    onChanged();
  };

  const editCats = settings
    ? editData.type === 'income' ? settings.categories.income : settings.categories.expense
    : [];

  // 날짜 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    visible.forEach((tx) => {
      const key = tx.date.substring(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    });
    return [...map.entries()];
  }, [visible]);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-toss-gray-100 p-4 text-center">
          <p className="text-[11px] text-toss-gray-400">수입</p>
          <p className="text-lg font-bold text-toss-green">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-toss-gray-100 p-4 text-center">
          <p className="text-[11px] text-toss-gray-400">지출</p>
          <p className="text-lg font-bold text-toss-red">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-toss-gray-100 p-4 text-center">
          <p className="text-[11px] text-toss-gray-400">잔고</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-toss-blue' : 'text-toss-red'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl border border-toss-gray-100 p-4 space-y-3">
        {/* 전체/지출/수입 탭 */}
        <div className="flex gap-1 bg-toss-gray-100 p-1 rounded-xl">
          {([['all', '전체'], ['expense', '지출'], ['income', '수입']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                view === v ? 'bg-white text-toss-gray-900 shadow-sm' : 'text-toss-gray-400'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* 월/카테고리/검색 */}
        <div className="flex gap-2">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="!text-xs !py-2 !px-3 !rounded-xl flex-1">
            <option value="">전체 월</option>
            {months.map((m) => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="!text-xs !py-2 !px-3 !rounded-xl flex-1">
            <option value="">전체 카테고리</option>
            {expCategories.length > 0 && (
              <optgroup label="지출">
                {expCategories.map((c) => <option key={`e-${c}`} value={c}>{c}</option>)}
              </optgroup>
            )}
            {incCategories.length > 0 && (
              <optgroup label="수입">
                {incCategories.map((c) => <option key={`i-${c}`} value={c}>{c}</option>)}
              </optgroup>
            )}
          </select>

          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="검색" className="!text-xs !py-2 !px-3 !rounded-xl flex-1" />
        </div>
      </div>

      {/* 거래 목록 */}
      <div className="space-y-4">
        {grouped.map(([date, txs]) => (
          <div key={date}>
            {/* 날짜 헤더 */}
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-bold text-toss-gray-700">{formatDateLabel(date)}</span>
              <span className="text-[11px] text-toss-gray-400">{txs.length}건</span>
            </div>

            {/* 거래 카드들 */}
            <div className="bg-white rounded-2xl border border-toss-gray-100 divide-y divide-toss-gray-50 overflow-hidden">
              {txs.map((tx) =>
                editingId === tx.id ? (
                  /* 편집 모드 */
                  <div key={tx.id} className="p-4 space-y-2 bg-toss-blue-light/30">
                    <div className="flex gap-2">
                      <select value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value as 'income'|'expense', category: '' })}
                        className="!text-xs !py-1.5 !px-2 !rounded-lg w-16">
                        <option value="expense">지출</option>
                        <option value="income">수입</option>
                      </select>
                      <input type="date" value={editData.date || ''} onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        className="!text-xs !py-1.5 !px-2 !rounded-lg flex-1" />
                      <input type="number" value={editData.amount || ''} onChange={(e) => setEditData({ ...editData, amount: parseInt(e.target.value) || 0 })}
                        className="!text-xs !py-1.5 !px-2 !rounded-lg w-24 text-right" />
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="설명" className="!text-xs !py-1.5 !px-2 !rounded-lg flex-1" />
                      <select value={editData.category || ''} onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                        className="!text-xs !py-1.5 !px-2 !rounded-lg flex-1">
                        <option value="">카테고리</option>
                        {editCats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-toss-gray-400 hover:bg-toss-gray-100">취소</button>
                      <button onClick={handleSaveEdit}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-toss-blue hover:bg-toss-blue-dark">저장</button>
                    </div>
                  </div>
                ) : (
                  /* 일반 모드 */
                  <div key={tx.id} className="flex items-center px-4 py-3 hover:bg-toss-gray-50/50 cursor-pointer group"
                    onClick={() => handleEdit(tx)}>
                    {/* 아이콘 */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mr-3 ${
                      tx.type === 'expense' ? 'bg-toss-red-light' : 'bg-toss-green-light'
                    }`}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        {tx.type === 'expense'
                          ? <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-toss-red"/>
                          : <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-toss-green"/>
                        }
                      </svg>
                    </div>

                    {/* 설명 + 카테고리 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-toss-gray-800 truncate">
                        {tx.description || tx.category}
                      </p>
                      <p className="text-[11px] text-toss-gray-400 truncate">
                        {tx.description ? tx.category : ''}
                      </p>
                    </div>

                    {/* 금액 */}
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-sm font-bold ${tx.type === 'expense' ? 'text-toss-red' : 'text-toss-green'}`}>
                        {tx.type === 'expense' ? '-' : '+'}{tx.amount.toLocaleString()}원
                      </p>
                    </div>

                    {/* 삭제 */}
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                      className="ml-2 text-toss-gray-200 hover:text-toss-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        ))}

        {/* 빈 상태 */}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-toss-gray-300">
            <p className="text-base">거래 내역이 없습니다</p>
          </div>
        )}

        {/* 무한 스크롤 로더 */}
        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-toss-gray-200 border-t-toss-blue rounded-full animate-spin" />
          </div>
        )}

        {/* 하단 카운트 */}
        {filtered.length > 0 && !hasMore && (
          <p className="text-center text-[11px] text-toss-gray-300 py-2">
            총 {filtered.length}건
          </p>
        )}
      </div>
    </div>
  );
}
