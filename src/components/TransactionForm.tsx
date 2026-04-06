import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings } from '../lib/db';
import { bulkAddTransactions } from '../hooks/useTransactions';
import type { AppSettings } from '../types';
import OcrUploader from './OcrUploader';
import ExcelImporter from './ExcelImporter';
import CategoryCombobox from './CategoryCombobox';
import { parsePastedText, type ColumnType } from '../lib/paste-parser';

function HelpGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-toss-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-toss-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-toss-blue shrink-0">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7.5 7a1.5 1.5 0 113 0c0 .83-.67 1.17-1 1.5-.33.33-.5.67-.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="9" cy="12.5" r=".75" fill="currentColor"/>
          </svg>
          <span className="text-sm font-semibold text-toss-gray-700">입력 가이드</span>
          <span className="text-xs text-toss-gray-400">복사 붙여넣기, 날짜 범위, 카테고리 관리</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`text-toss-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 text-sm text-toss-gray-600 border-t border-toss-gray-100 pt-4">
          {/* 복사 붙여넣기 */}
          <div>
            <h4 className="font-bold text-toss-gray-800 mb-2">복사 붙여넣기</h4>
            <p className="text-xs text-toss-gray-500 mb-2">엑셀이나 메모장에서 데이터를 복사해서 아무 칸에 붙여넣으면 자동으로 인식합니다.</p>

            <div className="space-y-2">
              <div className="bg-toss-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-toss-gray-700 mb-1">전체 행 붙여넣기 (날짜 칸에)</p>
                <pre className="text-xs text-toss-gray-500 whitespace-pre leading-relaxed">{`2025년 1월 3일    ₩40,000    말씀노트 구매    청년부실 비품
2025년 1월 7일    ₩45,000    신시아 후원      신시아 후원
2025.01.16        270000     임원 LT 펜션     임원 LT`}</pre>
              </div>

              <div className="bg-toss-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-toss-gray-700 mb-1">금액만 붙여넣기 (금액 칸에)</p>
                <pre className="text-xs text-toss-gray-500 whitespace-pre leading-relaxed">{`₩40,000
₩45,000
₩270,000`}</pre>
              </div>

              <div className="bg-toss-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-toss-gray-700 mb-1">설명+카테고리 붙여넣기 (설명 칸에)</p>
                <pre className="text-xs text-toss-gray-500 whitespace-pre leading-relaxed">{`공동체 모임 지원비    공동체모임지원비
