import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

interface Props {
  value: string;       // YYYY-MM-DD
  valueEnd?: string;   // YYYY-MM-DD (범위 종료)
  onChange: (start: string, end: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
}

const toDate = (s: string) => s ? new Date(s + 'T00:00:00') : undefined;
const toStr = (d: Date | undefined) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

const formatDisplay = (start: string, end: string) => {
  if (!start) return '';
  const s = start.substring(5).replace('-', '/');
  if (!end || end === start) return s;
  const e = end.substring(5).replace('-', '/');
  return `${s} ~ ${e}`;
};

export default function DatePicker({ value, valueEnd, onChange, onPaste }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: toDate(value),
    to: toDate(valueEnd || value),
  }));
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRange({ from: toDate(value), to: toDate(valueEnd || value) });
  }, [value, valueEnd]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (selected: DateRange | undefined) => {
    setRange(selected);
    if (selected?.from) {
      const start = toStr(selected.from);
      const end = selected.to ? toStr(selected.to) : '';
      onChange(start, end === start ? '' : end);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onPaste={onPaste}
        className="w-full text-left !text-xs !py-1.5 !px-2 !rounded-lg border border-toss-gray-200 bg-white hover:border-toss-blue/50 transition-colors flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-toss-gray-300 shrink-0">
          <rect x="1.5" y="2.5" width="11" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1.5 5.5h11M4.5 1v2.5M9.5 1v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className={value ? 'text-toss-gray-800 font-medium' : 'text-toss-gray-300'}>
          {value ? formatDisplay(value, valueEnd || '') : '날짜 선택'}
        </span>
      </button>

      {open && (
        <div className="absolute z-[100] top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-toss-gray-200 p-2">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            locale={undefined}
            formatters={{
              formatWeekdayName: (d) => ['일','월','화','수','목','금','토'][d.getDay()],
              formatCaption: (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
            }}
            classNames={{
              root: 'text-sm',
              day: 'w-8 h-8 rounded-lg text-xs hover:bg-toss-blue-light transition-colors',
              selected: '!bg-toss-blue !text-white',
              range_start: '!bg-toss-blue !text-white !rounded-l-lg',
              range_end: '!bg-toss-blue !text-white !rounded-r-lg',
              range_middle: '!bg-toss-blue-light !text-toss-blue',
              today: 'font-bold text-toss-blue',
              chevron: 'fill-toss-gray-400',
            }}
          />
          <div className="flex justify-between items-center px-2 pb-1 pt-1 border-t border-toss-gray-100">
            <button onClick={() => { onChange(value, ''); setOpen(false); }}
              className="text-[11px] text-toss-gray-400 hover:text-toss-gray-600">단일 날짜</button>
            <button onClick={() => setOpen(false)}
              className="text-[11px] font-bold text-toss-blue hover:text-toss-blue-dark">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
