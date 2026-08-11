import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { syncTemplates } from '../../lib/templateSync';
import type { ChecklistTemplate } from '../../lib/templateSync';
import { Plus, Trash2, Edit2, X, Save } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function TemplateManager({ onClose }: Props) {
  const { token, activeFolderId: folderId } = useAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editItems, setEditItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (!token || !folderId) return;
    setIsLoading(true);
    syncTemplates(token, folderId, [])
      .then(setTemplates)
      .finally(() => setIsLoading(false));
  }, [token, folderId]);

  const activeTemplates = templates.filter(t => !t.isDeleted);

  const handleCreateNew = () => {
    const newTemplate: ChecklistTemplate = {
      id: crypto.randomUUID(),
      name: '新清單範本',
      items: [],
      timestamp: Date.now()
    };
    const updated = [newTemplate, ...templates];
    setTemplates(updated);
    if (token && folderId) syncTemplates(token, folderId, updated);
    
    // Auto enter edit mode
    setEditingId(newTemplate.id);
    setEditName(newTemplate.name);
    setEditItems(newTemplate.items);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const updated = templates.map(t => {
      if (t.id === editingId) {
        return { ...t, name: editName, items: editItems, timestamp: Date.now() };
      }
      return t;
    });
    setTemplates(updated);
    if (token && folderId) syncTemplates(token, folderId, updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('確定要刪除此範本嗎？')) return;
    const updated = templates.map(t => 
      t.id === id ? { ...t, isDeleted: true, timestamp: Date.now() } : t
    );
    setTemplates(updated);
    if (token && folderId) syncTemplates(token, folderId, updated);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    setEditItems([...editItems, newItemText.trim()]);
    setNewItemText('');
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>清單範本管理</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>載入中...</div>
          ) : activeTemplates.length === 0 && !editingId ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              尚未建立任何範本。
            </div>
          ) : (
            activeTemplates.map(template => (
              <div key={template.id} style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {editingId === template.id ? (
                  <div>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', width: '100%', padding: '0.5rem', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                    />
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {editItems.map((item, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                          <span>{item}</span>
                          <button className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => handleRemoveItem(index)}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input 
                        type="text" 
                        value={newItemText} 
                        onChange={e => setNewItemText(e.target.value)} 
                        placeholder="新增項目..."
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '0 0.5rem' }} disabled={!newItemText.trim()}>
                        <Plus size={16} />
                      </button>
                    </form>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="btn btn-ghost" onClick={() => setEditingId(null)}>取消</button>
                      <button className="btn btn-primary" onClick={handleSaveEdit}><Save size={16} /> 儲存</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0' }}>{template.name}</h3>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        共 {template.items.length} 個項目
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-ghost" style={{ padding: '0.5rem' }} onClick={() => {
                        setEditingId(template.id);
                        setEditName(template.name);
                        setEditItems(template.items);
                      }}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-ghost" style={{ padding: '0.5rem', color: 'var(--text-secondary)' }} onClick={() => handleDelete(template.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} onClick={handleCreateNew} disabled={editingId !== null}>
            <Plus size={18} /> 建立新範本
          </button>
        </div>
      </div>
    </div>
  );
}
