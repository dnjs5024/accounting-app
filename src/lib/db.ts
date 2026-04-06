import Dexie, { type Table } from 'dexie';
import type { Transaction, MonthlyBudget, AppSettings } from '../types';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../types';

class AccountingDB extends Dexie {
  transactions!: Table<Transaction, string>;
  budgets!: Table<MonthlyBudget, string>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('AccountingDB');
    this.version(1).stores({
      transactions: 'id, date, type, category',
      budgets: 'yearMonth',
      settings: 'id',
    });
  }
}

export const db = new AccountingDB();

export async function getSettings(): Promise<AppSettings> {
  let settings = await db.settings.get(1);
  if (!settings) {
    settings = {
      id: 1,
      categories: {
        income: [...DEFAULT_INCOME_CATEGORIES],
        expense: [...DEFAULT_EXPENSE_CATEGORIES],
      },
      claudeApiKey: import.meta.env.VITE_CLAUDE_API_KEY || undefined,
    };
    await db.settings.put(settings);
  }
  return settings;
}

export async function updateSettings(settings: Partial<AppSettings>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...settings, id: 1 });
}
