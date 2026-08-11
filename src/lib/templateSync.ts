import { listFilesInFolder, readFileContent, createFile, updateFile } from './drive';

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: string[];
  timestamp: number;
  isDeleted?: boolean;
}

const TEMPLATES_FILE_NAME = 'syncapp_checklist_templates.json';

export async function syncTemplates(
  token: string,
  folderId: string,
  localTemplates: ChecklistTemplate[]
): Promise<ChecklistTemplate[]> {
  const files = await listFilesInFolder(token, folderId);
  const fileInfo = files.find(f => f.name === TEMPLATES_FILE_NAME);
  
  let remoteTemplates: ChecklistTemplate[] = [];
  
  if (fileInfo) {
    const content = await readFileContent(token, fileInfo.id);
    try {
      remoteTemplates = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse remote templates', e);
      remoteTemplates = [];
    }
  }

  const recordMap = new Map<string, ChecklistTemplate>();
  
  for (const record of remoteTemplates) {
    recordMap.set(record.id, record);
  }
  
  let hasLocalChanges = false;
  
  for (const local of localTemplates) {
    const existing = recordMap.get(local.id);
    if (!existing || local.timestamp > existing.timestamp) {
      recordMap.set(local.id, local);
      hasLocalChanges = true;
    }
  }
  
  const mergedTemplates = Array.from(recordMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  if (hasLocalChanges) {
    const mergedJson = JSON.stringify(mergedTemplates, null, 2);
    if (fileInfo) {
      await updateFile(token, fileInfo.id, mergedJson, 'application/json');
    } else {
      await createFile(token, folderId, TEMPLATES_FILE_NAME, mergedJson, 'application/json');
    }
  }

  return mergedTemplates;
}
