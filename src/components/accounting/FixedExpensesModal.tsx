import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Save, Archive } from 'lucide-react';
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
  const [error, setError] = useState('');

  // Form State
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [deductionDate, setDeductionDate] = useState('');

  useEffect(() => {
    if (isOpen && token && folderId) {
      loadExpenses();
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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !amount || isNaN(Number(amount))) return;
    
    const newExpense: FixedExpense = {
      id: crypto.randomUUID(),
      category: category.trim(),
      note: note.trim(),
      amount: Number(amount),
      deductionDate: deductionDate ? Number(deductionDate) : undefined,
      creator: userInfo?.name || undefined
    };
    
    setExpenses([...expenses, newExpense]);
    setCategory('');
    setNote('');
    setAmount('');
    setDeductionDate('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定要永久刪除此固定支出範本嗎？(不會影響過去已匯入的帳單)')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const handleStop = (id: string) => {
    const d = new Date();
    const currentYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const endDate = window.prompt('確定要停止這筆固定支出嗎？請輸入最後一次繳費的年月份 (例如: 2026-08)', currentYM);
    if (endDate && /^\d{4}-\d{2}$/.test(endDate)) {
      setExpenses(expenses.map(e => e.id === id ? { ...e, endDate } : e));
    } else if (endDate) {
      alert('格式錯誤，請輸入 YYYY-MM');
    }
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return b.amount - a.amount; // 同類別時金額大到小排序
  });

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveFixedExpenses(token, folderId, expenses);
      alert('儲存成功！');
      onClose();
    } catch (err) {
      setError('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

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
        maxWidth: '500px',
        maxHeight: '80vh',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem' }}
        >
          <X size={20} />
        </button>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>管理固定支出範本</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          在此設定每月的家庭固定開銷（如房租、貸款、訂閱費）。設定後可於記帳本「一鍵匯入」當月帳單。
        </p>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

        {/* Add Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="分類 (如: 居住)" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="金額" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="項目名稱/備註 (如: 房租)" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="扣款日(選填,1-31)" 
              value={deductionDate}
              onChange={(e) => setDeductionDate(e.target.value)}
              min="1"
              max="31"
              style={{ width: '130px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
              <Plus size={18} /> 新增
            </button>
          </div>
        </form>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
              return (
                <div key={expense.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem',
                  opacity: isStopped ? 0.5 : 1
                }}>
                  <div>
                    <strong style={{ display: 'block', textDecoration: isStopped ? 'line-through' : 'none' }}>{expense.category}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {expense.note}
                      {expense.deductionDate && <span style={{ marginLeft: '8px', color: 'var(--primary)' }}>每月 {expense.deductionDate} 日扣款</span>}
                      {isStopped && <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>(已於 {expense.endDate} 停止)</span>}
                      {expense.creator && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--accent-primary)', padding: '0 4px', borderRadius: '4px' }}>@{expense.creator}</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>${expense.amount}</span>
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
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={isSaving || isLoading}
          style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
        >
          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          儲存設定
        </button>
      </div>
    </div>
  );
}
