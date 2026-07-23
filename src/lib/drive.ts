export const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

interface MockFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  content: string;
  folderId?: string;
}

function getMockFiles(): MockFile[] {
  const data = localStorage.getItem('mock_drive_files');
  if (!data) {
    const initialFiles: MockFile[] = [
      {
        id: 'mock-file-1',
        name: 'Welcome.md',
        mimeType: 'text/markdown',
        modifiedTime: new Date().toISOString(),
        content: '# Welcome to SyncApp\n\nThis is a local demo note. You can edit or delete this note, or create a new one.',
        folderId: 'mock-personal-folder'
      },
      {
        id: 'mock-file-2',
        name: 'Shopping List.md',
        mimeType: 'text/markdown',
        modifiedTime: new Date(Date.now() - 3600000).toISOString(),
        content: '# Shopping List\n\n- Milk\n- Apples\n- Coffee beans\n- Bread',
        folderId: 'mock-personal-folder'
      }
    ];
    localStorage.setItem('mock_drive_files', JSON.stringify(initialFiles));
    return initialFiles;
  }
  
  const parsed = JSON.parse(data) as MockFile[];
  let isMigrated = false;
  parsed.forEach(f => {
    if (!f.folderId) {
      f.folderId = 'mock-personal-folder'; // Assign old files to personal folder
      isMigrated = true;
    }
  });
  
  if (isMigrated) {
    localStorage.setItem('mock_drive_files', JSON.stringify(parsed));
  }
  
  return parsed;
}

function saveMockFiles(files: MockFile[]) {
  localStorage.setItem('mock_drive_files', JSON.stringify(files));
}

// Helper to make authenticated requests
async function fetchWithAuth(url: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error(`Google API Error: ${response.statusText}`);
  }
  return response;
}

// 1. List files in a specific folder
export async function listFilesInFolder(token: string, folderId: string): Promise<DriveFile[]> {
  if (token === 'mock-token') {
    const files = getMockFiles();
    const folderFiles = files.filter(f => f.folderId === folderId);
    return folderFiles.map(({ id, name, mimeType, modifiedTime }) => ({
      id,
      name,
      mimeType,
      modifiedTime
    }));
  }

  const query = `'${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`;
  
  const response = await fetchWithAuth(url, token);
  const data = await response.json();
  return data.files || [];
}

// 2. Read file content (JSON or Text)
export async function readFileContent(token: string, fileId: string): Promise<string> {
  if (token === 'mock-token') {
    const files = getMockFiles();
    const file = files.find(f => f.id === fileId);
    return file ? file.content : '';
  }

  const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
  const response = await fetchWithAuth(url, token);
  return await response.text();
}

// 3. Create a new text/json file
export async function createFile(
  token: string, 
  folderId: string, 
  name: string, 
  content: string | Blob,
  mimeType: string = 'text/plain'
): Promise<DriveFile> {
  if (token === 'mock-token') {
    const files = getMockFiles();
    
    let fileContent = '';
    if (content instanceof Blob) {
      if (mimeType.startsWith('image/')) {
        fileContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(content);
        });
      } else {
        fileContent = await content.text();
      }
    } else {
      fileContent = String(content);
    }

    const newFile: MockFile = {
      id: `mock-file-${Date.now()}`,
      name,
      mimeType,
      modifiedTime: new Date().toISOString(),
      content: fileContent,
      folderId
    };
    files.push(newFile);
    saveMockFiles(files);
    return {
      id: newFile.id,
      name: newFile.name,
      mimeType: newFile.mimeType,
      modifiedTime: newFile.modifiedTime
    };
  }

  const metadata = {
    name,
    parents: [folderId],
    mimeType
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));

  const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,modifiedTime`;
  
  const response = await fetchWithAuth(url, token, {
    method: 'POST',
    body: form
  });
  
  return await response.json();
}

// 4. Update an existing file
export async function updateFile(
  token: string, 
  fileId: string, 
  content: string,
  mimeType: string = 'text/plain'
): Promise<DriveFile> {
  if (token === 'mock-token') {
    const files = getMockFiles();
    const fileIndex = files.findIndex(f => f.id === fileId);
    const modifiedTime = new Date().toISOString();
    if (fileIndex !== -1) {
      files[fileIndex].content = content;
      files[fileIndex].modifiedTime = modifiedTime;
      saveMockFiles(files);
      return {
        id: files[fileIndex].id,
        name: files[fileIndex].name,
        mimeType: files[fileIndex].mimeType,
        modifiedTime
      };
    } else {
      throw new Error(`File not found: ${fileId}`);
    }
  }

  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime`;
  
  const response = await fetchWithAuth(url, token, {
    method: 'PATCH',
    headers: {
      'Content-Type': mimeType
    },
    body: content
  });
  
  return await response.json();
}

// 5. Delete a file (Move to trash)
export async function deleteFile(token: string, fileId: string): Promise<void> {
  if (token === 'mock-token') {
    const files = getMockFiles();
    const updated = files.filter(f => f.id !== fileId);
    saveMockFiles(updated);
    return;
  }

  const url = `${DRIVE_API_URL}/${fileId}`;
  await fetchWithAuth(url, token, { method: 'DELETE' });
}

// 6. Verify if a folder exists and is accessible
export async function verifyFolderAccess(token: string, folderId: string): Promise<boolean> {
  if (token === 'mock-token') {
    return true;
  }

  try {
    const url = `${DRIVE_API_URL}/${folderId}?fields=id,mimeType`;
    const response = await fetchWithAuth(url, token);
    const data = await response.json();
    return data.mimeType === 'application/vnd.google-apps.folder';
  } catch (error) {
    return false;
  }
}

// 7. Get or Create Personal Folder
export async function getOrCreatePersonalFolder(token: string): Promise<string> {
  if (token === 'mock-token') {
    return 'mock-personal-folder';
  }

  const query = `name = 'SyncApp_Personal' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id)`;
  
  const response = await fetchWithAuth(url, token);
  const data = await response.json();
  
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  // Create folder
  const metadata = {
    name: 'SyncApp_Personal',
    mimeType: 'application/vnd.google-apps.folder'
  };
  
  const createRes = await fetchWithAuth(DRIVE_API_URL, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  
  const createData = await createRes.json();
  return createData.id;
}
