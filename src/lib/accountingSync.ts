import { listFilesInFolder, readFileContent, createFile, updateFile } from './drive';

export interface AccountingRecord {
  id: string; // Unique ID, e.g., uuid or timestamp + random
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  timestamp: number; // For merging resolution
  isFixed?: boolean;
  isCreditCard?: boolean;
}

// Generate filename based on date (e.g., "2026-07-accounting.json")
export function getMonthFileName(dateStr: string) {
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-accounting.json`;
}

// Sync function: fetches remote data, merges with local, and saves back if changed
export async function syncAccountingRecords(
  token: string, 
  folderId: string, 
  monthFileName: string, 
  localRecords: AccountingRecord[]
): Promise<AccountingRecord[]> {
  
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === monthFileName);
  
  let remoteRecords: AccountingRecord[] = [];
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      remoteRecords = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse remote records', e);
      remoteRecords = [];
    }
  }

  // Merge logic: Combine all unique IDs. If duplicate ID, pick the one with the latest timestamp.
  const recordMap = new Map<string, AccountingRecord>();
  
  for (const record of remoteRecords) {
    recordMap.set(record.id, record);
  }
  
  let hasLocalChanges = false;
  
  for (const local of localRecords) {
    const existing = recordMap.get(local.id);
    if (!existing || local.timestamp > existing.timestamp) {
      recordMap.set(local.id, local);
      hasLocalChanges = true;
    }
  }
  
  const mergedRecords = Array.from(recordMap.values()).sort((a, b) => {
    // Sort by date (descending), then by timestamp (descending)
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.timestamp - a.timestamp;
  });

  // If local had newer changes or new records, we need to upload the merged result
  if (hasLocalChanges) {
    const mergedJson = JSON.stringify(mergedRecords, null, 2);
    if (fileInfo) {
      await updateFile(token, fileInfo.id, mergedJson, 'application/json');
    } else {
      await createFile(token, folderId, monthFileName, mergedJson, 'application/json');
    }
  }

  return mergedRecords;
}

export interface FixedExpense {
  id: string;
  category: string;
  note: string;
  amount: number;
}

export async function getFixedExpenses(token: string, folderId: string): Promise<FixedExpense[]> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === 'fixed_expenses.json');
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse fixed expenses', e);
      return [];
    }
  }
  return [];
}

export async function saveFixedExpenses(token: string, folderId: string, expenses: FixedExpense[]): Promise<void> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === 'fixed_expenses.json');
  const jsonContent = JSON.stringify(expenses, null, 2);
  
  if (fileInfo) {
    await updateFile(token, fileInfo.id, jsonContent, 'application/json');
  } else {
    await createFile(token, folderId, 'fixed_expenses.json', jsonContent, 'application/json');
  }
}

export interface CreditCardRecord {
  id: string;
  yearMonth: string; // YYYY-MM
  bank: string;
  amount: number;
  note: string;
  timestamp: number;
  isDeleted?: boolean;
}

export async function syncCreditCards(
  token: string,
  folderId: string,
  localRecords: CreditCardRecord[]
): Promise<CreditCardRecord[]> {
  
  const fileName = 'credit_cards.json';
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === fileName);
  
  let remoteRecords: CreditCardRecord[] = [];
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      remoteRecords = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse remote credit cards', e);
      remoteRecords = [];
    }
  }

  // Merge logic: Combine all unique IDs. If duplicate ID, pick the one with the latest timestamp.
  const recordMap = new Map<string, CreditCardRecord>();
  
  for (const record of remoteRecords) {
    recordMap.set(record.id, record);
  }
  
  let hasLocalChanges = false;
  
  for (const local of localRecords) {
    const existing = recordMap.get(local.id);
    if (!existing || local.timestamp > existing.timestamp) {
      recordMap.set(local.id, local);
      hasLocalChanges = true;
    }
  }
  
  const mergedRecords = Array.from(recordMap.values()).sort((a, b) => {
    // Sort by yearMonth (descending), then by timestamp (descending)
    if (a.yearMonth !== b.yearMonth) return b.yearMonth.localeCompare(a.yearMonth);
    return b.timestamp - a.timestamp;
  });

  if (hasLocalChanges) {
    const mergedJson = JSON.stringify(mergedRecords, null, 2);
    if (fileInfo) {
      await updateFile(token, fileInfo.id, mergedJson, 'application/json');
    } else {
      await createFile(token, folderId, fileName, mergedJson, 'application/json');
    }
  }

  return mergedRecords;
}
