import { useState } from 'react';
import Layout from './components/Layout';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import MonthlyReport from './components/MonthlyReport';
import Settings from './components/Settings';

export type TabType = 'input' | 'list' | 'report' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('input');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'input' && <TransactionForm onSaved={() => { refresh(); }} />}
      {activeTab === 'list' && <TransactionList key={refreshKey} onChanged={refresh} />}
      {activeTab === 'report' && <MonthlyReport key={refreshKey} />}
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
}

export default App;
