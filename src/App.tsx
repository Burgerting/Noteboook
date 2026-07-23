import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import Login from './components/Login';
import NotesApp from './components/notes/NotesApp';
import AccountingApp from './components/accounting/AccountingApp';
import { BookText, Calculator, Loader2, LogOut, Home, Users, FolderPlus, Edit2, X, Menu } from 'lucide-react';
import { getOrCreatePersonalFolder } from './lib/drive';
import FolderSelectModal from './components/FolderSelect';

function MainApp() {
  const { 
    token, 
    personalFolderId, 
    setPersonalFolderId, 
    logout,
    activeFolderId, 
    sharedFolders, 
    setActiveFolderId, 
    addSharedFolder, 
    renameSharedFolder, 
    removeSharedFolder
  } = useAuth();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const activeApp = location.pathname.startsWith('/accounting') ? 'accounting' : 'notes';
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const closeSidebar = () => setIsSidebarOpen(false);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  useEffect(() => {
    if (token && !personalFolderId && !isInitializing) {
      setIsInitializing(true);
      getOrCreatePersonalFolder(token)
        .then((id) => {
          setPersonalFolderId(id);
        })
        .catch(err => {
          console.error('Failed to initialize personal folder', err);
          alert('無法初始化個人資料夾，請重新登入');
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, [token, personalFolderId, isInitializing, setPersonalFolderId]);

  const saveFolderName = (id: string) => {
    if (editFolderName.trim()) {
      renameSharedFolder(id, editFolderName.trim());
    }
    setEditingFolderId(null);
  };

  if (isInitializing || !personalFolderId) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
        <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
        <span style={{ marginLeft: '1rem', fontSize: '1.2rem' }}>初始化您的個人空間...</span>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {showFolderModal && (
        <FolderSelectModal 
          onClose={() => setShowFolderModal(false)}
          onAdd={(id, name) => {
            addSharedFolder(id, name);
            setShowFolderModal(false);
          }}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      {/* Global Sidebar */}
      <div className={`global-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '1.5rem', margin: 0, fontWeight: 800, 
            background: 'linear-gradient(to right, #60a5fa, #3b82f6)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.05em'
          }}>
            SyncApp
          </h1>
        </div>

        {/* Personal Section */}
        <div style={{ padding: '0 0.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ padding: '0 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>私人空間</h3>
          <div 
            className={`sidebar-item ${activeFolderId === personalFolderId ? 'active' : ''}`}
            onClick={() => { setActiveFolderId(personalFolderId); closeSidebar(); }}
          >
            <Home size={18} />
            <span style={{ fontWeight: 500 }}>我的專屬空間</span>
          </div>
        </div>

        {/* Shared Section */}
        <div style={{ padding: '0 0.5rem', flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 1rem' }}>
            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', margin: 0 }}>與他人共用</h3>
            <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setShowFolderModal(true)} title="新增共用空間">
              <FolderPlus size={16} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {sharedFolders.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>尚未加入任何共用空間</div>
            ) : (
              sharedFolders.map(folder => (
                <div 
                  key={folder.id} 
                  className={`sidebar-item ${activeFolderId === folder.id ? 'active' : ''}`}
                  onClick={() => {
                    if (editingFolderId !== folder.id) {
                      setActiveFolderId(folder.id);
                      closeSidebar();
                    }
                  }}
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <Users size={16} />
                    {editingFolderId === folder.id ? (
                      <input
                        autoFocus
                        value={editFolderName}
                        onChange={e => setEditFolderName(e.target.value)}
                        onBlur={() => saveFolderName(folder.id)}
                        onKeyDown={e => e.key === 'Enter' && saveFolderName(folder.id)}
                        style={{ width: '100px', padding: '4px', fontSize: '0.9rem', color: '#000', borderRadius: '4px', border: 'none' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                        {folder.customName || folder.originalName}
                      </span>
                    )}
                  </div>
                  {activeFolderId === folder.id && editingFolderId !== folder.id && (
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button className="btn btn-ghost" style={{ padding: '0.1rem', color: '#fff', opacity: 0.8 }} onClick={(e) => { e.stopPropagation(); setEditFolderName(folder.customName || folder.originalName); setEditingFolderId(folder.id); }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '0.1rem', color: '#fff', opacity: 0.8 }} onClick={(e) => { e.stopPropagation(); if (confirm('確定要移除此共用空間嗎？這不會刪除雲端檔案。')) removeSharedFolder(folder.id); }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="main-area">
        {/* Top Navbar */}
        <nav className="top-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn btn-ghost mobile-menu-btn" 
              onClick={() => setIsSidebarOpen(true)}
              style={{ padding: '0.5rem', margin: '-0.5rem 0' }}
            >
              <Menu size={24} />
            </button>
            <div className="nav-tabs">
              <button 
                className={`nav-tab ${activeApp === 'notes' ? 'active' : ''}`}
                onClick={() => { navigate('/notes'); closeSidebar(); }}
              >
                <BookText size={18} /> 記事本
              </button>
              <button 
                className={`nav-tab ${activeApp === 'accounting' ? 'active' : ''}`}
                onClick={() => { navigate('/accounting'); closeSidebar(); }}
              >
                <Calculator size={18} /> 記帳本
              </button>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={logout} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <LogOut size={16} /> 登出
          </button>
        </nav>

        {/* App Content */}
        <div className="app-content">
          {activeApp === 'notes' ? (
            <NotesApp key={activeFolderId} />
          ) : (
            <AccountingApp key={activeFolderId} />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const { token } = useAuth();
  return token ? <MainApp /> : <Login />;
}

export default App;
