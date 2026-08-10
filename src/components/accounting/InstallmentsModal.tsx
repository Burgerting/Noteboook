import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Save } from 'lucide-react';
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

  const handleAdd = (e: React.FormEvent) => {
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
    
    setInstallments([...installments, newInstallment]);
    setCategory('');
    setNote('');
    setTotalAmount('');
    setTerms('');
    setInterestRate('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定要永久刪除此分期設定嗎？(不會影響過去已匯入的帳單)')) {
      setInstallments(installments.filter(e => e.id !== id));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      await saveInstallments(token, folderId, installments);
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
        maxWidth: '550px',
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

        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>管理分期設定</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          在此設定需要分期付款的項目（如手機、家電）。設定後可於主畫面「匯入分期帳單」，系統會自動計算期數。
        </p>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

        {/* Add Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="分類/名稱 (如: 設備)" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              style={{ flex: 1, minWidth: '120px' }}
            />
            <input 
              type="text" 
              className="input-field" 
              placeholder="備註 (如: 買手機)" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ flex: 1, minWidth: '120px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
              placeholder="分幾期" 
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              required
              style={{ width: '80px' }}
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="總利率%(選填)" 
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              step="0.01"
              style={{ width: '120px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>開始月份：</span>
            <input 
              type="month" 
              className="input-field" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{ width: 'auto' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', marginLeft: 'auto' }}>
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
          ) : installments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              尚未設定任何分期項目
            </div>
          ) : (
            installments.map(inst => {
              const amountPerTerm = Math.round((inst.totalAmount * (1 + inst.interestRate / 100)) / inst.terms);
              
              // Calculate current term based on current real time (optional visual info)
              const today = new Date();
              const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
              
              let currentTermStr = '';
              if (currentYM < inst.startDate) {
                currentTermStr = '尚未開始';
              } else {
                const start = new Date(inst.startDate + '-01');
                const now = new Date(currentYM + '-01');
                let months = (now.getFullYear() - start.getFullYear()) * 12;
                months -= start.getMonth();
                months += now.getMonth();
                const currentTerm = months + 1;
                
                if (currentTerm > inst.terms) {
                  currentTermStr = '已繳清';
                } else {
                  currentTermStr = `進行中 (第 ${currentTerm}/${inst.terms} 期)`;
                }
              }

              return (
                <div key={inst.id} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', 
                  backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem',
                  opacity: currentTermStr === '已繳清' ? 0.5 : 1
                }}>
                  <div>
                    <strong style={{ display: 'block' }}>{inst.category}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {inst.note && <span style={{ marginRight: '8px' }}>{inst.note}</span>}
                      <span style={{ color: 'var(--primary)' }}>{currentTermStr}</span>
                      <br/>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        總額 ${inst.totalAmount} / {inst.terms}期 
                        {inst.interestRate > 0 && ` / 利率 ${inst.interestRate}%`}
                        / 起始 {inst.startDate}
                      </span>
                      {inst.creator && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--accent-primary)', padding: '0 4px', borderRadius: '4px' }}>@{inst.creator}</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 'bold', display: 'block' }}>${amountPerTerm}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>每期</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(inst.id)}
                      className="btn btn-ghost" 
                      style={{ padding: '0.25rem' }}
                      title="永久刪除"
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
