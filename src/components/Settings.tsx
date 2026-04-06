import { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, db } from '../lib/db';
import type { AppSettings } from '../types';

interface PlanRow {
  category: string;
  amount: number;
}

function parseAmountText(text: string): number {
  const cleaned = text.replace(/[₩원\s,]/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

function parsePlanPaste(text: string): PlanRow[] {
  return text.trim().split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      let parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) parts = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);

      if (parts.length >= 2) {
        // 카테고리 + 금액 or 금액 + 카테고리
        const first = parseAmountText(parts[0]);
        const second = parseAmountText(parts[1]);
        if (first > 0 && second === 0) return { category: parts[1], amount: first };
        if (second > 0) return { category: parts[0], amount: second };
      }
      // 단일 값: 금액만
      const amt = parseAmountText(line);
      if (amt > 0) return { category: '', amount: amt };
      // 텍스트만: 카테고리
      return { category: line, amount: 0 };
    });
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');

  // 계획안 편집
  const [expensePlans, setExpensePlans] = useState<PlanRow[]>([]);
  const [incomePlans, setIncomePlans] = useState<PlanRow[]>([]);

  // 사진 분석
  const [photoTarget, setPhotoTarget] = useState<'expense' | 'income' | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setApiKey(s.claudeApiKey || '');
      setExpensePlans(s.categories.expense.map((c) => ({ category: c, amount: 0 })));
      setIncomePlans(s.categories.income.map((c) => ({ category: c, amount: 0 })));
    });
    // 저장된 계획 금액 로드
    db.budgets.get('plan-template').then((b) => {
      if (b?.plans) {
        setExpensePlans((prev) => prev.map((r) => ({ ...r, amount: b.plans[r.category] || 0 })));
        setIncomePlans((prev) => prev.map((r) => ({ ...r, amount: b.plans[r.category] || 0 })));
      }
    });
  }, []);

  const saveApiKey = async () => {
    await updateSettings({ claudeApiKey: apiKey || undefined });
    alert('API 키가 저장되었습니다.');
  };

  // --- 계획안 CRUD ---
  const addPlanRow = (type: 'expense' | 'income') => {
    const setter = type === 'expense' ? setExpensePlans : setIncomePlans;
    setter((prev) => [...prev, { category: '', amount: 0 }]);
  };

  const updatePlanRow = (type: 'expense' | 'income', idx: number, field: 'category' | 'amount', value: string | number) => {
    const setter = type === 'expense' ? setExpensePlans : setIncomePlans;
    setter((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removePlanRow = (type: 'expense' | 'income', idx: number) => {
    const setter = type === 'expense' ? setExpensePlans : setIncomePlans;
    setter((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePlanPaste = (type: 'expense' | 'income', e: React.ClipboardEvent, startIdx: number) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;
    e.preventDefault();

    const parsed = parsePlanPaste(text);
    if (parsed.length === 0) return;

    const setter = type === 'expense' ? setExpensePlans : setIncomePlans;
    setter((prev) => {
      const result = [...prev];
      for (let i = 0; i < parsed.length; i++) {
        const targetIdx = startIdx + i;
        if (targetIdx < result.length) {
          result[targetIdx] = {
            category: parsed[i].category || result[targetIdx].category,
            amount: parsed[i].amount || result[targetIdx].amount,
          };
        } else {
          result.push(parsed[i]);
        }
      }
      return result;
    });
  };

  const savePlans = async () => {
    if (!settings) return;
    // 카테고리 목록 업데이트
    const expCats = expensePlans.filter((r) => r.category).map((r) => r.category);
    const incCats = incomePlans.filter((r) => r.category).map((r) => r.category);
    await updateSettings({ categories: { expense: expCats, income: incCats } });

    // 계획 금액 템플릿 저장
    const plans: Record<string, number> = {};
    [...expensePlans, ...incomePlans].forEach((r) => {
      if (r.category) plans[r.category] = r.amount;
    });
    await db.budgets.put({ yearMonth: 'plan-template', plans, initialBalance: 0 });

    setSettings({ ...settings, categories: { expense: expCats, income: incCats } });
    alert('저장되었습니다.');
  };

  // --- 사진 분석으로 계획안 세팅 ---
  const handlePhotoAnalysis = async (file: File) => {
    if (!photoTarget) return;
    setPhotoProcessing(true);

    try {
      const apiKeyValue = settings?.claudeApiKey || import.meta.env.VITE_CLAUDE_API_KEY;
      if (!apiKeyValue) throw new Error('API 키가 없습니다.');

      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(',')[1];
      const mediaType = dataUrl.split(';')[0].split(':')[1];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyValue,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: `이 이미지에서 ${photoTarget === 'expense' ? '지출' : '수입'} 계획 데이터를 추출해주세요.\n각 항목을 JSON 배열로 응답해주세요.\n형식: [{"category":"카테고리명","amount":금액}, ...]\nJSON만 응답해주세요.` },
            ],
          }],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
      const text = result.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const items: PlanRow[] = JSON.parse(match[0]);
        const setter = photoTarget === 'expense' ? setExpensePlans : setIncomePlans;
        setter(items.map((r) => ({ category: r.category || '', amount: r.amount || 0 })));
      }
    } catch (err) {
      alert('분석 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setPhotoProcessing(false);
      setPhotoTarget(null);
    }
  };

  const clearAllData = async () => {
    if (!confirm('모든 거래 데이터와 예산 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    await db.transactions.clear();
    await db.budgets.clear();
    alert('모든 데이터가 삭제되었습니다.');
  };

  if (!settings) return <div className="text-gray-400">로딩 중...</div>;

  const renderPlanTable = (type: 'expense' | 'income', rows: PlanRow[]) => {
    const isExpense = type === 'expense';
    return (
      <div className="bg-white rounded-lg shadow overflow-visible">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isExpense ? 'bg-red-50' : 'bg-green-50'}`}>
          <h3 className={`font-semibold text-sm ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
            {isExpense ? '지출 계획' : '수입 계획'}
            <span className="ml-1 text-xs font-normal text-gray-400">({rows.length}개)</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPhotoTarget(type);
                setTimeout(() => photoRef.current?.click(), 0);
              }}
              disabled={photoProcessing}
              className="text-xs text-purple-500 hover:text-purple-700 font-medium"
            >
              {photoProcessing && photoTarget === type ? '분석 중...' : '사진 분석'}
            </button>
            <button onClick={() => addPlanRow(type)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
              + 추가
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_120px_28px] gap-2 px-4 py-1.5 bg-gray-100 text-xs font-semibold text-gray-500 border-b">
          <span>카테고리</span>
          <span className="text-right">계획 금액</span>
          <span></span>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <div key={idx} className={`grid grid-cols-[1fr_120px_28px] gap-2 px-4 py-1 items-center ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              <input
                type="text"
                value={row.category}
                onChange={(e) => updatePlanRow(type, idx, 'category', e.target.value)}
                onPaste={(e) => handlePlanPaste(type, e, idx)}
                placeholder="카테고리명"
                className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <input
                type="number"
                value={row.amount || ''}
                onChange={(e) => updatePlanRow(type, idx, 'amount', parseInt(e.target.value) || 0)}
                onPaste={(e) => handlePlanPaste(type, e, idx)}
                placeholder="0"
                className="text-xs border border-gray-300 rounded px-2 py-1.5 text-right bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <button
                onClick={() => removePlanRow(type, idx)}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded w-6 h-6 flex items-center justify-center transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 계획안 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">계획안 설정</h2>
          <button onClick={savePlans} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            저장
          </button>
        </div>
        <p className="text-xs text-gray-400">카테고리와 계획 금액을 설정합니다. 복사 붙여넣기로 한번에 입력할 수 있습니다.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderPlanTable('expense', expensePlans)}
          {renderPlanTable('income', incomePlans)}
        </div>
      </div>

      {/* 사진 분석용 숨겨진 인풋 */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoAnalysis(file);
          e.target.value = '';
        }}
      />

      {/* Claude API */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Claude API 설정</h2>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={saveApiKey} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            저장
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow p-6 border border-red-200">
        <h2 className="text-lg font-semibold text-red-600 mb-4">데이터 관리</h2>
        <button onClick={clearAllData} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
          모든 데이터 초기화
        </button>
        <p className="text-xs text-gray-400 mt-2">거래 데이터와 예산 데이터가 모두 삭제됩니다.</p>
      </div>
    </div>
  );
}
