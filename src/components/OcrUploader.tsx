import { useState, useRef } from 'react';

interface Props {
  onResult: (data: { date?: string; amount?: string; description?: string }) => void;
}

interface UploadedFile {
  id: number;
  name: string;
  dataUrl: string;
  type: 'image' | 'pdf';
}

let fileIdSeq = 0;

export default function OcrUploader({ onResult }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFiles((prev) => [
          ...prev,
          {
            id: ++fileIdSeq,
            name: file.name,
            dataUrl: reader.result as string,
            type: file.type === 'application/pdf' ? 'pdf' : 'image',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (id: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    dropRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const processAll = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setResults([]);

    const settings = await (await import('../lib/db')).getSettings();
    const apiKey = settings.claudeApiKey || import.meta.env.VITE_CLAUDE_API_KEY;
    if (!apiKey) { setResults(['오류: API 키가 없습니다.']); setProcessing(false); return; }

    const model = highAccuracy ? 'claude-sonnet-4-6-20250514' : 'claude-haiku-4-5-20251001';
    const prompt = '이 영수증/거래내역에서 다음 정보를 JSON으로 추출해주세요:\n- date: 날짜 (YYYY-MM-DD 형식)\n- amount: 금액 (숫자만)\n- description: 사용처/설명\n\n여러 건이면 JSON 배열로 응답해주세요.\n예: [{"date":"2025-04-07","amount":"45000","description":"신시아 후원"}]\n단일 건이면 단일 객체도 OK.';

    const allResults: string[] = [];

    for (const file of files) {
      try {
        const base64 = file.dataUrl.split(',')[1];
        const mediaType = file.dataUrl.split(';')[0].split(':')[1];

        const contentBlock = file.type === 'pdf'
          ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
          : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg', data: base64 } };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
            messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: prompt }] }],
          }),
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error.message);
        const text = result.content?.[0]?.text || '';
        allResults.push(`[${file.name}] ${text}`);

        // 결과 파싱 → onResult 호출
        const parsed = parseResponse(text);
        parsed.forEach((p) => onResult(p));
      } catch (err) {
        allResults.push(`[${file.name}] 오류: ${err instanceof Error ? err.message : '알 수 없음'}`);
      }
    }

    setResults(allResults);
    setProcessing(false);
  };

  const parseResponse = (text: string): { date?: string; amount?: string; description?: string }[] => {
    // 배열 파싱 시도
    try {
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const arr = JSON.parse(arrMatch[0]);
        return arr.map((item: Record<string, unknown>) => ({
          date: (item.date as string) || undefined,
          amount: item.amount?.toString() || undefined,
          description: (item.description as string) || undefined,
        }));
      }
    } catch { /* fallback */ }

    // 단일 객체
    try {
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const obj = JSON.parse(objMatch[0]);
        return [{
          date: obj.date || undefined,
          amount: obj.amount?.toString() || undefined,
          description: obj.description || undefined,
        }];
      }
    } catch { /* fallback */ }

    return [];
  };

  return (
    <div className="space-y-4">
      {/* 옵션 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={highAccuracy} onChange={(e) => setHighAccuracy(e.target.checked)}
          className="rounded accent-toss-blue w-4 h-4" />
        <span className="text-sm text-toss-gray-600">정확도 향상 (Sonnet)</span>
      </label>

      {/* 드롭존 */}
      <div
        ref={dropRef}
        onClick={() => fileRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl p-6 text-center cursor-pointer transition-all border-2 border-dashed ${
          dragging
            ? 'border-toss-blue bg-toss-blue-light scale-[1.01]'
            : 'border-toss-gray-200 bg-white hover:border-toss-blue/40'
        }`}
      >
        <div className={dragging ? 'text-toss-blue' : 'text-toss-gray-400'}>
          {dragging ? (
            <p className="text-base font-semibold">여기에 놓으세요</p>
          ) : (
            <>
              <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="4" y="8" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                <path d="M14 24l4-5 3 3 5-7 6 9H14z" fill="currentColor" opacity="0.15"/>
                <circle cx="14" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
              <p className="text-sm font-medium">클릭 또는 파일을 끌어서 놓기</p>
              <p className="text-xs mt-1 text-toss-gray-300">이미지 / PDF (여러 파일 가능)</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileInput} className="hidden" />
      </div>

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-toss-gray-700">{files.length}개 파일</span>
            <button onClick={() => setFiles([])} className="text-xs text-toss-gray-400 hover:text-toss-red">전체 삭제</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {files.map((f) => (
              <div key={f.id} className="relative bg-white rounded-xl border border-toss-gray-100 overflow-hidden group">
                {f.type === 'image' ? (
                  <img src={f.dataUrl} alt={f.name} className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center bg-toss-red-light">
                    <span className="text-toss-red font-bold text-sm">PDF</span>
                  </div>
                )}
                <p className="text-[10px] text-toss-gray-500 truncate px-2 py-1">{f.name}</p>
                <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={processAll}
            disabled={processing}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all bg-toss-blue text-white hover:bg-toss-blue-dark disabled:opacity-50 shadow-lg shadow-toss-blue/20 active:scale-[0.98]"
          >
            {processing ? '분석 중...' : `${files.length}개 파일 분석하기`}
          </button>
        </div>
      )}

      {/* 결과 */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-toss-gray-100 space-y-2">
          <h3 className="text-sm font-semibold text-toss-gray-700">분석 결과</h3>
          {results.map((r, i) => (
            <pre key={i} className="text-xs text-toss-gray-600 whitespace-pre-wrap bg-toss-gray-50 rounded-xl p-3">{r}</pre>
          ))}
          <p className="text-xs text-toss-blue">결과가 입력 폼에 반영되었습니다. 확인 후 수정해주세요.</p>
        </div>
      )}
    </div>
  );
}
