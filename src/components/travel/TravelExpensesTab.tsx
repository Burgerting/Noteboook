import React, { useState } from 'react';
import type { Trip, TravelExpense } from '../../lib/travelSync';
import { useAuth } from '../../store/AuthContext';
import { Plus, Trash2 } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function TravelExpensesTab({ trip, onUpdate }: Props) {
  const { userInfo } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => {
    // Default to today if today is within trip dates, else start date
    const today = new Date().toISOString().split('T')[0];
    if (today >= trip.startDate && today <= trip.endDate) return today;
    return trip.startDate;
  });

  const totalSpent = trip.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = trip.budget > 0 ? trip.budget - totalSpent : 0;
  const budgetPercentage = trip.budget > 0 ? Math.min((totalSpent / trip.budget) * 100, 100) : 0;

  // Chart data
  const categoryTotals = trip.expenses.reduce((acc, exp) => {
    const cat = exp.category || '其他';
    acc[cat] = (acc[cat] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    // "帶入使用者" (Bring in the user)
    const currentUser = userInfo?.name || '未知使用者';

    const newExpense: TravelExpense = {
      id: crypto.randomUUID(),
      date,
      amount: Number(amount),
      category: category || '其他',
      note,
      payer: currentUser, // 預設付款人為自己
      creator: currentUser, // 記錄者也是自己
      timestamp: Date.now()
    };

    const updatedExpenses = [newExpense, ...trip.expenses].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });

    onUpdate({
      ...trip,
      expenses: updatedExpenses,
      timestamp: Date.now()
    });

    setIsAdding(false);
    setAmount('');
    setNote('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('確定要刪除這筆花費嗎？')) return;

    const updatedExpenses = trip.expenses.filter(e => e.id !== id);
    onUpdate({
      ...trip,
      expenses: updatedExpenses,
      timestamp: Date.now()
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Budget Summary */}
      <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>總花費</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              ${totalSpent.toLocaleString()}
            </div>
          </div>
          {trip.budget > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>剩餘預算</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: remainingBudget >= 0 ? 'var(--text-primary)' : 'var(--danger-color)' }}>
                ${remainingBudget.toLocaleString()}
              </div>
            </div>
          )}
        </div>
        
        {trip.budget > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              <span>進度</span>
              <span>{budgetPercentage.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: budgetPercentage > 90 ? 'var(--danger-color)' : 'var(--accent-primary)',
                  width: `${budgetPercentage}%`,
                  transition: 'width 0.3s ease'
                }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Chart & Add Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {isAdding ? (
          <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>新增花費</h3>
            <form onSubmit={handleAddExpense}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>日期</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>金額 (必填)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0" />
                </div>
              </div>
              
              <div className="form-group">
                <label>分類</label>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="例如：飲食、交通、住宿" list="travel-categories" />
                <datalist id="travel-categories">
                  <option value="飲食" />
                  <option value="交通" />
                  <option value="住宿" />
                  <option value="門票/活動" />
                  <option value="購物" />
                  <option value="伴手禮" />
                </datalist>
              </div>
              
              <div className="form-group">
                <label>備註</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="花費明細..." />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>取消</button>
                <button type="submit" className="btn btn-primary">儲存</button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>花費明細</h3>
            <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => setIsAdding(true)}>
              <Plus size={16} /> 新增
            </button>
          </div>
        )}
      </div>

      {/* Expense List and Chart */}
      {trip.expenses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {chartData.length > 0 && (
            <div style={{ height: '200px', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="50%" height="100%">
                <RePieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                    contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div style={{ width: '50%', paddingLeft: '1rem', overflowY: 'auto', maxHeight: '100%' }}>
                {chartData.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS[index % COLORS.length] }}></div>
                    <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</div>
                    <div style={{ fontWeight: 600 }}>${entry.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {trip.expenses.map(expense => (
              <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{expense.date}</span>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-dark)', borderRadius: '12px', color: 'var(--text-secondary)' }}>{expense.category}</span>
                    {expense.payer && (
                      <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', borderRadius: '12px' }}>
                        {expense.payer} 付款
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '1rem' }}>{expense.note || expense.category}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    ${expense.amount.toLocaleString()}
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--text-secondary)' }} onClick={() => handleDelete(expense.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
