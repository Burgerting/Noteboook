import { listFilesInFolder, readFileContent, createFile, updateFile, deleteFile } from './drive';
import { diff_match_patch } from 'diff-match-patch';

const dmp = new diff_match_patch();

export interface NoteItem {
  id: string; // The Google Drive File ID
  name: string; // Title of the note
  content?: string; // Content of the note (fetched lazily)
  modifiedTime: string;
}

// 1. Fetch all text/markdown files in the folder (as note list)
export async function getNotesList(token: string, folderId: string): Promise<NoteItem[]> {
  const files = await listFilesInFolder(token, folderId);
  // Filter for plain text or markdown (or html if we use html)
  // For simplicity, let's say all files except the JSON accounting files are notes
  const noteFiles = files.filter(f => !f.name.endsWith('.json') && f.mimeType !== 'application/vnd.google-apps.folder');
  
  return noteFiles.map(f => ({
    id: f.id,
    name: f.name.replace('.md', ''),
    modifiedTime: f.modifiedTime || new Date().toISOString()
  }));
}

// 2. Fetch specific note content
export async function getNoteContent(token: string, fileId: string): Promise<string> {
  return await readFileContent(token, fileId);
}

// 3. Create a new note
export async function createNote(token: string, folderId: string, title: string, content: string = ''): Promise<NoteItem> {
  const file = await createFile(token, folderId, `${title}.md`, content, 'text/markdown');
  return {
    id: file.id,
    name: title,
    content,
    modifiedTime: file.modifiedTime || new Date().toISOString()
  };
}

// 4. Update an existing note with Diff-Match-Patch
// originalContent: the content when the user started editing
// newContent: the user's current local content
export async function syncNote(
  token: string, 
  fileId: string, 
  originalContent: string, 
  newContent: string
): Promise<{ mergedContent: string; serverModifiedTime: string }> {
  
  if (originalContent === newContent) {
    // No local changes, just fetch the latest if needed, or return as is.
    // To be safe, let's fetch the latest.
    const latestContent = await readFileContent(token, fileId);
    return { mergedContent: latestContent, serverModifiedTime: new Date().toISOString() }; // approximation
  }

  // Fetch the current server content
  let serverContent = '';
  try {
    serverContent = await readFileContent(token, fileId);
  } catch (e) {
    console.error('Failed to fetch server content, maybe it was deleted', e);
    serverContent = originalContent; // fallback
  }

  let finalContent = newContent;

  if (serverContent !== originalContent) {
    // Conflict! We need to merge.
    // 1. Compute diff from original -> new local
    const diffs = dmp.diff_main(originalContent, newContent);
    dmp.diff_cleanupSemantic(diffs);
    
    // 2. Create patch from diff
    const patches = dmp.patch_make(originalContent, diffs);
    
    // 3. Apply patch to the latest server content
    const [patchedText, results] = dmp.patch_apply(patches, serverContent);
    
    // Check if any patch failed
    const hasConflicts = results.some(r => r === false);
    if (hasConflicts) {
      console.warn('Some patches failed to apply cleanly. Manual review might be needed.');
    }
    
    finalContent = patchedText;
  }

  // Save the final merged content back to server
  const updatedFile = await updateFile(token, fileId, finalContent, 'text/markdown');
  
  return { 
    mergedContent: finalContent, 
    serverModifiedTime: updatedFile.modifiedTime || new Date().toISOString() 
  };
}

// 5. Delete a note
export async function deleteNote(token: string, fileId: string): Promise<void> {
  await deleteFile(token, fileId);
}
