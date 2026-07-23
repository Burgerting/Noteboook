import { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { verifyFolderAccess } from '../lib/drive';
import { Folder, X, Loader2, Link } from 'lucide-react';
import { useDrivePicker } from '../hooks/useDrivePicker';

interface Props {
  onClose: () => void;
  onAdd: (id: string, name: string) => void;
}

export default function FolderSelectModal({ onClose, onAdd }: Props) {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { openPicker, isPickerLoaded } = useDrivePicker(token);

  const handleSelectFromPicker = (folderId: string, folderName: string) => {
    handleVerifyAndSave(folderId, folderName);
  };

  const handleVerifyAndSave = async (folderId: string, folderName: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      const isValid = await verifyFolderAccess(token!, folderId);
      
      if (isValid) {
        onAdd(folderId, folderName.trim());
      } else {
        setError('無效的資料夾連結或權限不足。請確認您有存取該資料夾的權限。');
      }
    } catch (err) {
      setError('驗證資料夾時發生錯誤。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '2rem', width: '90%', maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>新增共用記事本</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.2rem' }}>
            <X size={20} />
          </button>
        </div>
        
        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          請選擇與您共用的 Google Drive 資料夾。系統會自動讀取資料夾的名稱。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => openPicker(handleSelectFromPicker, (err) => setError(err.message))}
            disabled={isLoading || !isPickerLoaded}
            style={{ padding: '1rem' }}
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Folder size={20} />}
            {!isPickerLoaded ? '載入 Google 元件中...' : (isLoading ? '驗證資料夾中...' : '開啟 Google Drive 選擇資料夾')}
          </button>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
