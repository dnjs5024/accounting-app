import type { TabType } from '../App';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'input', label: '입력', icon: 'M12 4v16m8-8H4' },
  { id: 'list', label: '목록', icon: 'M4 6h16M4 12h16M4 18h16' },
  { id: 'report', label: '회계안', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'settings', label: '설정', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, onTabChange, children }: Props) {
  return (
    <div className="min-h-screen bg-toss-gray-50 pb-20 md:pb-0">
      {/* PC 상단 헤더 */}
      <header className="hidden md:block bg-white border-b border-toss-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-toss-gray-900 tracking-tight">회계 관리</h1>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-toss-blue text-white shadow-lg shadow-toss-blue/25'
                    : 'text-toss-gray-500 hover:bg-toss-gray-100 hover:text-toss-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 모바일 상단 타이틀 */}
      <header className="md:hidden bg-white px-5 pt-14 pb-3">
        <h1 className="text-lg font-bold text-toss-gray-900">
          {tabs.find((t) => t.id === activeTab)?.label}
        </h1>
      </header>

      {/* 본문 */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">{children}</main>

      {/* 모바일 하단 탭바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-toss-gray-200 flex z-50 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 pt-3 gap-0.5 transition-colors ${
              activeTab === tab.id ? 'text-toss-blue' : 'text-toss-gray-400'
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
