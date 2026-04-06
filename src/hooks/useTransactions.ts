import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Transaction } from '../types';
import { generateId } from '../lib/utils';

export function useTransactions(filters?: {
  month?: string;
  type?: 'income' | 'expense';
  category?: string;
}) {
  const transactions = useLiveQuery(async () => {
    let collection = db.transactions.orderBy('date');
    const all = await collection.toArray();

    return all.filter((t) => {
      if (filters?.month && !t.date.startsWith(filters.month)) return false;
      if (filters?.type && t.type !== filters.type) return false;
      if (filters?.category && t.category !== filters.category) return false;
      return true;
    });
  }, [filters?.month, filters?.type, filters?.category]);

  return transactions ?? [];
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'createdAt'>
) {
  const transaction: Transaction = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  await db.transactions.add(transaction);
  return transaction;
}

export async function updateTransaction(
  id: string,
  data: Partial<Transaction>
) {
  await db.transactions.update(id, data);
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

export async function bulkAddTransactions(
  items: Omit<Transaction, 'id' | 'createdAt'>[]
) {
  const transactions: Transaction[] = items.map((item) => ({
    ...item,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }));
  await db.transactions.bulkAdd(transactions);
  return transactions;
}
