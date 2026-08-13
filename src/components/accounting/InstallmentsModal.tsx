import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { getInstallments, saveInstallments } from '../../lib/accountingSync';
import type { Installment } from '../../lib/accountingSync';

interface InstallmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  folderId: string;
}

export default function InstallmentsModal({ isOpen, onClose, token, folderId }: InstallmentsModalProps) {
  const { userInfo } = useAuth();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [terms, setTerms] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (isOpen && token && folderId) {
      loadInstallments();
      // Set default start date to current month
      const today = new Date();
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [isOpen, token, folderId]);

  const loadInstallments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getInstallments(token, folderId);
      setInstallments(data);
    } catch (err) {
      setError('讀取分期設定失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const autoSave = async (updated: Installment[]) => {
    if (!token || !folderId) return;
    setIsSaving(true);
    setError('');
    try {
      await saveInstallments(token, folderId, updated);
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
    if (!category.trim() || !totalAmount || isNaN(Number(totalAmount)) || !terms || isNaN(Number(terms)) || !startDate) return;
    
    const newInstallment: Installment = {
      id: crypto.randomUUID(),
      category: category.trim(),
      note: note.trim(),
      totalAmount: Number(totalAmount),
      terms: Number(terms),
      interestRate: interestRate ? Number(interestRate) : 0,
      startDate: startDate,
      creator: userInfo?.name || undefined
    };
    
    const updated = [...installments, newInstallment];
    setInstallments(updated);
    setCategory('');
    setNote('');
    setTotalAmount('');
    setTerms('');
    setInterestRate('');
    
    // Auto-save immediately
    await autoSave(updated);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要永久刪除此分期設定嗎？(不會影響過去已匯入的帳單)')) {
      const updated = installments.filter(e => e.id !== id);
      setInstallments(updated);
      await autoSave(updated);
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>管理分期設定</h2>
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
          設定需要分期付款的項目（如手機、家電），<strong>新增或刪除將即時自動同步至雲端</strong>。設定後可一鍵匯入各期帳單。
        </p>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

        {/* Add Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="分類 (如: 設備)" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              style={{ flex: 1, minWidth: '120px' }}
            />
            <input 
              type="text" 
              className="input-field" 
              placeholder="備註/品名 (如: 買手機)" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ flex: 2, minWidth: '160px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input 
              type="number" 
              className="input-field" 
              placeholder="總金額" 
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              style={{ flex: 1, minWidth: '100px' }}
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="期數 (月)" 
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              min="1"
              required
              style={{ width: '100px' }}
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="總利息 % (選填)" 
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              step="0.1"
              min="0"
              style={{ width: '130px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>起始月份:</span>
              <input 
                type="month" 
                className="input-field" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{ flex: 1, padding: '0.4rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> 新增並自動儲存
            </button>
          </div>
        </form>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" />
            </div>
          ) : installments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              尚未設定任何分期項目
            </div>
          ) : (
            installments.map(inst => {
              const amountPerTerm = Math.round((inst.totalAmount * (1 + (inst.interestRate || 0) / 100)) / inst.terms);
              return (
                <div key={inst.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' 
                }}>
                  <div>
                    <strong style={{ display: 'block' }}>{inst.category} - {inst.note || '未命名項目'}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      <span>總額 ${inst.totalAmount.toLocaleString()} ({inst.terms} 期，每期約 ${amountPerTerm.toLocaleString()})</span>
                      <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem' }}>起始: {inst.startDate}</span>
                      {inst.creator && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--accent-primary)', padding: '0 4px', borderRadius: '4px' }}>@{inst.creator}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.1rem' }}>${amountPerTerm.toLocaleString()}/期</span>
                    <button 
                      onClick={() => handleDelete(inst.id)}
                      className="btn btn-ghost" 
                      style={{ padding: '0.25rem' }}
                      title="永久刪除分期設定"
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
