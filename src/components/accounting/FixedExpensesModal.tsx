import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Archive, Check, Edit2, Save } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { getFixedExpenses, saveFixedExpenses } from '../../lib/accountingSync';
import type { FixedExpense } from '../../lib/accountingSync';

interface FixedExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  folderId: string;
}

export default function FixedExpensesModal({ isOpen, onClose, token, folderId }: FixedExpensesModalProps) {
  const { userInfo } = useAuth();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deductionDate, setDeductionDate] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FixedExpense>>({});

  useEffect(() => {
    if (isOpen && token && folderId) {
      loadExpenses();
      const today = new Date();
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [isOpen, token, folderId]);

  const loadExpenses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getFixedExpenses(token, folderId);
      setExpenses(data);
    } catch (err) {
      setError('讀取固定支出失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const autoSave = async (updated: FixedExpense[]) => {
    if (!token || !folderId) return;
    setIsSaving(true);
    setError('');
    try {
      await saveFixedExpenses(token, folderId, updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      setError('自動儲存至雲端失敗，請檢查網路連線');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !amount || isNaN(Number(amount))) return;
    
    const newExpense: FixedExpense = {
      id: crypto.randomUUID(),
      category: category.trim(),
      note: note.trim(),
      amount: Number(amount),
      startDate: startDate || undefined,
      deductionDate: deductionDate ? Number(deductionDate) : undefined,
      creator: userInfo?.name || undefined
    };
    
    const updated = [...expenses, newExpense];
    setExpenses(updated);
    setCategory('');
    setNote('');
    setAmount('');
    setDeductionDate('');
    
    // Auto save immediately
    await autoSave(updated);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要永久刪除此固定支出範本嗎？(不會影響過去已匯入的帳單)')) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      await autoSave(updated);
    }
  };

  const handleStop = async (id: string) => {
    const d = new Date();
    const currentYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const endDate = window.prompt('確定要停止這筆固定支出嗎？請輸入最後一次繳費的年月份 (例如: 2026-08)', currentYM);
    if (endDate && /^\d{4}-\d{2}$/.test(endDate)) {
      const updated = expenses.map(e => e.id === id ? { ...e, endDate } : e);
      setExpenses(updated);
      await autoSave(updated);
    } else if (endDate) {
      alert('格式錯誤，請輸入 YYYY-MM');
    }
  };

  const startEdit = (expense: FixedExpense) => {
    setEditingId(expense.id);
    setEditForm(expense);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updated = expenses.map(e => e.id === editingId ? { ...e, ...editForm } as FixedExpense : e);
    setExpenses(updated);
    setEditingId(null);
    await autoSave(updated);
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return b.amount - a.amount; // 同類別時金額大到小排序
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" style={{
        width: '90%',
        maxWidth: '550px',
        maxHeight: '85vh',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>管理固定支出範本</h2>
          {isSaving ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Loader2 size={14} className="animate-spin" /> 雲端儲存中...
            </span>
          ) : savedSuccess ? (
            <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Check size={14} /> 已自動儲存
            </span>
          ) : null}
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          設定每月的家庭固定開銷（如房租、車貸、管理費），<strong>新增、修改或刪除將即時自動同步，並自動套用於所有符合條件的月份中</strong>。
        </p>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

        {/* Add Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="分類 (如: 居住)" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="金額" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="項目名稱/備註 (如: 房租)" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              style={{ flex: 2, minWidth: '140px' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, minWidth: '110px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>起始年月份</span>
              <input 
                type="month" 
                className="input-field" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{ padding: '0.4rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', width: '90px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>扣款日</span>
              <input 
                type="number" 
                className="input-field" 
                placeholder="1-31" 
                value={deductionDate}
                onChange={(e) => setDeductionDate(e.target.value)}
                min="1"
                max="31"
                style={{ padding: '0.4rem' }}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ padding: '0.6rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> 新增並自動儲存
          </button>
        </form>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" />
            </div>
          ) : sortedExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              尚未設定任何固定支出
            </div>
          ) : (
            sortedExpenses.map(expense => {
              const isStopped = !!expense.endDate;
              const isEditing = editingId === expense.id;
              
              if (isEditing) {
                return (
                  <div key={expense.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="text" className="input-field" placeholder="分類" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={{ flex: 1 }} />
                      <input type="number" className="input-field" placeholder="金額" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="text" className="input-field" placeholder="備註" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} style={{ flex: 2, minWidth: '100px' }} />
                      <input type="month" className="input-field" value={editForm.startDate || ''} onChange={e => setEditForm({...editForm, startDate: e.target.value})} style={{ flex: 1, minWidth: '110px' }} />
                      <input type="number" className="input-field" placeholder="1-31日" value={editForm.deductionDate || ''} onChange={e => setEditForm({...editForm, deductionDate: Number(e.target.value)})} style={{ width: '70px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem' }}>取消</button>
                      <button onClick={saveEdit} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Save size={14}/> 儲存</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={expense.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem',
                  opacity: isStopped ? 0.5 : 1
                }}>
                  <div>
                    <strong style={{ display: 'block', textDecoration: isStopped ? 'line-through' : 'none' }}>{expense.category}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      <span>{expense.note}</span>
                      {expense.startDate && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem' }}>起始: {expense.startDate}</span>}
                      {expense.deductionDate && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem' }}>每月 {expense.deductionDate} 日扣款</span>}
                      {isStopped && <span style={{ marginLeft: '8px', color: 'var(--warning)', fontSize: '0.75rem' }}>(已於 {expense.endDate} 停止)</span>}
                      {expense.creator && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--accent-primary)', padding: '0 4px', borderRadius: '4px' }}>@{expense.creator}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.1rem' }}>${expense.amount.toLocaleString()}</span>
                    <button 
                      onClick={() => startEdit(expense)}
                      className="btn btn-ghost" 
                      style={{ padding: '0.25rem' }}
                      title="編輯此支出"
                      disabled={isStopped}
                    >
                      <Edit2 size={16} color={isStopped ? "gray" : "var(--accent-primary)"} />
                    </button>
                    <button 
                      onClick={() => handleStop(expense.id)}
                      className="btn btn-ghost" 
                      style={{ padding: '0.25rem' }}
                      title="停止/封存此支出"
                      disabled={isStopped}
                    >
                      <Archive size={16} color={isStopped ? "gray" : "var(--warning)"} />
                    </button>
                    <button 
                      onClick={() => handleDelete(expense.id)}
                      className="btn btn-ghost" 
                      style={{ padding: '0.25rem' }}
                      title="永久刪除範本"
                    >
                      <Trash2 size={16} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <button 
          className="btn btn-ghost" 
          onClick={onClose} 
          style={{ width: '100%', padding: '0.6rem' }}
        >
          完成關閉
        </button>
      </div>
    </div>
  );
}
