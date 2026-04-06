import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  categories: string[];
  onChange: (value: string) => void;
  onDelete: (category: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
}

export default function CategoryCombobox({ value, categories, onChange, onDelete, onPaste }: Props) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (inputValue.trim() && inputValue !== value) onChange(inputValue.trim());
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputValue, value, onChange]);

  const filtered = categories.filter((cat) => cat.toLowerCase().includes(inputValue.toLowerCase()));

  const handleSelect = (cat: string) => { setInputValue(cat); onChange(cat); setOpen(false); };

  const handleDelete = (e: React.MouseEvent, cat: string) => {
    e.stopPropagation();
    if (confirm(`"${cat}" 카테고리를 삭제하시겠습니까?`)) {
      onDelete(cat);
      if (value === cat) { setInputValue(''); onChange(''); }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); if (inputValue.trim()) { onChange(inputValue.trim()); setOpen(false); } }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder="직접 입력"
          className="w-full !text-sm !rounded-xl !border-toss-gray-200 !pr-7"
        />
        <button type="button" onClick={() => setOpen(!open)} tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-toss-gray-300 hover:text-toss-gray-500">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-toss-gray-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((cat) => (
            <div key={cat} onClick={() => handleSelect(cat)}
              className="flex items-center px-3 py-2.5 hover:bg-toss-blue-light cursor-pointer group transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <span className="text-sm text-toss-gray-800 truncate flex-1">{cat}</span>
              <button onClick={(e) => handleDelete(e, cat)}
                className="text-toss-gray-300 hover:text-toss-red text-xs font-bold ml-2 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )) : inputValue.trim() ? (
            <div onClick={() => handleSelect(inputValue.trim())}
              className="px-3 py-2.5 text-sm text-toss-blue cursor-pointer hover:bg-toss-blue-light rounded-2xl font-medium">
              + "{inputValue.trim()}" 추가
            </div>
          ) : (
            <div className="px-3 py-2.5 text-sm text-toss-gray-400">카테고리 없음</div>
          )}
        </div>
      )}
    </div>
  );
}
