# 회계 관리 웹앱 - 작업 로그

## 프로젝트 정보
- **GitHub**: https://github.com/dnjs5024/accounting-app
- **배포 URL**: https://accounting-app-eight-mu.vercel.app
- **기술 스택**: React 18 + Vite + TypeScript + Tailwind CSS
- **데이터 저장**: IndexedDB (Dexie.js) - 브라우저 로컬
- **OCR**: Claude API (Haiku/Sonnet) - 영수증/PDF 분석
- **모바일**: Capacitor 세팅 완료 (Android)
- **배포**: Vercel (자동 빌드)

## 완료된 기능

### 1. 거래 입력 탭
- 지출/수입 분리된 테이블 (세로 배치)
- 날짜: **달력 범위 선택** (react-day-picker) - 단일/범위 모두 지원
- 금액, 설명(선택), 카테고리 한 행에 배치
- **카테고리 콤보박스**: 드롭다운 선택 + 직접 타이핑 자동 추가 + X 삭제
- **전체 카테고리 드롭박스**: 선택하면 체크된 행들 일괄 변경
- **통일 체크박스**: 기본 체크, 해제하면 일괄 변경에서 제외
- **복사 붙여넣기**: 날짜/금액/설명/카테고리 어디든 여러 줄 붙여넣기 자동 파싱
  - 전체 행: `2025년 1월 3일    ₩40,000    말씀노트    비품`
  - 금액만, 설명+카테고리, 단일 컬럼 모두 지원
- **사진/PDF 분석**: Claude API Vision으로 영수증 자동 추출
  - 여러 파일 동시 업로드 (드래그 앤 드롭)
  - Haiku(기본) / Sonnet(정확도 향상) 선택
- **Excel 가져오기**: 기존 회계 엑셀 파일 파싱
- 마지막 행 채우면 자동 빈 행 추가 + 하단 + 버튼
- 빈 행은 저장 안 됨
- **입력 가이드**: 접이식 사용법 (붙여넣기 예시 + 기능 안내)

### 2. 거래 목록 탭
- **통합 뷰**: 지출/수입 섞여서 최신순 표시 (토스 스타일 카드)
- **전체/지출/수입 탭** 전환 (세그먼트 컨트롤)
- **날짜 그룹**: "1월 3일 (금)" 형태로 묶어서 표시
- **필터**: 월별 + 카테고리 (지출/수입 optgroup 분리) + 검색
- **무한 스크롤**: 20건씩 로드, IntersectionObserver
- 각 항목: 아이콘(↓↑) + 설명/카테고리 + 금액(+/- 표시)
- 클릭 → 인라인 편집, hover → 삭제 버튼

### 3. 회계안 탭
- **전체/월별 전환**: 전체 보기 + 월 선택
- 카테고리별 계획/실제/차이 테이블
- **카테고리 이름 클릭 → 수정** (거래 데이터도 일괄 변경)
- 계획 금액 붙여넣기 지원 (₩275,000 여러 줄)
- 초기 잔고 입력 + 기말 잔고 자동 계산
- 전월 잔고 자동 계산 버튼
- **지출/수입 상세**: 페이징 10건 + 클릭 편집
- **Excel 다운로드**:
  - 전체: 전체 요약 + 전체 거래 + 월별 요약&거래 (엑셀 탭)
  - 월별: 해당 월 요약 + 거래 2시트

### 4. 설정 탭
- **사용법 가이드**: 접이식 (붙여넣기 예시 + 기능 안내)
- **초기 잔고** 입력
- **계획안 설정**: 지출/수입 카테고리 + 금액 관리
  - 복사 붙여넣기 (카테고리+금액)
  - 사진 분석으로 자동 세팅
  - + 버튼으로 추가
- **Claude API 키** 설정 (환경변수 기본값 + 변경 가능)
- **데이터 초기화**: 지출/수입/계획안/전체 개별 선택

### 5. 디자인
- **토스 스타일**: 둥근 카드, 파란 액센트, 깔끔한 타이포
- **모바일 최적화**: 하단 탭바, 반응형 레이아웃
- **PC**: 상단 헤더 + 필 버튼 탭

## 기술 상세

### 주요 파일
```
src/
├── App.tsx                    # 탭 라우팅
├── components/
│   ├── Layout.tsx             # 헤더 + 탭바 (PC/모바일)
│   ├── TransactionForm.tsx    # 거래 입력
│   ├── TransactionList.tsx    # 거래 목록
│   ├── MonthlyReport.tsx      # 회계안
│   ├── Settings.tsx           # 설정
│   ├── CategoryCombobox.tsx   # 카테고리 드롭다운+입력
│   ├── DatePicker.tsx         # 달력 범위 선택
│   ├── OcrUploader.tsx        # 사진/PDF 분석
│   └── ExcelImporter.tsx      # Excel 가져오기
├── lib/
│   ├── db.ts                  # IndexedDB (Dexie)
│   ├── excel.ts               # Excel 생성/다운로드
│   ├── paste-parser.ts        # 붙여넣기 파싱
│   └── utils.ts               # 유틸리티
├── hooks/
│   └── useTransactions.ts     # 거래 CRUD
├── types/
│   └── index.ts               # 타입 정의
└── index.css                  # 토스 테마 + 글로벌 스타일
```

### 환경변수
```
VITE_CLAUDE_API_KEY=sk-ant-...  # .env 파일
```

### 배포
```bash
npm run build && git add -A && git commit -m "메시지" && git push && vercel --prod --yes
```

### Capacitor (모바일 앱)
```bash
npm run build
npx cap sync android
npx cap open android   # Android Studio 필요
```

## 미완료 / 추후 작업
- 회계안 탭 토스 스타일 적용 (현재 기본 스타일)
- 거래 목록 편집 시 카테고리 콤보박스 적용
- 데이터 백업/복원 (JSON export/import)
- PWA 설정 (오프라인 지원)
- Capacitor 실제 빌드 테스트
