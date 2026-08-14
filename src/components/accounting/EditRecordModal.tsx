import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { AccountingRecord } from '../../lib/accountingSync';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AccountingRecord;
  onSave: (updated: AccountingRecord) => void;
}

export default function EditRecordModal({ isOpen, onClose, record, onSave }: EditRecordModalProps) {
  const [date, setDate] = useState(record.date);
  const [amount, setAmount] = useState(record.amount.toString());
  const [category, setCategory] = useState(record.category);
  const [note, setNote] = useState(record.note);

  useEffect(() => {
    if (isOpen) {
      setDate(record.date);
      setAmount(record.amount.toString());
      setCategory(record.category);
      setNote(record.note);
    }
  }, [isOpen, record]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AccountingRecord = {
      ...record,
      date,
      amount: parseInt(amount, 10),
      category,
      note,
    };
    onSave(updated);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-glass)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        width: '90%', maxWidth: '400px', padding: '1.5rem',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.25rem' }}
        >
          <X size={20} />
        </button>

        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          修改紀錄
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>日期</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>金額</label>
            <input type="number" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>分類</label>
            <input type="text" list="category-options" className="input-field" value={category} onChange={e => setCategory(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>備註</label>
            <input type="text" className="input-field" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={16} /> 儲存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
