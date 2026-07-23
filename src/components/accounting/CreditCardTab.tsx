import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { syncCreditCards } from '../../lib/accountingSync';
import type { CreditCardRecord } from '../../lib/accountingSync';
import { Plus, Trash2, RefreshCw, CreditCard, Mail, Key } from 'lucide-react';
import { getNationalId, saveNationalId } from '../../lib/idStorage';
import { fetchRecentCreditCardEmails } from '../../lib/gmailApi';

export default function CreditCardTab() {
  const { token, activeFolderId: folderId } = useAuth();
  
  const [records, setRecords] = useState<CreditCardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isScanning, setIsScanning] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [inputId, setInputId] = useState('');
  
  // Filter State
  const [filterBank, setFilterBank] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  
  // Form State
  const [yearMonth, setYearMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const updateRecords = (newRecords: CreditCardRecord[]) => {
    setRecords(newRecords);
    if (folderId) {
      const cacheKey = `credit_cards_${folderId}`;
      const filename = `${cacheKey}.json`;

      // 1. Attempt to save to physical FS via Vite proxy (for PC usage)
      fetch('/api/local-fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: newRecords })
      }).catch(() => console.log('Physical FS write failed (likely on mobile), falling back to localStorage'));

      // 2. Always save to localStorage as well (fallback for mobile/PWA)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(newRecords));
      } catch (e) {
        console.error('Failed to save to local cache', e);
      }
    }
  };

  const loadData = async () => {
    if (!token || !folderId) return;
    setIsLoading(true);
    try {
      const syncedRecords = await syncCreditCards(token, folderId, records);
      updateRecords(syncedRecords);
    } catch (e) {
      console.error(e);
      alert('同步信用卡資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!folderId) {
      setRecords([]);
      return;
    }
    
    const cacheKey = `credit_cards_${folderId}`;
    const filename = `${cacheKey}.json`;

    const loadCache = async () => {
      let loaded = false;
      // 1. Try loading from physical FS first (if running on PC with Vite server)
      try {
        const res = await fetch(`/api/local-fs/read?filename=${filename}`);
        if (res.ok) {
          const parsed = await res.json();
          setRecords(parsed);
          loaded = true;
        }
      } catch (e) {
        // Fetch failed, probably on mobile or server not running
      }

      // 2. Fallback to localStorage
      if (!loaded) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setRecords(JSON.parse(cached));
          } else {
            setRecords([]);
          }
        } catch (e) {
          setRecords([]);
        }
      }

      // 3. Fetch from cloud in background
      loadData();
    };

    loadCache();
  }, [folderId]);


  const handleScanGmail = async () => {
    const savedId = getNationalId();
    if (!savedId) {
      setShowIdModal(true);
      return;
    }
    await performScan(savedId, yearMonth);
  };

  const performScan = async (nationalId: string, targetMonth?: string) => {
    if (!token) return;
    setIsScanning(true);
    try {
      const bills = await fetchRecentCreditCardEmails(token, nationalId, targetMonth);
      if (bills.length === 0) {
        alert(`在 ${targetMonth || '最近45天'} 內沒有找到相關的信用卡帳單信件。`);
        return;
      }
      let updatedRecords = [...records];
      
      bills.forEach(b => {
        const existingIndex = updatedRecords.findIndex(r => !r.isDeleted && r.bank === b.bank && r.yearMonth === b.yearMonth);
        if (existingIndex >= 0) {
          // Update existing record
          updatedRecords[existingIndex] = {
            ...updatedRecords[existingIndex],
            amount: b.amount !== null ? b.amount : updatedRecords[existingIndex].amount,
            note: b.needsManualAmount ? '自動匯入，請手動確認金額' : '由 Gmail 自動更新',
            timestamp: Date.now()
          };
        } else {
          // Add new record
          updatedRecords.unshift({
            id: crypto.randomUUID(),
            yearMonth: b.yearMonth,
            bank: b.bank,
            amount: b.amount || 0,
            note: b.needsManualAmount ? '自動匯入，請手動確認金額' : '由 Gmail 自動匯入',
            timestamp: Date.now()
          });
        }
      });
      updateRecords(updatedRecords);
      if (token && folderId) {
        syncCreditCards(token, folderId, updatedRecords).then(updateRecords);
      }
      
      alert(`成功匯入 ${bills.length} 筆帳單！如有金額抓取不完全，請直接在右側列表中填寫。`);
    } catch (e) {
      console.error(e);
      alert('掃描 Gmail 失敗，請確認已授權或稍後再試。');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveId = () => {
    if (inputId.trim().length < 10) {
      alert('請輸入有效的身分證字號');
      return;
    }
    saveNationalId(inputId.trim());
    setShowIdModal(false);
    performScan(inputId.trim(), yearMonth);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !bank) return;
    
    const newRecord: CreditCardRecord = {
      id: crypto.randomUUID(),
      yearMonth,
      bank,
      amount: Number(amount),
      note,
      timestamp: Date.now()
    };
    
    const updatedRecords = [newRecord, ...records];
    updateRecords(updatedRecords);
    
    // Reset partial form
    setAmount('');
    setNote('');
    
    if (token && folderId) {
      syncCreditCards(token, folderId, updatedRecords).then(updateRecords);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('確定要刪除這筆信用卡費嗎？')) return;
    const updatedRecords = records.map(r => r.id === id ? { ...r, isDeleted: true, timestamp: Date.now() } : r);
    updateRecords(updatedRecords);
    if (token && folderId) {
      syncCreditCards(token, folderId, updatedRecords).then(updateRecords);
    }
  };

  const handleEditRecord = (id: string, field: 'bank' | 'amount' | 'note', value: any) => {
    updateRecords(records.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSaveSync = () => {
    if (token && folderId) {
      syncCreditCards(token, folderId, records).then(updateRecords);
    }
  };

  // Group and Filter active records for display
  const activeRecords = records.filter(r => !r.isDeleted);
  
  const uniqueBanks = Array.from(new Set(activeRecords.map(r => r.bank))).sort();
  const uniqueMonths = Array.from(new Set(activeRecords.map(r => r.yearMonth))).sort((a, b) => b.localeCompare(a));

  const filteredRecords = activeRecords.filter(r => {
    if (filterBank !== 'all' && r.bank !== filterBank) return false;
    if (filterMonth !== 'all' && r.yearMonth !== filterMonth) return false;
    return true;
  });

  const groupedRecords = filteredRecords.reduce((acc, curr) => {
    if (!acc[curr.yearMonth]) acc[curr.yearMonth] = [];
    acc[curr.yearMonth].push(curr);
    return acc;
  }, {} as Record<string, CreditCardRecord[]>);

  const sortedMonths = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));
  
  // Group months by year for display
  const groupedByYear = sortedMonths.reduce((acc, month) => {
    const year = month.split('-')[0];
    if (!acc[year]) acc[year] = [];
    acc[year].push(month);
    return acc;
  }, {} as Record<string, string[]>);
  
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a));

  return (
  <>
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      
      {/* Left Column: Form */}
      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <CreditCard size={24} color="var(--accent-primary)" />
            信用卡帳單
          </h2>
          <button className="btn btn-ghost" onClick={loadData} disabled={isLoading}>
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Sync
          </button>
        </div>

        <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>新增帳單</h3>
            <button type="button" className="btn btn-ghost" onClick={handleScanGmail} disabled={isScanning} style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Mail size={16} className={isScanning ? 'animate-pulse' : ''} />
              {isScanning ? '掃描中...' : '自動掃描 Gmail'}
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>帳單年月</label>
            <input 
              type="month" 
              className="input-field" 
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>發卡銀行</label>
            <input 
              type="text" 
              list="bank-options" 
              className="input-field" 
              placeholder="例如：中信, 國泰, 富邦, 永豐" 
              value={bank} 
              onChange={e => setBank(e.target.value)} 
              required 
            />
            <datalist id="bank-options">
              <option value="中信" />
              <option value="國泰" />
              <option value="富邦" />
              <option value="永豐" />
            </datalist>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>本期應繳總額</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="金額" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>備註 (選填)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="備註" 
              value={note} 
              onChange={e => setNote(e.target.value)} 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            <Plus size={18}/> 新增帳單
          </button>
        </form>
      </div>

      {/* Right Column: List View */}
      <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Filters */}
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>篩選條件:</span>
          <select 
            className="input-field" 
            style={{ padding: '0.5rem', width: '150px' }}
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
          >
            <option value="all">所有銀行</option>
            {uniqueBanks.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select 
            className="input-field" 
            style={{ padding: '0.5rem', width: '150px' }}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">所有月份</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, minHeight: '400px', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>歷史帳單紀錄</h3>
          
          {sortedYears.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>尚無任何帳單紀錄。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {sortedYears.map(year => {
                const monthsInYear = groupedByYear[year];
                // Calculate yearly total
                const yearlyTotal = monthsInYear.reduce((sum, month) => {
                  return sum + groupedRecords[month].reduce((mSum, r) => mSum + r.amount, 0);
                }, 0);

                return (
                  <div key={year} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ paddingBottom: '0.5rem', borderBottom: '2px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <h4 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--accent-primary)' }}>{year} 年度</h4>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                        年度總計: ${yearlyTotal.toLocaleString()}
                      </span>
                    </div>

                    {monthsInYear.map(month => {
                      const monthRecords = groupedRecords[month];
                      const totalForMonth = monthRecords.reduce((sum, r) => sum + r.amount, 0);

                      return (
                        <div key={month} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{month} 帳單</strong>
                            <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>小計: ${totalForMonth.toLocaleString()}</span>
                          </div>
                          
                          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {monthRecords.map(r => (
                              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CreditCard size={14} color="var(--text-secondary)"/>
                                    <input 
                                      type="text"
                                      value={r.bank}
                                      onChange={(e) => handleEditRecord(r.id, 'bank', e.target.value)}
                                      onBlur={handleSaveSync}
                                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', width: '100px' }}
                                    />
                                  </div>
                                  {r.note && (
                                    <div style={{ fontSize: '0.85rem', color: r.note.includes('請手動') ? 'var(--danger)' : 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                      {r.note}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    $
                                    <input 
                                      type="text"
                                      inputMode="numeric"
                                      value={r.amount !== 0 && !r.amount ? '' : r.amount.toLocaleString()}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val === '-' || !isNaN(Number(val))) {
                                          handleEditRecord(r.id, 'amount', val === '-' ? '-' : Number(val));
                                        }
                                      }}
                                      onBlur={(e) => {
                                        if (r.amount === '-' as any) handleEditRecord(r.id, 'amount', 0);
                                        handleSaveSync();
                                      }}
                                      placeholder="0"
                                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '2px 4px', borderRadius: '4px', textAlign: 'right', fontSize: '1rem', fontWeight: 'bold', width: '90px' }}
                                    />
                                  </span>
                                  <button type="button" className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => handleDelete(r.id)}>
                                    <Trash2 size={16} color="var(--danger)" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
    </div>

    {showIdModal && (
      <div className="modal-overlay">
        <div className="modal-content glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={20} color="var(--accent-primary)" />
              設定身分證字號
            </h3>
            <button className="btn btn-ghost" onClick={() => setShowIdModal(false)} style={{ padding: '0.25rem' }}>
              ✕
            </button>
          </div>
          
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            為了自動解密電子帳單 PDF，系統需要您的身分證字號。<br/>
            這組密碼將會經過簡單加密後，<b>僅安全地儲存於您的本地瀏覽器中</b>，絕對不會上傳至任何外部伺服器。
          </p>

          <input
            type="password"
            className="input-field"
            placeholder="請輸入身分證字號 (包含大寫英文字母)"
            value={inputId}
            onChange={(e) => setInputId(e.target.value.toUpperCase())}
            style={{ width: '100%', marginBottom: '1.5rem' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn btn-ghost" onClick={() => setShowIdModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleSaveId}>
              儲存並開始掃描
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
