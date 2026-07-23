import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getNotesList, createNote, deleteNote } from '../../lib/notesSync';
import type { NoteItem } from '../../lib/notesSync';
import NoteEditor from './NoteEditor';
import { Plus, Trash2, FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

export default function NotesApp() {
  const { 
    token, 
    activeFolderId,
    personalFolderId
  } = useAuth();
  
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);

  const loadNotes = async () => {
    if (!token || !activeFolderId) return;
    setIsLoading(true);
    setActiveNote(null);
    try {
      const list = await getNotesList(token, activeFolderId);
      setNotes(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [token, activeFolderId]);

  const handleCreate = async () => {
    if (!token || !activeFolderId) return;
    const title = prompt('請輸入筆記標題：');
    if (!title) return;
    
    setIsCreating(true);
    try {
      const newNote = await createNote(token, activeFolderId, title, '# ' + title + '\n\n');
      setNotes([newNote, ...notes]);
      setActiveNote(newNote);
    } catch (e) {
      console.error(e);
      alert('建立筆記失敗');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('您確定要刪除這則筆記嗎？')) return;
    if (!token) return;
    
    try {
      await deleteNote(token, id);
      setNotes(notes.filter(n => n.id !== id));
      if (activeNote?.id === id) {
        setActiveNote(null);
      }
    } catch (err) {
      console.error(err);
      alert('刪除失敗');
    }
  };

  return (
    <div className="notes-layout">
      
      {/* Sub Sidebar: Note List for current Workspace */}
      <div className="glass-panel notes-sidebar">
        <div 
          style={{ padding: '1rem', borderBottom: isListExpanded ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setIsListExpanded(!isListExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isListExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {activeFolderId === personalFolderId ? '個人記事清單' : '共用記事清單'}
            </h3>
          </div>
          <button className="btn btn-primary" style={{ padding: '0.4rem' }} onClick={(e) => { e.stopPropagation(); handleCreate(); }} disabled={isCreating}>
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          </button>
        </div>
        
        {isListExpanded && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" color="var(--accent-primary)" /></div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>這個記事本目前沒有筆記。點擊上方 ➕ 建立第一篇吧！</div>
          ) : (
            notes.map(note => (
              <div 
                key={note.id}
                onClick={() => setActiveNote(note)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem',
                  cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                  backgroundColor: activeNote?.id === note.id ? 'var(--bg-secondary)' : 'transparent',
                  borderLeft: activeNote?.id === note.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  marginBottom: '0.25rem', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <FileText size={16} color={activeNote?.id === note.id ? "var(--accent-primary)" : "var(--text-secondary)"} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeNote?.id === note.id ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: activeNote?.id === note.id ? 500 : 400 }}>{note.name}</span>
                </div>
                <button 
                  className="btn btn-ghost" 
                  style={{ padding: '0.25rem', opacity: activeNote?.id === note.id ? 1 : 0.4 }} 
                  onClick={(e) => handleDelete(e, note.id)}
                >
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            ))
          )}
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="glass-panel notes-editor">
        {activeNote ? (
          <NoteEditor note={activeNote} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '1rem' }}>
            <FileText size={48} style={{ opacity: 0.2 }} />
            <p>請從左側清單選擇一則筆記，或點擊 ➕ 建立新筆記</p>
          </div>
        )}
      </div>

    </div>
  );
}
