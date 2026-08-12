import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getMonthFileName, syncAccountingRecords } from '../../lib/accountingSync';
import type { AccountingRecord } from '../../lib/accountingSync';
import { PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Settings, Download, FilterX, ChevronDown, ChevronRight } from 'lucide-react';
import FixedExpensesModal from './FixedExpensesModal';
import InstallmentsModal from './InstallmentsModal';
import CreditCardTab from './CreditCardTab';
import { getFixedExpenses, getInstallments } from '../../lib/accountingSync';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AccountingApp() {
  const { token, activeFolderId: folderId, userInfo } = useAuth();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFixedExpensesModalOpen, setIsFixedExpensesModalOpen] = useState(false);
  const [isInstallmentsModalOpen, setIsInstallmentsModalOpen] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [recordType, setRecordType] = useState<'expense'|'income'>('expense');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general'|'credit_card'>('general');

  const loadData = async () => {
    if (!token || !folderId) return;
    setIsLoading(true);
    try {
      const fileName = getMonthFileName(currentMonth);
      const syncedRecords = await syncAccountingRecords(token, folderId, fileName, records);
      setRecords(syncedRecords);
    } catch (e) {
      console.error(e);
      alert('同步資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // When month or folder changes, clear local and load remote
    setRecords([]);
    loadData();
  }, [currentMonth, folderId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    
    let type: 'income' | 'expense' = 'expense';
    let isFixed = false;
    let isCreditCard = false;
    
    if (recordType === 'income') {
      type = 'income';
    }
    
    const newRecord: AccountingRecord = {
      id: crypto.randomUUID(),
      date,
      type,
      amount: Number(amount),
      category,
      note,
      timestamp: Date.now(),
      isFixed,
      isCreditCard,
      creator: userInfo?.name || undefined
    };
    
    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    
    // Reset form partially
    setAmount('');
    setNote('');
    
    // Trigger sync in background
    if (token && folderId) {
      const fileName = getMonthFileName(currentMonth);
      syncAccountingRecords(token, folderId, fileName, updatedRecords).then(setRecords);
    }
  };

  const handleImportInstallments = async () => {
    if (!token || !folderId) return;
    try {
      const installments = await getInstallments(token, folderId);
      if (installments.length === 0) {
        alert('您還沒有設定任何分期項目，或是雲端仍在同步中。\n請確認您有在「管理分期」中點擊「新增」並「儲存」。');
        return;
      }
      
      let hasDuplicate = false;
      
      const validInsts = installments.filter(inst => {
        if (currentMonth < inst.startDate) return false;
        const start = new Date(inst.startDate + '-01');
        const now = new Date(currentMonth + '-01');
        let months = (now.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += now.getMonth();
        const currentTerm = months + 1;
        return currentTerm > 0 && currentTerm <= inst.terms;
      });

      const newRecords = validInsts.filter(inst => {
        const start = new Date(inst.startDate + '-01');
        const now = new Date(currentMonth + '-01');
        let months = (now.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += now.getMonth();
        const currentTerm = months + 1;

        const amountPerTerm = Math.round((inst.totalAmount * (1 + inst.interestRate / 100)) / inst.terms);
        const termNote = `(第 ${currentTerm}/${inst.terms} 期)`;
        const finalNote = inst.note ? `${inst.note} ${termNote}` : termNote;

        const isDuplicate = records.some(r => r.category === inst.category && r.note === finalNote && r.amount === amountPerTerm && r.type === 'expense');
        if (isDuplicate) hasDuplicate = true;
        return !isDuplicate;
      }).map(inst => {
        const start = new Date(inst.startDate + '-01');
        const now = new Date(currentMonth + '-01');
        let months = (now.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += now.getMonth();
        const currentTerm = months + 1;
        const amountPerTerm = Math.round((inst.totalAmount * (1 + inst.interestRate / 100)) / inst.terms);
        const termNote = `(第 ${currentTerm}/${inst.terms} 期)`;
        const finalNote = inst.note ? `${inst.note} ${termNote}` : termNote;

        return {
          id: crypto.randomUUID(),
          date: new Date().toISOString().split('T')[0],
          type: 'expense' as const,
          amount: amountPerTerm,
          category: inst.category,
          note: finalNote,
          timestamp: Date.now(),
          isFixed: true, // 顯示在固定支出/分期區塊
          creator: userInfo?.name || undefined
        };
      });

      if (hasDuplicate) {
        alert('提示：發現有相同名稱與期數的分期項目已經存在於本月帳單中，為避免重複，系統已自動略過。');
      }

      if (newRecords.length === 0) return;

      const updatedRecords = [...newRecords, ...records];
      setRecords(updatedRecords);
      const fileName = getMonthFileName(currentMonth);
      syncAccountingRecords(token, folderId, fileName, updatedRecords).then(setRecords);
    } catch (err) {
      console.error(err);
      alert('匯入分期失敗');
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    const updatedRecords = records.map(r => 
      r.id === id ? { ...r, isDeleted: true, timestamp: Date.now() } : r
    );
    setRecords(updatedRecords);
    if (token && folderId) {
      const fileName = getMonthFileName(currentMonth);
      syncAccountingRecords(token, folderId, fileName, updatedRecords).then(setRecords);
    }
  };

  const handleImportFixedExpenses = async () => {
    if (!token || !folderId) return;
    try {
      const fixed = await getFixedExpenses(token, folderId);
      if (fixed.length === 0) {
        alert('您還沒有設定任何固定支出，或是雲端仍在同步中（若您剛儲存，請稍等 3~5 秒後再按一次）。\n請確認您有在「管理固定支出」中點擊「新增」並「儲存」。');
        return;
      }
      
      let hasDuplicate = false;
      // 過濾掉已經停止的支出（若 currentMonth 大於 endDate 則不匯入）
      const validFixed = fixed.filter(f => !f.endDate || currentMonth <= f.endDate);

      const newRecords = validFixed.filter(f => {
        const isDuplicate = records.some(r => r.category === f.category && r.note === f.note && r.amount === f.amount && r.type === 'expense');
        if (isDuplicate) hasDuplicate = true;
        return !isDuplicate;
      }).map(f => ({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0], // Use today's date
        type: 'expense' as const,
        amount: f.amount,
        category: f.category,
        note: f.note,
        timestamp: Date.now(),
        isFixed: true,
        creator: userInfo?.name || undefined
      }));

      if (hasDuplicate) {
        alert('提示：發現有相同名稱與金額的項目已經存在於本月帳單中，為避免重複，系統已自動為您略過這些項目。請檢查清楚！');
      }

      if (newRecords.length === 0) {
        return;
      }

      const updatedRecords = [...newRecords, ...records];
      setRecords(updatedRecords);
      const fileName = getMonthFileName(currentMonth);
      syncAccountingRecords(token, folderId, fileName, updatedRecords).then(setRecords);
      alert(`成功匯入 ${newRecords.length} 筆固定支出！`);
    } catch (e) {
      console.error(e);
      alert('匯入固定支出失敗');
    }
  };

  const activeRecords = records.filter(r => !r.isDeleted);
  
  // Apply Search Filter
  const filteredActiveRecords = activeRecords.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.category.toLowerCase().includes(q) || (r.note && r.note.toLowerCase().includes(q));
  });

  const expenses = filteredActiveRecords.filter(r => r.type === 'expense');
  const incomes = filteredActiveRecords.filter(r => r.type === 'income');
  
  const generalRecords = filteredActiveRecords.filter(r => !r.isFixed && !r.isCreditCard);
  const fixedRecords = filteredActiveRecords.filter(r => r.isFixed);
  
  const displayGeneralRecords = selectedCategory ? generalRecords.filter(r => r.category === selectedCategory) : generalRecords;
  const displayFixedRecords = selectedCategory ? fixedRecords.filter(r => r.category === selectedCategory) : fixedRecords;
  
  const sortedGeneralRecords = [...displayGeneralRecords].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.amount - a.amount;
  });
  const sortedFixedRecords = [...displayFixedRecords].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.amount - a.amount;
  });
  
  const renderRecordItem = (r: AccountingRecord) => (
    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {r.type === 'income' ? <TrendingUp size={16} color="#ef4444"/> : <TrendingDown size={16} color="#10b981"/>}
          <strong>{r.category}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{r.date}</span>
        </div>
        {(r.note || r.creator) && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {r.note}
            {r.creator && <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontSize: '0.75rem', border: '1px solid var(--accent-primary)', padding: '0 4px', borderRadius: '4px' }}>@{r.creator}</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 'bold', color: r.type === 'income' ? '#ef4444' : '#10b981' }}>
          ${r.amount}
        </span>
        <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => handleDelete(r.id)}>
          <Trash2 size={16} color="var(--danger)" />
        </button>
      </div>
    </div>
  );
  
  const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = incomes.reduce((sum, r) => sum + r.amount, 0);

  // Group by category for pie chart
  const expenseByCategory = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const pieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));
  const displayPieData = selectedCategory ? pieData.filter(d => d.name === selectedCategory) : pieData;

  return (
    <>
    {/* Tabs Navigation */}
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
      <button 
        onClick={() => setActiveTab('general')} 
        style={{ 
          background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer',
          color: activeTab === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
          borderBottom: activeTab === 'general' ? '2px solid var(--accent-primary)' : '2px solid transparent',
          fontWeight: activeTab === 'general' ? 'bold' : 'normal'
        }}
      >
        收支明細
      </button>
      <button 
        onClick={() => setActiveTab('credit_card')} 
        style={{ 
          background: 'none', border: 'none', padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer',
          color: activeTab === 'credit_card' ? 'var(--accent-primary)' : 'var(--text-secondary)',
          borderBottom: activeTab === 'credit_card' ? '2px solid var(--accent-primary)' : '2px solid transparent',
          fontWeight: activeTab === 'credit_card' ? 'bold' : 'normal'
        }}
      >
        信用卡帳單
      </button>
    </div>

    {activeTab === 'general' ? (
    <div className="accounting-layout">
      
      {/* Left Column: Form & List */}
      <div className="dashboard-form-list">
        
        <div className="accounting-sync-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="month" 
              className="input-field" 
              style={{ width: 'auto' }}
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
            />
            <button className="btn btn-ghost" onClick={loadData} disabled={isLoading}>
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Sync
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={handleImportFixedExpenses} style={{ fontSize: '0.9rem' }}>
              <Download size={16} /> 匯入固定支出
            </button>
            <button className="btn btn-ghost" onClick={handleImportInstallments} style={{ fontSize: '0.9rem' }}>
              <Download size={16} /> 匯入分期
            </button>
            <button className="btn btn-ghost" onClick={() => setIsFixedExpensesModalOpen(true)} style={{ fontSize: '0.9rem' }}>
              <Settings size={16} /> 管理固定支出
            </button>
            <button className="btn btn-ghost" onClick={() => setIsInstallmentsModalOpen(true)} style={{ fontSize: '0.9rem' }}>
              <Settings size={16} /> 管理分期
            </button>
          </div>
        </div>

        {/* Add Form */}
        <div className="glass-panel accounting-form" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setIsFormExpanded(!isFormExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isFormExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <h3 style={{ margin: 0 }}>新增紀錄</h3>
            </div>
          </div>
          {isFormExpanded && (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <select className="input-field" value={recordType} onChange={e => {
              const val = e.target.value as any;
              setRecordType(val);
              if (val === 'income') {
                setCategory('收入');
              } else if (category === '收入') {
                setCategory('');
              }
            }}>
              <option value="expense">一般支出</option>
              <option value="income">收入</option>
            </select>
            <input type="date" className="input-field" value={date} onChange={e => {
              const newDate = e.target.value;
              setDate(newDate);
              const newMonth = newDate.substring(0, 7);
              if (newMonth && newMonth !== currentMonth) {
                setCurrentMonth(newMonth);
              }
            }} required />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input type="number" className="input-field" placeholder="金額" value={amount} onChange={e => setAmount(e.target.value)} required />
            <input type="text" list="category-options" className="input-field" placeholder="分類 (例如：吃飯)" value={category} onChange={e => setCategory(e.target.value)} required />
            <datalist id="category-options">
              <option value="吃飯" />
              <option value="生活" />
              <option value="交通" />
              <option value="社交" />
              <option value="衣著" />
              <option value="設備" />
              <option value="旅遊" />
              <option value="小孩" />
              <option value="玩具" />
              <option value="雜支" />
            </datalist>
          </div>
          <input type="text" className="input-field" placeholder="備註 (選填)" value={note} onChange={e => setNote(e.target.value)} />
          <button type="submit" className="btn btn-primary"><Plus size={18}/> 新增</button>
            </form>
          )}
        </div>

      </div>

      {/* Right Column: Stats */}
      <div className="dashboard-stats">
        <div className="glass-panel accounting-stats-box" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>總收入</div>
            <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 'bold' }}>${totalIncome}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>總支出</div>
            <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 'bold' }}>${totalExpense}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>結餘</div>
            <div style={{ color: totalIncome - totalExpense >= 0 ? '#ef4444' : '#10b981', fontSize: '1.5rem', fontWeight: 'bold' }}>
              ${totalIncome - totalExpense}
            </div>
          </div>
        </div>

        <div className="glass-panel accounting-chart-box" style={{ padding: '1.5rem', height: '400px' }}>
          <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>各項支出占比</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie 
                  data={displayPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" 
                  label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  onClick={(data) => setSelectedCategory(data.name || null)}
                  style={{ cursor: 'pointer' }}
                >
                  {displayPieData.map((entry) => {
                    const originalIndex = pieData.findIndex(p => p.name === entry.name);
                    return (
                      <Cell 
                        key={`cell-${originalIndex}`} 
                        fill={COLORS[originalIndex % COLORS.length]} 
                      />
                    );
                  })}
                </Pie>
                <Tooltip formatter={(value) => `$${value}`} />
              </RePieChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>尚無資料</div>
          )}
        </div>

        {/* Lists */}
        <div className="glass-panel accounting-list-box" style={{ padding: '1.5rem', flex: 1, minHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>紀錄明細</h3>
              {selectedCategory && (
                <button className="btn btn-ghost" type="button" onClick={() => setSelectedCategory(null)} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', padding: '0.25rem 0.5rem' }}>
                  <FilterX size={14} style={{ marginRight: '0.25rem' }} /> 清除 ({selectedCategory})
                </button>
              )}
            </div>
            <input 
              type="text" 
              className="input-field" 
              placeholder="搜尋關鍵字 (例如：水費)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '200px' }}
            />
          </div>

          {records.length === 0 ? (
            <p>本月尚無紀錄。</p>
          ) : (
            <>
              {/* General Records */}
              {(displayGeneralRecords.length > 0 || !selectedCategory) && (
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>一般紀錄</h4>
                  {displayGeneralRecords.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>無</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {sortedGeneralRecords.map(r => renderRecordItem(r))}
                    </div>
                  )}
                </div>
              )}

              {/* Fixed Expenses */}
              {(displayFixedRecords.length > 0 || fixedRecords.length > 0) && (
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', marginTop: '1rem' }}>固定支出</h4>
                  {displayFixedRecords.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>無</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {sortedFixedRecords.map(r => renderRecordItem(r))}
                    </div>
                  )}
                </div>
              )}

            </>
          )}
        </div>

      </div>

    </div>
    ) : (
      <CreditCardTab />
    )}

      {token && folderId && (
        <FixedExpensesModal 
          isOpen={isFixedExpensesModalOpen}
          onClose={() => setIsFixedExpensesModalOpen(false)}
          token={token}
          folderId={folderId}
        />
      )}
      {token && folderId && (
        <InstallmentsModal
          isOpen={isInstallmentsModalOpen}
          onClose={() => setIsInstallmentsModalOpen(false)}
          token={token}
          folderId={folderId}
        />
      )}
    </>
  );
}
