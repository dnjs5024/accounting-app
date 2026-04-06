import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { bulkAddTransactions } from '../hooks/useTransactions';
import { parseFlexibleDate } from '../lib/utils';
import type { Transaction } from '../types';

interface Props {
  onImported: () => void;
}

export default function ExcelImporter({ onImported }: Props) {
  const [preview, setPreview] = useState<Omit<Transaction, 'id' | 'createdAt'>[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];

      // Find the transaction sheet (거래, 지출&수입, etc.)
      const txSheetName = workbook.SheetNames.find(
        (name) => name.includes('거래') || name.includes('지출') || name.includes('수입')
      );
      if (!txSheetName) {
        alert('거래 데이터 시트를 찾을 수 없습니다.');
        return;
      }

      const sheet = workbook.Sheets[txSheetName];
      const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
      });

      // Find header row (contains '날짜', '금액')
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row?.some((cell) => String(cell).includes('날짜'))) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) return;

      // Parse expense columns (left side: B~E) and income columns (right side: G~J)
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        // Expense: columns 1-4 (B-E in 0-indexed with A being col 0)
        const expDate = row[1];
        const expAmount = row[2];
        const expDesc = row[3];
        const expCat = row[4];

        if (expDate && expAmount && expDesc && !String(expDesc).includes('총액') && !String(expDate).includes('총액')) {
          let dateStr: string | null = null;
          if (typeof expDate === 'number') {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(expDate);
            dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            dateStr = parseFlexibleDate(String(expDate));
          }
          if (dateStr) {
            transactions.push({
              date: dateStr,
              amount: typeof expAmount === 'number' ? expAmount : parseInt(String(expAmount).replace(/,/g, '')),
              description: String(expDesc),
              category: String(expCat || '미분류'),
              type: 'expense',
              source: 'excel',
            });
          }
        }

        // Income: columns 6-9 (G-J)
        const incDate = row[6];
        const incAmount = row[7];
        const incDesc = row[8];
        const incCat = row[9];

        if (incDate && incAmount && incDesc && !String(incDesc).includes('총액') && !String(incDate).includes('총액')) {
          let dateStr: string | null = null;
          if (typeof incDate === 'number') {
            const d = XLSX.SSF.parse_date_code(incDate);
            dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else {
            dateStr = parseFlexibleDate(String(incDate));
          }
          if (dateStr) {
            transactions.push({
              date: dateStr,
              amount: typeof incAmount === 'number' ? incAmount : parseInt(String(incAmount).replace(/,/g, '')),
              description: String(incDesc),
              category: String(incCat || '미분류'),
              type: 'income',
              source: 'excel',
            });
          }
        }
      }

      setPreview(transactions);
      setFileName(file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    await bulkAddTransactions(preview);
    setImporting(false);
    setPreview([]);
    setFileName('');
    onImported();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Excel 파일 가져오기</h2>

      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
      >
        <p className="text-gray-400">클릭하여 Excel 파일 업로드 (.xlsx)</p>
        <p className="text-sm text-gray-300 mt-1">기존 회계 파일을 그대로 가져올 수 있습니다</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) parseExcel(file);
          }}
          className="hidden"
        />
      </div>

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{fileName}</span>에서{' '}
              <span className="font-bold text-blue-600">{preview.length}건</span>의 거래를 찾았습니다.
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {importing ? '가져오는 중...' : '가져오기'}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">구분</th>
                  <th className="text-left px-3 py-2">날짜</th>
                  <th className="text-right px-3 py-2">금액</th>
                  <th className="text-left px-3 py-2">설명</th>
                  <th className="text-left px-3 py-2">카테고리</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((tx, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className={`px-3 py-1 ${tx.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                      {tx.type === 'expense' ? '지출' : '수입'}
                    </td>
                    <td className="px-3 py-1">{tx.date}</td>
                    <td className="px-3 py-1 text-right">{tx.amount.toLocaleString()}</td>
                    <td className="px-3 py-1">{tx.description}</td>
                    <td className="px-3 py-1 text-gray-500">{tx.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
