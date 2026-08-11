import { listFilesInFolder, readFileContent, createFile, updateFile } from './drive';

export interface FoodPlace {
  id: string;
  name: string;
  note?: string;
  url?: string;
}

export interface FoodList {
  id: string;
  name: string;
  places: FoodPlace[];
  timestamp: number;
  isDeleted?: boolean;
}

const FOOD_LISTS_FILE_NAME = 'syncapp_food_lists.json';

export async function syncFoodLists(
  token: string,
  folderId: string,
  localLists: FoodList[]
): Promise<FoodList[]> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === FOOD_LISTS_FILE_NAME);
  
  let remoteLists: FoodList[] = [];
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      remoteLists = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse remote food lists', e);
      remoteLists = [];
    }
  }

  const recordMap = new Map<string, FoodList>();
  
  for (const record of remoteLists) {
    recordMap.set(record.id, record);
  }
  
  let hasLocalChanges = false;
  
  for (const local of localLists) {
    const existing = recordMap.get(local.id);
    if (!existing || local.timestamp > existing.timestamp) {
      recordMap.set(local.id, local);
      hasLocalChanges = true;
    }
  }
  
  const mergedLists = Array.from(recordMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  if (hasLocalChanges) {
    const mergedJson = JSON.stringify(mergedLists, null, 2);
    if (fileInfo) {
      await updateFile(token, fileInfo.id, mergedJson, 'application/json');
    } else {
      await createFile(token, folderId, FOOD_LISTS_FILE_NAME, mergedJson, 'application/json');
    }
  }

  return mergedLists;
}
