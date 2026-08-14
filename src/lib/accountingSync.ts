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
  creator?: string;
  isDeleted?: boolean;
}

export interface ChartOption {
  id: string;
  keyword: string;
  matchType: 'category' | 'note';
  enabled: boolean;
}


// Generate filename based on date (e.g., "2026-07-accounting.json")
export function getMonthFileName(dateStr: string) {
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-accounting.json`;
}

// Sync function for all months: fetches all remote monthly accounting files (*-accounting.json)
export async function syncAllAccountingRecords(
  token: string,
  folderId: string,
  localRecords: AccountingRecord[] = []
): Promise<AccountingRecord[]> {
  const files = await listFilesInFolder(token, folderId);
  const accountingFiles = files.filter(f => f.name.endsWith('-accounting.json'));

  const fileContents = await Promise.all(
    accountingFiles.map(async (fileInfo) => {
      try {
        const content = await readFileContent(token, fileInfo.id);
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Failed to parse remote records from', fileInfo.name, e);
        return [];
      }
    })
  );

  const remoteRecords: AccountingRecord[] = fileContents.flat();

  // Merge logic: Combine all unique IDs. If duplicate ID, pick the one with the latest timestamp.
  const recordMap = new Map<string, AccountingRecord>();

  for (const record of remoteRecords) {
    if (record && record.id) {
      recordMap.set(record.id, record);
    }
  }

  for (const local of localRecords) {
    if (local && local.id) {
      const existing = recordMap.get(local.id);
      if (!existing || local.timestamp > existing.timestamp) {
        recordMap.set(local.id, local);
      }
    }
  }

  const mergedRecords = Array.from(recordMap.values()).sort((a, b) => {
    // Sort by date (descending), then by timestamp (descending)
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.timestamp - a.timestamp;
  });

  return mergedRecords;
}

// Save records belonging to a specific month (e.g. "2026-07")
export async function saveMonthAccountingRecords(
  token: string,
  folderId: string,
  yearMonth: string,
  recordsForThisMonth: AccountingRecord[]
) {
  const monthFileName = `${yearMonth}-accounting.json`;
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === monthFileName);
  const jsonStr = JSON.stringify(recordsForThisMonth, null, 2);

  if (fileInfo) {
    await updateFile(token, fileInfo.id, jsonStr, 'application/json');
  } else {
    await createFile(token, folderId, monthFileName, jsonStr, 'application/json');
  }
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
  startDate?: string;     // 起始月份 (YYYY-MM)
  deductionDate?: number; // 扣款日 (1-31)
  endDate?: string;       // 結束月份 (YYYY-MM)
  creator?: string;
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

export interface Installment {
  id: string;
  category: string;
  note: string;
  totalAmount: number;
  terms: number;
  interestRate: number;
  startDate: string; // YYYY-MM
  creator?: string;
}

export async function getInstallments(token: string, folderId: string): Promise<Installment[]> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === 'installments.json');
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse installments', e);
      return [];
    }
  }
  return [];
}

export async function saveInstallments(token: string, folderId: string, installments: Installment[]): Promise<void> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === 'installments.json');
  const jsonContent = JSON.stringify(installments, null, 2);
  
  if (fileInfo) {
    await updateFile(token, fileInfo.id, jsonContent, 'application/json');
  } else {
    await createFile(token, folderId, 'installments.json', jsonContent, 'application/json');
  }
}

export interface CreditCardRecord {
  id: string;
  yearMonth: string; // YYYY-MM
  bank: string;
  amount: number;
  note: string;
  timestamp: number;
  owner?: string;
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

export async function getChartOptions(token: string, folderId: string): Promise<ChartOption[]> {
  const defaultOptions: ChartOption[] = [
    { id: 'def-1', keyword: '汽車加油', matchType: 'note', enabled: true },
    { id: 'def-2', keyword: '機車加油', matchType: 'note', enabled: true },
    { id: 'def-3', keyword: '小孩', matchType: 'category', enabled: true }
  ];

  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === 'chart_options.json');
  if (!fileInfo) return defaultOptions;
  
  const content = await readFileContent(token, fileInfo.id);
  try { 
    const parsed = JSON.parse(content); 
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Migrate old string arrays
      if (typeof parsed[0] === 'string') {
        return parsed.map((str: string, idx: number) => ({
          id: `migrated-${idx}`,
          keyword: str,
          matchType: (str === '汽車加油' || str === '機車加油') ? 'note' : 'category',
          enabled: true
        }));
      }
      return parsed as ChartOption[];
    }
    return defaultOptions;
  } catch (e) { 
    return defaultOptions; 
  }
}

export async function saveChartOptions(token: string, folderId: string, options: ChartOption[]) {
  const fileName = 'chart_options.json';
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === fileName);
  const jsonStr = JSON.stringify(options, null, 2);
  if (fileInfo) {
    await updateFile(token, fileInfo.id, jsonStr, 'application/json');
  } else {
    await createFile(token, folderId, fileName, jsonStr, 'application/json');
  }
}
