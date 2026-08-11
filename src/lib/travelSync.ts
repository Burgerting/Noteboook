import { listFilesInFolder, readFileContent, createFile, updateFile } from './drive';

export interface TravelItem {
  id: string;
  time: string; // 例如 "10:00"
  title: string;
  location: string;
  locationUrl: string; // Google Maps 連結
  note: string;
}

export interface TravelDay {
  id: string;
  date: string; // YYYY-MM-DD
  items: TravelItem[];
}

export interface TravelChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

export interface TravelExpense {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  payer: string; // 誰付的錢 (分帳用)
  creator?: string; // 記錄者
  timestamp: number;
}

export interface Trip {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  budget: number;
  days: TravelDay[];
  checklists: {
    packing: TravelChecklistItem[];
    todo: TravelChecklistItem[];
  };
  expenses: TravelExpense[];
  timestamp: number;
  isDeleted?: boolean;
}

const TRAVELS_FILE_NAME = 'syncapp_travels.json';

export async function syncTravels(
  token: string,
  folderId: string,
  localTrips: Trip[]
): Promise<Trip[]> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === TRAVELS_FILE_NAME);
  
  let remoteTrips: Trip[] = [];
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      remoteTrips = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse remote trips', e);
      remoteTrips = [];
    }
  }

  // Merge logic: Combine all unique IDs. If duplicate ID, pick the one with the latest timestamp.
  const recordMap = new Map<string, Trip>();
  
  for (const record of remoteTrips) {
    recordMap.set(record.id, record);
  }
  
  let hasLocalChanges = false;
  
  for (const local of localTrips) {
    const existing = recordMap.get(local.id);
    if (!existing || local.timestamp > existing.timestamp) {
      recordMap.set(local.id, local);
      hasLocalChanges = true;
    }
  }
  
  const mergedTrips = Array.from(recordMap.values()).sort((a, b) => {
    // Sort by startDate (descending), then by timestamp (descending)
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    return b.timestamp - a.timestamp;
  });

  if (hasLocalChanges) {
    const mergedJson = JSON.stringify(mergedTrips, null, 2);
    if (fileInfo) {
      await updateFile(token, fileInfo.id, mergedJson, 'application/json');
    } else {
      await createFile(token, folderId, TRAVELS_FILE_NAME, mergedJson, 'application/json');
    }
  }

  return mergedTrips;
}