신시아 후원            신시아 후원`}</pre>
              </div>
            </div>
          </div>

          {/* 날짜 */}
          <div>
            <h4 className="font-bold text-toss-gray-800 mb-2">날짜 범위</h4>
            <p className="text-xs text-toss-gray-500">날짜 옆 <span className="font-mono bg-toss-gray-100 px-1 rounded">~</span> 버튼을 클릭하면 종료일을 추가할 수 있습니다. (예: 2025-05-03 ~ 2025-08-06)</p>
          </div>

          {/* 카테고리 */}
          <div>
            <h4 className="font-bold text-toss-gray-800 mb-2">카테고리</h4>
            <ul className="text-xs text-toss-gray-500 space-y-1 list-disc list-inside">
              <li>드롭다운에서 <b>선택</b>하거나, 직접 <b>타이핑</b>하면 새 카테고리가 자동 추가됩니다</li>
              <li>드롭다운 항목에 마우스를 올리면 <b>X 버튼</b>으로 삭제할 수 있습니다</li>
              <li><b>통일 체크</b>: 체크하면 해당 카테고리가 지출/수입 양쪽에서 사용 가능합니다</li>
            </ul>
          </div>

          {/* 사진/PDF */}
          <div>
            <h4 className="font-bold text-toss-gray-800 mb-2">사진/PDF 분석</h4>
            <p className="text-xs text-toss-gray-500">상단 "사진/PDF" 탭에서 영수증 이미지나 PDF를 업로드하면 AI가 날짜, 금액, 설명을 자동 추출합니다. 여러 파일을 한번에 업로드할 수 있고, 파일을 끌어서 놓아도 됩니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface Row {
  key: number;
  date: string;
  dateEnd: string;
  amount: string;
  description: string;
  category: string;
  unified: boolean; // 통일 체크 여부 (기본 true)
}

let rowKeySeq = 0;
const emptyRow = (): Row => ({
  key: ++rowKeySeq,
  date: new Date().toISOString().split('T')[0],
  dateEnd: '',
  amount: '',
  description: '',
  category: '',
  unified: true,
});

const isRowFilled = (r: Row) => r.amount && r.category;
const isRowEmpty = (r: Row) => !r.amount && !r.category;

/** date 필드 저장 형식: "2025-01-03" 또는 "2025-01-03~2025-01-05" */
const getDateValue = (r: Row) => r.dateEnd ? `${r.date}~${r.dateEnd}` : r.date;

interface Props {
  onSaved: () => void;
}

export default function TransactionForm({ onSaved }: Props) {
  const [inputMode, setInputMode] = useState<'manual' | 'ocr' | 'excel'>('manual');
  const [expenseRows, setExpenseRows] = useState<Row[]>([emptyRow()]);
  const [incomeRows, setIncomeRows] = useState<Row[]>([emptyRow()]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // 자동 빈 행 추가
  useEffect(() => {
    const lastExp = expenseRows[expenseRows.length - 1];
    if (lastExp && isRowFilled(lastExp)) {
      setExpenseRows((prev) => [...prev, emptyRow()]);
    }
  }, [expenseRows]);

  useEffect(() => {
    const lastInc = incomeRows[incomeRows.length - 1];
    if (lastInc && isRowFilled(lastInc)) {
      setIncomeRows((prev) => [...prev, emptyRow()]);
    }
  }, [incomeRows]);

  const getCategories = useCallback(
    (type: 'expense' | 'income') => {
      if (!settings) return [];
      return type === 'expense' ? settings.categories.expense : settings.categories.income;
    },
    [settings]
  );

  // 전체 카테고리 통일: 드롭박스에서 선택하면 unified=true인 행의 카테고리를 일괄 변경
  const handleUnifyDropdown = (type: 'expense' | 'income', selectedCategory: string) => {
    if (!selectedCategory) return;
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => prev.map((r) => r.unified ? { ...r, category: selectedCategory } : r));
  };

  // 개별 행 통일 체크박스 토글
  const toggleRowUnified = (type: 'expense' | 'income', key: number) => {
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => prev.map((r) => r.key === key ? { ...r, unified: !r.unified } : r));
  };

  const updateRow = (type: 'expense' | 'income', key: number, field: keyof Row, value: string) => {
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (type: 'expense' | 'income', key: number) => {
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [emptyRow()] : next;
    });
  };

  const addRow = (type: 'expense' | 'income') => {
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => [...prev, emptyRow()]);
  };

  const handleCategoryChange = async (type: 'expense' | 'income', rowKey: number, value: string) => {
    if (!settings) return;
    const cats = getCategories(type);
    if (value && !cats.includes(value)) {
      const updated = {
        categories: {
          ...settings.categories,
          [type]: [...settings.categories[type], value],
        },
      };
      await updateSettings(updated);
      setSettings({ ...settings, ...updated });
    }
    updateRow(type, rowKey, 'category', value);
  };

  const handleCategoryDelete = async (category: string, _type: 'expense' | 'income') => {
    if (!settings) return;
    // 양쪽에서 제거
    const updated = {
      categories: {
        expense: settings.categories.expense.filter((c) => c !== category),
        income: settings.categories.income.filter((c) => c !== category),
      },
    };
    await updateSettings(updated);
    setSettings({ ...settings, ...updated });
  };


  const filledExpense = expenseRows.filter((r) => isRowFilled(r));
  const filledIncome = incomeRows.filter((r) => isRowFilled(r));
  const totalFilled = filledExpense.length + filledIncome.length;

  const handleSave = async () => {
    if (totalFilled === 0) return;
    setSaving(true);
    const all = [
      ...filledExpense.map((r) => ({ ...r, type: 'expense' as const })),
      ...filledIncome.map((r) => ({ ...r, type: 'income' as const })),
    ];
    await bulkAddTransactions(
      all.map((r) => ({
        date: getDateValue(r),
        amount: parseInt(r.amount),
        description: r.description,
        category: r.category,
        type: r.type,
        source: 'manual' as const,
      }))
    );
    setSaving(false);
    setExpenseRows([emptyRow()]);
    setIncomeRows([emptyRow()]);
    onSaved();
  };

  const handleOcrResult = (data: { date?: string; amount?: string; description?: string }) => {
    setExpenseRows((prev) => {
      const idx = prev.findIndex((r) => isRowEmpty(r));
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          date: data.date || updated[idx].date,
          amount: data.amount || '',
          description: data.description || '',
        };
        return updated;
      }
      return [
        ...prev,
        { ...emptyRow(), date: data.date || new Date().toISOString().split('T')[0], amount: data.amount || '', description: data.description || '' },
      ];
    });
    setInputMode('manual');
  };

  const handlePaste = (type: 'expense' | 'income', e: React.ClipboardEvent, sourceColumn?: ColumnType, rowKey?: number) => {
    const text = e.clipboardData.getData('text');
    // 단일 값(줄바꿈/탭 없음)은 기본 동작
    if (!text.includes('\n') && !text.includes('\t')) return;

    const parsed = parsePastedText(text, sourceColumn);
    if (parsed.length === 0) return;

    e.preventDefault();
    const setter = type === 'expense' ? setExpenseRows : setIncomeRows;
    setter((prev) => {
      // 현재 행 인덱스 찾기
      const startIdx = rowKey ? prev.findIndex((r) => r.key === rowKey) : -1;

      // 전체 행 데이터인 경우 (date+amount 둘 다 있음): 새 행으로 추가
      const isFullRows = parsed.every((p) => p.date && p.amount);
      if (isFullRows) {
        const existing = prev.filter((r) => !isRowEmpty(r));
        const newRows: Row[] = parsed.map((p) => ({
          ...emptyRow(),
          date: p.date || new Date().toISOString().split('T')[0],
          amount: p.amount || '',
          description: p.description || '',
          category: p.category || '',
        }));
        return [...existing, ...newRows, emptyRow()];
      }

      // 부분 데이터: 현재 행부터 기존 행에 머지, 부족하면 새 행 추가
      const result = [...prev];
      const baseIdx = startIdx >= 0 ? startIdx : result.findIndex((r) => isRowEmpty(r));
      const insertFrom = baseIdx >= 0 ? baseIdx : result.length;

      for (let i = 0; i < parsed.length; i++) {
        const targetIdx = insertFrom + i;
        if (targetIdx < result.length) {
          // 기존 행에 머지 (빈 필드만 채움)
          const existing = result[targetIdx];
          result[targetIdx] = {
            ...existing,
            date: parsed[i].date || existing.date,
            amount: parsed[i].amount || existing.amount,
            description: parsed[i].description !== undefined ? (parsed[i].description || existing.description) : existing.description,
            category: parsed[i].category || existing.category,
          };
        } else {
          // 새 행 추가
          result.push({
            ...emptyRow(),
            date: parsed[i].date || new Date().toISOString().split('T')[0],
            amount: parsed[i].amount || '',
            description: parsed[i].description || '',
            category: parsed[i].category || '',
          });
        }
      }

      // 마지막에 빈 행 보장
      const last = result[result.length - 1];
      if (last && !isRowEmpty(last)) result.push(emptyRow());

      return result;
    });
  };

  const renderTable = (type: 'expense' | 'income', rows: Row[]) => {
    const isExpense = type === 'expense';
    const filled = rows.filter((r) => isRowFilled(r));

    return (
      <div className="bg-white rounded-2xl border border-toss-gray-100 overflow-visible">
        {/* 헤더 */}
        <div className={`px-5 py-3 flex items-center justify-between border-b ${isExpense ? 'border-toss-red/10' : 'border-toss-green/10'}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isExpense ? 'bg-toss-red' : 'bg-toss-green'}`} />
            <h3 className={`font-bold text-base ${isExpense ? 'text-toss-red' : 'text-toss-green'}`}>
              {isExpense ? '지출' : '수입'}
            </h3>
            {filled.length > 0 && (
              <span className="text-xs text-toss-gray-400 bg-toss-gray-100 px-2 py-0.5 rounded-full">{filled.length}건</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-toss-gray-400">전체 카테고리</span>
            <select
              value=""
              onChange={(e) => { handleUnifyDropdown(type, e.target.value); e.target.value = ''; }}
              className="!text-xs !py-1 !px-2 !rounded-lg !border-toss-gray-200 w-36"
            >
              <option value="">선택하면 일괄 적용</option>
              {getCategories(type).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[140px_120px_1fr_160px_32px_28px] gap-2 px-5 py-2 bg-toss-gray-50 text-xs font-semibold text-toss-gray-400 border-b border-toss-gray-100">
          <span>날짜</span>
          <span>금액</span>
          <span>설명</span>
          <span>카테고리</span>
          <span className="text-center">통일</span>
          <span></span>
        </div>

        {/* 행들 */}
        <div className="divide-y divide-toss-gray-50">
          {rows.map((row, idx) => (
            <div key={row.key} className={`grid grid-cols-[140px_120px_1fr_160px_32px_28px] gap-2 px-5 py-2 items-center group ${idx % 2 === 1 ? 'bg-toss-gray-50/50' : ''}`}>
              {/* 날짜 */}
              <div className="flex items-center gap-0.5">
                <input type="date" value={row.date} onChange={(e) => updateRow(type, row.key, 'date', e.target.value)}
                  onPaste={(e) => handlePaste(type, e, 'date', row.key)}
                  className="!text-sm !py-1.5 !px-2 !rounded-lg w-full" />
                {row.dateEnd ? (
                  <>
                    <span className="text-toss-gray-400 text-xs shrink-0">~</span>
                    <input type="date" value={row.dateEnd} onChange={(e) => updateRow(type, row.key, 'dateEnd', e.target.value)}
                      className="!text-sm !py-1.5 !px-2 !rounded-lg w-full" />
                    <button type="button" onClick={() => updateRow(type, row.key, 'dateEnd', '')}
                      className="text-toss-gray-300 hover:text-toss-red shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => updateRow(type, row.key, 'dateEnd', row.date)}
                    className="text-toss-gray-300 hover:text-toss-blue text-sm font-bold shrink-0 px-0.5">~</button>
                )}
              </div>

              {/* 금액 */}
              <input type="number" value={row.amount} onChange={(e) => updateRow(type, row.key, 'amount', e.target.value)}
                onPaste={(e) => handlePaste(type, e, 'amount', row.key)}
                placeholder="금액" className="!text-sm !py-1.5 !px-2 !rounded-lg text-right !font-semibold w-full" min="1" />

              {/* 설명 */}
              <input type="text" value={row.description} onChange={(e) => updateRow(type, row.key, 'description', e.target.value)}
                onPaste={(e) => handlePaste(type, e, 'description', row.key)}
                placeholder="설명 (선택)" className="!text-sm !py-1.5 !px-2 !rounded-lg w-full" />

              {/* 카테고리 */}
              <CategoryCombobox
                value={row.category}
                categories={getCategories(type)}
                onChange={(val) => handleCategoryChange(type, row.key, val)}
                onDelete={(cat) => handleCategoryDelete(cat, type)}
                onPaste={(e) => handlePaste(type, e, 'category', row.key)}
              />

              {/* 통일 체크 */}
              <div className="flex items-center justify-center">
                <input type="checkbox" checked={row.unified}
                  onChange={() => toggleRowUnified(type, row.key)}
                  className="rounded accent-toss-blue cursor-pointer w-4 h-4"
                  title={row.unified ? '전체 카테고리 적용 대상' : '전체 카테고리 적용 제외'} />
              </div>

              {/* 삭제 */}
              <button onClick={() => removeRow(type, row.key)}
                className="text-toss-gray-200 hover:text-toss-red transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>

        {/* + 버튼 */}
        <button
          onClick={() => addRow(type)}
          className={`w-full py-3 border-t-2 border-dashed transition-all flex items-center justify-center rounded-b-2xl ${
            isExpense
              ? 'border-toss-red/15 text-toss-red/30 hover:bg-toss-red-light hover:text-toss-red/60'
              : 'border-toss-green/15 text-toss-green/30 hover:bg-toss-green-light hover:text-toss-green/60'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3V15M3 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    );
  };

  const handleFormDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files') && inputMode !== 'ocr') {
      setInputMode('ocr');
    }
  };

  return (
    <div className="space-y-5" onDragOver={handleFormDragOver}>
      {/* 모드 전환 */}
      <div className="flex gap-2 bg-toss-gray-100 p-1 rounded-2xl">
        {(['manual', 'ocr', 'excel'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              inputMode === mode
                ? 'bg-white text-toss-gray-900 shadow-sm'
                : 'text-toss-gray-400 hover:text-toss-gray-600'
            }`}
          >
            {mode === 'manual' ? '직접 입력' : mode === 'ocr' ? '사진/PDF' : 'Excel'}
          </button>
        ))}
      </div>

      {inputMode === 'ocr' && <OcrUploader onResult={handleOcrResult} />}
      {inputMode === 'excel' && <ExcelImporter onImported={onSaved} />}

      {(inputMode === 'manual' || inputMode === 'ocr') && (
        <>
          {/* 사용법 가이드 */}
          <HelpGuide />

          {/* 세로 배치: 지출 → 수입 */}
          <div className="space-y-6">
            {renderTable('expense', expenseRows)}
            {renderTable('income', incomeRows)}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || totalFilled === 0}
            className="w-full py-4 rounded-2xl text-base font-bold transition-all disabled:opacity-40 bg-toss-blue text-white hover:bg-toss-blue-dark shadow-lg shadow-toss-blue/20 active:scale-[0.98]"
          >
            {saving ? '저장 중...' : totalFilled > 0 ? `${totalFilled}건 저장하기` : '데이터를 입력해주세요'}
          </button>
        </>
      )}
    </div>
  );
}
