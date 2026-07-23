import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface SharedFolder {
  id: string;
  originalName: string;
  customName?: string;
}

interface AuthContextType {
  token: string | null;
  personalFolderId: string | null;
  sharedFolders: SharedFolder[];
  activeFolderId: string | null; // Currently selected notebook
  
  setToken: (token: string | null) => void;
  setPersonalFolderId: (id: string | null) => void;
  setActiveFolderId: (id: string | null) => void;
  addSharedFolder: (id: string, originalName: string) => void;
  renameSharedFolder: (id: string, newName: string) => void;
  removeSharedFolder: (id: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [personalFolderId, setPersonalFolderIdState] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderIdState] = useState<string | null>(null);
  const [sharedFolders, setSharedFoldersState] = useState<SharedFolder[]>([]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('google_token');
    const savedPersonal = localStorage.getItem('personal_folder_id');
    const savedActive = localStorage.getItem('active_folder_id');
    const savedShared = localStorage.getItem('shared_folders');

    if (savedToken) setTokenState(savedToken);
    if (savedPersonal) setPersonalFolderIdState(savedPersonal);
    if (savedActive) setActiveFolderIdState(savedActive);
    if (savedShared) {
      try {
        setSharedFoldersState(JSON.parse(savedShared));
      } catch (e) {
        console.error('Failed to parse shared folders', e);
      }
    }
  }, []);

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('google_token', newToken);
    } else {
      localStorage.removeItem('google_token');
    }
  };

  const setPersonalFolderId = (id: string | null) => {
    setPersonalFolderIdState(id);
    if (id) {
      localStorage.setItem('personal_folder_id', id);
      // Auto-select personal folder if no active folder is set
      if (!activeFolderId) setActiveFolderId(id);
    } else {
      localStorage.removeItem('personal_folder_id');
    }
  };

  const setActiveFolderId = (id: string | null) => {
    setActiveFolderIdState(id);
    if (id) {
      localStorage.setItem('active_folder_id', id);
    } else {
      localStorage.removeItem('active_folder_id');
    }
  };

  const addSharedFolder = (id: string, originalName: string) => {
    setSharedFoldersState(prev => {
      if (prev.find(f => f.id === id)) return prev;
      const newList = [...prev, { id, originalName }];
      localStorage.setItem('shared_folders', JSON.stringify(newList));
      return newList;
    });
    setActiveFolderId(id); // Auto-switch to newly added folder
  };

  const renameSharedFolder = (id: string, newName: string) => {
    setSharedFoldersState(prev => {
      const newList = prev.map(f => f.id === id ? { ...f, customName: newName } : f);
      localStorage.setItem('shared_folders', JSON.stringify(newList));
      return newList;
    });
  };

  const removeSharedFolder = (id: string) => {
    setSharedFoldersState(prev => {
      const newList = prev.filter(f => f.id !== id);
      localStorage.setItem('shared_folders', JSON.stringify(newList));
      return newList;
    });
    if (activeFolderId === id) {
      setActiveFolderId(personalFolderId); // Fallback to personal
    }
  };

  const logout = () => {
    setToken(null);
    setPersonalFolderId(null);
    setActiveFolderId(null);
    // setSharedFoldersState([]);
    localStorage.removeItem('personal_folder_id');
    localStorage.removeItem('active_folder_id');
    // localStorage.removeItem('shared_folders');
    // NOTE: We do not clear shared folders on logout so they persist for the user.
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      personalFolderId, 
      sharedFolders, 
      activeFolderId,
      setToken, 
      setPersonalFolderId,
      setActiveFolderId,
      addSharedFolder,
      renameSharedFolder,
      removeSharedFolder,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
