import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { syncAllAccountingRecords, saveMonthAccountingRecords, getFixedExpenses, getInstallments, getChartOptions, saveChartOptions } from '../../lib/accountingSync';
import type { ChartOption } from '../../lib/accountingSync';
import EditRecordModal from './EditRecordModal';
import type { FixedExpense, Installment } from '../../lib/accountingSync';
import type { AccountingRecord } from '../../lib/accountingSync';
import { PieChart as RePieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Tooltip as LineTooltip } from 'recharts';
import { Trash2, TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronRight, FilterX, Plus, Settings, Edit2 } from 'lucide-react';
import FixedExpensesModal from './FixedExpensesModal';
import InstallmentsModal from './InstallmentsModal';
import CreditCardTab from './CreditCardTab';


const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AccountingApp() {
  const { token, activeFolderId: folderId, userInfo } = useAuth();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [chartOptions, setChartOptions] = useState<ChartOption[]>([]);
  const [newChartOption, setNewChartOption] = useState('');
  const [newOptionMatchType, setNewOptionMatchType] = useState<'category'|'note'>('note');
  const [editingRecord, setEditingRecord] = useState<AccountingRecord | null>(null);
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
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general'|'credit_card'>('general');

  const loadData = async () => {
    if (!token || !folderId) return;
    setIsLoading(true);
    try {
      const syncedRecords = await syncAllAccountingRecords(token, folderId, records);
      setRecords(syncedRecords);
      const fixed = await getFixedExpenses(token, folderId);
      setFixedExpenses(fixed);
      const insts = await getInstallments(token, folderId);
      setInstallments(insts);
      const options = await getChartOptions(token, folderId);
      setChartOptions(options);
    } catch (e) {
      console.error(e);
      alert('同步資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setRecords([]);
    loadData();
  }, [folderId]);

  const handleMonthChange = (newMonth: string) => {
    setCurrentMonth(newMonth);
    if (newMonth) {
      const [year, month] = newMonth.split('-');
      setStartDate(`${year}-${month}-01`);
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      setEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

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
    
    const targetMonth = date.substring(0, 7);
    const updatedRecords = [newRecord, ...records];
    setRecords(updatedRecords);
    
    // Reset form partially
    setAmount('');
    setNote('');
    
    // Trigger save to target month file on Google Drive
    if (token && folderId) {
      const targetMonthRecords = updatedRecords.filter(r => r.date.startsWith(targetMonth));
      saveMonthAccountingRecords(token, folderId, targetMonth, targetMonthRecords);
    }
  };

  // Dynamic Generation of Fixed Expenses & Installments
  const dynamicFixedRecords: AccountingRecord[] = [];
  const targetMonths = currentMonth ? [currentMonth] : Array.from(new Set(records.map(r => r.date.substring(0, 7)))).sort();
  
  if (targetMonths.length === 0) {
    const today = new Date();
    targetMonths.push(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  }
  
  for (const ym of targetMonths) {
    // Fixed Expenses
    const validFixed = fixedExpenses.filter(f => (!f.startDate || f.startDate <= ym) && (!f.endDate || ym <= f.endDate));
    for (const f of validFixed) {
      const day = String(f.deductionDate || 1).padStart(2, '0');
      dynamicFixedRecords.push({
        id: `fixed-${f.id}-${ym}`,
        date: `${ym}-${day}`,
        type: 'expense',
        amount: f.amount,
        category: f.category,
        note: f.note,
        timestamp: 0,
        isFixed: true,
        creator: f.creator
      });
    }

    // Installments
    for (const inst of installments) {
      if (ym < inst.startDate) continue;
      const start = new Date(inst.startDate + '-01');
      const now = new Date(ym + '-01');
      let months = (now.getFullYear() - start.getFullYear()) * 12;
      months -= start.getMonth();
      months += now.getMonth();
      const currentTerm = months + 1;
      
      if (currentTerm > 0 && currentTerm <= inst.terms) {
        const amountPerTerm = Math.round((inst.totalAmount * (1 + (inst.interestRate || 0) / 100)) / inst.terms);
        const termNote = `(第 ${currentTerm}/${inst.terms} 期)`;
        const finalNote = inst.note ? `${inst.note} ${termNote}` : termNote;
        
        dynamicFixedRecords.push({
          id: `inst-${inst.id}-${ym}`,
          date: `${ym}-01`,
          type: 'expense',
          amount: amountPerTerm,
          category: inst.category,
          note: finalNote,
          timestamp: 0,
          isFixed: true,
          creator: inst.creator
        });
      }
    }
  }


  const handleDelete = (id: string) => {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    const target = records.find(r => r.id === id);
    if (!target) return;
    const targetMonth = target.date.substring(0, 7);
    const updatedRecords = records.map(r => 
      r.id === id ? { ...r, isDeleted: true, timestamp: Date.now() } : r
    );
    setRecords(updatedRecords);
    if (token && folderId) {
      const targetMonthRecords = updatedRecords.filter(r => r.date.startsWith(targetMonth));
      saveMonthAccountingRecords(token, folderId, targetMonth, targetMonthRecords);
    }
  };

  const activeRecords = [...records.filter(r => !r.isDeleted), ...dynamicFixedRecords];
  
  // Apply Search & Date Filter
  const filteredActiveRecords = activeRecords.filter(r => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.category.toLowerCase().includes(q) || (r.note && r.note.toLowerCase().includes(q));
  });

  const expenses = filteredActiveRecords.filter(r => r.type === 'expense');
  const incomes = filteredActiveRecords.filter(r => r.type === 'income');
  
  const generalRecords = filteredActiveRecords.filter(r => !r.isFixed && !r.isCreditCard);
  const fixedRecords = filteredActiveRecords.filter(r => r.isFixed);
  
  
  const enabledOptions = chartOptions.filter(o => o.enabled);
  const filterByChartOptions = (r: AccountingRecord) => {
    if (selectedCategory) return r.category === selectedCategory;
    if (enabledOptions.length === 0) return true; // If no options are checked, show all
    return enabledOptions.some(opt => {
      if (opt.matchType === 'category') return r.category === opt.keyword;
      if (opt.matchType === 'note') return r.note && r.note.includes(opt.keyword);
      return false;
    });
  };

  const displayGeneralRecords = generalRecords.filter(filterByChartOptions);
  const displayFixedRecords = fixedRecords.filter(filterByChartOptions);

  
  const sortedGeneralRecords = [...displayGeneralRecords].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.amount - a.amount;
  });
  const sortedFixedRecords = [...displayFixedRecords].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
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
        
        {!r.isFixed && !r.isCreditCard && (
          <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => setEditingRecord(r)}>
            <Edit2 size={16} color="var(--accent-primary)" />
          </button>
        )}
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

  // Line Chart Data Logic
  const monthMap: Record<string, any> = {};
  filteredActiveRecords.forEach(r => {
    if (r.type !== 'expense') return;
    const ym = r.date.substring(0, 7);
    if (!monthMap[ym]) {
      monthMap[ym] = { name: ym };
      chartOptions.forEach(opt => { if (opt.enabled) monthMap[ym][opt.keyword] = 0; });
    }
    
    chartOptions.forEach(opt => {
      if (!opt.enabled) return;
      let matched = false;
      if (opt.matchType === 'category' && r.category === opt.keyword) matched = true;
      if (opt.matchType === 'note' && r.note && r.note.includes(opt.keyword)) matched = true;
      
      if (matched) {
        if (monthMap[ym][opt.keyword] === undefined) monthMap[ym][opt.keyword] = 0;
        monthMap[ym][opt.keyword] += r.amount;
      }
    });
  });

  Object.values(monthMap).forEach(item => {
    chartOptions.forEach(opt => {
      if (opt.enabled && item[opt.keyword] === undefined) item[opt.keyword] = 0;
    });
  });
  const lineChartData = Object.values(monthMap).sort((a: any, b: any) => a.name.localeCompare(b.name));

  const handleAddChartOption = async () => {
    if (!newChartOption.trim() || chartOptions.find(o => o.keyword === newChartOption.trim() && o.matchType === newOptionMatchType)) return;
    const newOpt: ChartOption = {
      id: 'opt-' + Date.now(),
      keyword: newChartOption.trim(),
      matchType: newOptionMatchType,
      enabled: true
    };
    const updated = [...chartOptions, newOpt];
    setChartOptions(updated);
    setNewChartOption('');
    if (token && folderId) {
      await saveChartOptions(token, folderId, updated);
    }
  };

  const handleToggleChartOption = async (id: string) => {
    const updated = chartOptions.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o);
    setChartOptions(updated);
    if (token && folderId) {
      await saveChartOptions(token, folderId, updated);
    }
  };

  const handleRemoveChartOption = async (id: string) => {
    const updated = chartOptions.filter(o => o.id !== id);
    setChartOptions(updated);
    if (token && folderId) {
      await saveChartOptions(token, folderId, updated);
    }
  };

  const handleSaveEdit = async (updatedRecord: AccountingRecord) => {
    const oldRecord = records.find(r => r.id === updatedRecord.id);
    if (!oldRecord) return;
    
    updatedRecord.timestamp = Date.now();
    const newRecords = records.map(r => r.id === updatedRecord.id ? updatedRecord : r);
    setRecords(newRecords);
    setEditingRecord(null);
    
    if (token && folderId) {
      const oldMonth = oldRecord.date.substring(0, 7);
      const newMonth = updatedRecord.date.substring(0, 7);
      
      if (oldMonth === newMonth) {
        const targetMonthRecords = newRecords.filter(r => r.date.startsWith(oldMonth));
        await saveMonthAccountingRecords(token, folderId, oldMonth, targetMonthRecords);
      } else {
        const oldMonthRecordsToSave = newRecords.filter(r => r.date.startsWith(oldMonth));
        oldMonthRecordsToSave.push({ ...oldRecord, isDeleted: true, timestamp: Date.now() }); 
        await saveMonthAccountingRecords(token, folderId, oldMonth, oldMonthRecordsToSave);
        
        const newMonthRecords = newRecords.filter(r => r.date.startsWith(newMonth));
        await saveMonthAccountingRecords(token, folderId, newMonth, newMonthRecords);
      }
    }
  };

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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>切換帳本月份</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="month" 
                  className="input-field" 
                  style={{ width: 'auto' }}
                  value={currentMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                />
                <button 
                  type="button" 
                  className={`btn ${!currentMonth ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => handleMonthChange('')}
                >
                  全部歷史
                </button>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={loadData} disabled={isLoading} style={{ marginTop: '1rem' }}>
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? '同步中...' : 'Sync (讀取全部帳本)'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            
            
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
                handleMonthChange(newMonth);
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

        {/* Date Range Filter */}
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold' }}>統計區間：</span>
          <input 
            type="date" 
            className="input-field" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            style={{ width: '130px', padding: '0.4rem' }} 
          />
          <span>至</span>
          <input 
            type="date" 
            className="input-field" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            style={{ width: '130px', padding: '0.4rem' }} 
          />
          <button 
            type="button" 
            className="btn btn-ghost" 
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
          >
            全部區間
          </button>
        </div>

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
                <PieTooltip formatter={(value) => `$${value}`} />
              </RePieChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>尚無資料</div>
          )}
        </div>

        

      </div>

      {/* Right Column: Stats */}
      <div className="dashboard-stats">
        
        
        <div className="glass-panel accounting-chart-box" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: '400px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>自訂月度花費趨勢</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select className="input-field" value={newOptionMatchType} onChange={e => setNewOptionMatchType(e.target.value as 'category'|'note')} style={{ padding: '0.25rem', fontSize: '0.85rem' }}>
                <option value="note">比對備註</option>
                <option value="category">比對分類</option>
              </select>
              <input type="text" className="input-field" placeholder="新增追蹤 (例: 旅遊)" value={newChartOption} onChange={e => setNewChartOption(e.target.value)} style={{ width: '130px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} />
              <button className="btn btn-primary" onClick={handleAddChartOption} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>新增</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {chartOptions.map((opt, i) => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={opt.enabled} onChange={() => handleToggleChartOption(opt.id)} style={{ margin: 0 }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.enabled ? COLORS[i % COLORS.length] : 'gray' }} />
                <span style={{ color: opt.enabled ? 'inherit' : 'gray' }}>{opt.keyword} ({opt.matchType === 'category' ? '分類' : '備註'})</span>
                <button type="button" onClick={(e) => { e.preventDefault(); handleRemoveChartOption(opt.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, marginLeft: '0.25rem' }}>&times;</button>
              </label>
            ))}
          </div>
          {lineChartData.length > 0 && chartOptions.some(o => o.enabled) ? (
            <div style={{ flex: 1, minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickMargin={10} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} width={60} tickFormatter={(value) => `$${value}`} />
                  <LineTooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} />
                  <Legend wrapperStyle={{ fontSize: '0.85rem' }} />
                  {chartOptions.filter(o => o.enabled).map((opt) => (
                    <Line key={opt.id} type="monotone" dataKey={opt.keyword} stroke={COLORS[chartOptions.findIndex(o => o.id === opt.id) % COLORS.length]} strokeWidth={2} activeDot={{ r: 6 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>請勾選上方項目來顯示趨勢</div>
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

            {editingRecord && (
        <EditRecordModal 
          isOpen={true} 
          onClose={() => setEditingRecord(null)} 
          record={editingRecord} 
          onSave={handleSaveEdit} 
        />
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
