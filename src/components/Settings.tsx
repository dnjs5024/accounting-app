import { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, db } from '../lib/db';
import type { AppSettings } from '../types';

function SettingsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-toss-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-toss-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="text-toss-blue shrink-0">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7.5 7a1.5 1.5 0 113 0c0 .83-.67 1.17-1 1.5-.33.33-.5.67-.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="9" cy="12.5" r=".75" fill="currentColor"/>
          </svg>
          <span className="text-xs font-semibold text-toss-gray-600">사용법 보기</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className={`text-toss-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-toss-gray-100 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-toss-gray-500">
            <div className="bg-toss-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="font-bold text-toss-gray-700">붙여넣기 예시</p>
              <pre className="text-[11px] leading-relaxed whitespace-pre">{`신시아 후원    540000
공동체모임     500000
봄 MT         500000`}</pre>
              <p className="text-[10px] text-toss-gray-400">카테고리 또는 금액 칸에 Ctrl+V</p>
            </div>
            <div className="bg-toss-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="font-bold text-toss-gray-700">기능 안내</p>
              <ul className="space-y-0.5 text-[11px]">
                <li><b className="text-toss-blue">카테고리+금액</b> 한번에 붙여넣기 가능</li>
                <li><b className="text-toss-blue">금액만</b> 붙여넣으면 아래 행으로 채움</li>
                <li><b className="text-toss-blue">사진 분석</b> 계획표 이미지 → AI 추출</li>
                <li><b className="text-toss-blue">저장</b> 카테고리 목록 + 금액 함께 저장</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const [initialBalance, setInitialBalance] = useState(0);

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
    // 저장된 계획 금액 + 초기잔고 로드
    db.budgets.get('plan-template').then((b) => {
      if (b?.plans) {
        setExpensePlans((prev) => prev.map((r) => ({ ...r, amount: b.plans[r.category] || 0 })));
        setIncomePlans((prev) => prev.map((r) => ({ ...r, amount: b.plans[r.category] || 0 })));
      }
      if (b?.initialBalance) setInitialBalance(b.initialBalance);
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
    await db.budgets.put({ yearMonth: 'plan-template', plans, initialBalance });

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

  const clearData = async (target: 'all' | 'expense' | 'income' | 'plans') => {
    const labels: Record<string, string> = {
      all: '모든 거래 + 예산',
      expense: '지출 거래',
      income: '수입 거래',
      plans: '계획안 + 카테고리',
    };
    if (!confirm(`${labels[target]} 데이터를 삭제하시겠습니까?`)) return;

    if (target === 'all') {
      await db.transactions.clear();
      await db.budgets.clear();
    } else if (target === 'expense') {
      await db.transactions.where('type').equals('expense').delete();
    } else if (target === 'income') {
      await db.transactions.where('type').equals('income').delete();
    } else if (target === 'plans') {
      await db.budgets.delete('plan-template');
      setExpensePlans([]);
      setIncomePlans([]);
      setInitialBalance(0);
    }
    alert('삭제되었습니다.');
  };

  if (!settings) return <div className="text-gray-400">로딩 중...</div>;

  const renderPlanTable = (type: 'expense' | 'income', rows: PlanRow[]) => {
    const isExpense = type === 'expense';
    return (
      <div className="bg-white rounded-2xl border border-toss-gray-100 overflow-visible">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isExpense ? 'border-toss-red/10' : 'border-toss-green/10'}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isExpense ? 'bg-toss-red' : 'bg-toss-green'}`} />
            <h3 className={`font-bold text-sm ${isExpense ? 'text-toss-red' : 'text-toss-green'}`}>
              {isExpense ? '지출 계획' : '수입 계획'}
            </h3>
            <span className="text-xs text-toss-gray-400 bg-toss-gray-100 px-2 py-0.5 rounded-full">{rows.length}개</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setPhotoTarget(type); setTimeout(() => photoRef.current?.click(), 0); }}
              disabled={photoProcessing}
              className="text-xs text-toss-blue hover:text-toss-blue-dark font-semibold"
            >
              {photoProcessing && photoTarget === type ? '분석 중...' : '사진 분석'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_110px_28px] gap-2 px-4 py-1.5 bg-toss-gray-50 text-[11px] font-semibold text-toss-gray-400 border-b border-toss-gray-100">
          <span>카테고리</span>
          <span className="text-right">계획 금액</span>
          <span></span>
        </div>

        <div className="divide-y divide-toss-gray-50">
          {rows.map((row, idx) => (
            <div key={idx} className={`grid grid-cols-[1fr_110px_28px] gap-2 px-4 py-1 items-center group ${idx % 2 === 1 ? 'bg-toss-gray-50/30' : ''}`}>
              <input type="text" value={row.category}
                onChange={(e) => updatePlanRow(type, idx, 'category', e.target.value)}
                onPaste={(e) => handlePlanPaste(type, e, idx)}
                placeholder="카테고리명"
                className="!text-xs !py-1.5 !px-2 !rounded-lg" />
              <input type="number" value={row.amount || ''}
                onChange={(e) => updatePlanRow(type, idx, 'amount', parseInt(e.target.value) || 0)}
                onPaste={(e) => handlePlanPaste(type, e, idx)}
                placeholder="0"
                className="!text-xs !py-1.5 !px-2 !rounded-lg text-right !font-semibold" />
              <button onClick={() => removePlanRow(type, idx)}
                className="text-toss-gray-200 hover:text-toss-red transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>

        {/* + 버튼 */}
        <button onClick={() => addPlanRow(type)}
          className={`w-full py-2.5 border-t-2 border-dashed transition-all flex items-center justify-center rounded-b-2xl ${
            isExpense
              ? 'border-toss-red/15 text-toss-red/30 hover:bg-toss-red-light hover:text-toss-red/60'
              : 'border-toss-green/15 text-toss-green/30 hover:bg-toss-green-light hover:text-toss-green/60'
          }`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 가이드 */}
      <SettingsGuide />

      {/* 초기 잔고 */}
      <div className="bg-white rounded-2xl border border-toss-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-toss-gray-800">초기 잔고</h2>
            <p className="text-[11px] text-toss-gray-400 mt-0.5">회계 시작 시점의 잔고를 입력하세요</p>
          </div>
          <input type="number" value={initialBalance || ''}
            onChange={(e) => setInitialBalance(parseInt(e.target.value) || 0)}
            placeholder="0" className="!text-sm !rounded-xl !font-bold text-right w-40" />
        </div>
      </div>

      {/* 계획안 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-toss-gray-900">계획안 설정</h2>
          <button onClick={savePlans}
            className="bg-toss-blue text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-toss-blue-dark transition-colors shadow-sm shadow-toss-blue/20">
            저장
          </button>
        </div>

        <div className="space-y-4">
          {renderPlanTable('expense', expensePlans)}
          {renderPlanTable('income', incomePlans)}
        </div>
      </div>

      {/* 사진 분석용 숨겨진 인풋 */}
      <input ref={photoRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoAnalysis(file); e.target.value = ''; }} />

      {/* Claude API */}
      <div className="bg-white rounded-2xl border border-toss-gray-100 p-5">
        <h2 className="text-sm font-bold text-toss-gray-800 mb-3">Claude API</h2>
        <div className="flex gap-2">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..." className="flex-1 !text-sm !rounded-xl" />
          <button onClick={saveApiKey}
            className="bg-toss-blue text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-toss-blue-dark transition-colors">
            저장
          </button>
        </div>
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white rounded-2xl border border-toss-red/20 p-5 space-y-3">
        <h2 className="text-sm font-bold text-toss-red">데이터 초기화</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => clearData('expense')}
            className="py-2 rounded-xl text-xs font-semibold border border-toss-red/20 text-toss-red hover:bg-toss-red-light transition-colors">
            지출 데이터
          </button>
          <button onClick={() => clearData('income')}
            className="py-2 rounded-xl text-xs font-semibold border border-toss-red/20 text-toss-red hover:bg-toss-red-light transition-colors">
            수입 데이터
          </button>
          <button onClick={() => clearData('plans')}
            className="py-2 rounded-xl text-xs font-semibold border border-toss-red/20 text-toss-red hover:bg-toss-red-light transition-colors">
            계획안
          </button>
          <button onClick={() => clearData('all')}
            className="py-2 rounded-xl text-xs font-bold bg-toss-red text-white hover:bg-red-600 transition-colors">
            전체 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
