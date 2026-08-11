import React, { useState } from 'react';
import { Trip, TravelChecklistItem } from '../../lib/travelSync';
import { Plus, Trash2, Check, X, CheckSquare, ListTodo } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export default function ChecklistsTab({ trip, onUpdate }: Props) {
  const [activeList, setActiveList] = useState<'packing' | 'todo'>('packing');
  const [newItemText, setNewItemText] = useState('');

  const currentList = trip.checklists[activeList] || [];
  
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const newItem: TravelChecklistItem = {
      id: crypto.randomUUID(),
      text: newItemText.trim(),
      isDone: false
    };

    onUpdate({
      ...trip,
      checklists: {
        ...trip.checklists,
        [activeList]: [...currentList, newItem]
      },
      timestamp: Date.now()
    });

    setNewItemText('');
  };

  const handleToggleItem = (itemId: string) => {
    const updatedList = currentList.map(item => 
      item.id === itemId ? { ...item, isDone: !item.isDone } : item
    );

    onUpdate({
      ...trip,
      checklists: {
        ...trip.checklists,
        [activeList]: updatedList
      },
      timestamp: Date.now()
    });
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedList = currentList.filter(item => item.id !== itemId);

    onUpdate({
      ...trip,
      checklists: {
        ...trip.checklists,
        [activeList]: updatedList
      },
      timestamp: Date.now()
    });
  };

  // 預設清單功能
  const handleAddDefaultPackingList = () => {
    if (!confirm('要加入常用的預設行李清單嗎？')) return;
    
    const defaults = ['護照/身分證', '手機充電器/行動電源', '換洗衣物', '盥洗用品', '常備藥品', '網卡/Wi-Fi機', '外幣/信用卡'];
    const newItems = defaults
      .filter(text => !currentList.some(item => item.text === text))
      .map(text => ({
        id: crypto.randomUUID(),
        text,
        isDone: false
      }));

    if (newItems.length > 0) {
      onUpdate({
        ...trip,
        checklists: {
          ...trip.checklists,
          packing: [...trip.checklists.packing, ...newItems]
        },
        timestamp: Date.now()
      });
    }
  };

  const handleAddDefaultTodoList = () => {
    if (!confirm('要加入常用的預設待辦清單嗎？')) return;
    
    const defaults = ['訂機票', '訂飯店', '辦簽證', '買旅遊險', '換外幣', '預約機場接送'];
    const newItems = defaults
      .filter(text => !currentList.some(item => item.text === text))
      .map(text => ({
        id: crypto.randomUUID(),
        text,
        isDone: false
      }));

    if (newItems.length > 0) {
      onUpdate({
        ...trip,
        checklists: {
          ...trip.checklists,
          todo: [...trip.checklists.todo, ...newItems]
        },
        timestamp: Date.now()
      });
    }
  };

  const doneCount = currentList.filter(i => i.isDone).length;
  const totalCount = currentList.length;
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* Sub-tab Selection */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            background: activeList === 'packing' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
            color: activeList === 'packing' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeList === 'packing' ? 600 : 400,
            cursor: 'pointer',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: activeList === 'packing' ? 'var(--accent-primary)' : 'var(--border-color)',
            transition: 'all 0.2s'
          }}
          onClick={() => setActiveList('packing')}
        >
          <CheckSquare size={20} /> 行李打包清單
        </button>
        <button 
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            background: activeList === 'todo' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
            color: activeList === 'todo' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeList === 'todo' ? 600 : 400,
            cursor: 'pointer',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: activeList === 'todo' ? 'var(--accent-primary)' : 'var(--border-color)',
            transition: 'all 0.2s'
          }}
          onClick={() => setActiveList('todo')}
        >
          <ListTodo size={20} /> 行前準備清單
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header & Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0' }}>{activeList === 'packing' ? '行李清單' : '待辦事項'}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              完成進度: {doneCount} / {totalCount} ({progress}%)
            </div>
          </div>
          {totalCount === 0 && (
            <button 
              className="btn btn-ghost" 
              style={{ fontSize: '0.85rem' }} 
              onClick={activeList === 'packing' ? handleAddDefaultPackingList : handleAddDefaultTodoList}
            >
              載入預設清單
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {/* Add Item Form */}
        <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            value={newItemText} 
            onChange={e => setNewItemText(e.target.value)} 
            placeholder={activeList === 'packing' ? "例如：隱形眼鏡、刮鬍刀..." : "例如：換日圓、買車票..."}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 1rem' }} disabled={!newItemText.trim()}>
            <Plus size={18} />
          </button>
        </form>

        {/* List Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
          {currentList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              目前沒有任何項目，請從上方新增。
            </div>
          ) : (
            currentList.map(item => (
              <div 
                key={item.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '0.75rem 1rem', 
                  background: 'var(--bg-dark)', 
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: item.isDone ? 'var(--accent-primary)' : 'var(--border-color)',
                  opacity: item.isDone ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <button 
                  style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '6px', 
                    border: '1px solid',
                    borderColor: item.isDone ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    background: item.isDone ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff',
                    padding: 0
                  }}
                  onClick={() => handleToggleItem(item.id)}
                >
                  {item.isDone && <Check size={14} strokeWidth={3} />}
                </button>
                <div style={{ flex: 1, textDecoration: item.isDone ? 'line-through' : 'none', color: item.isDone ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  {item.text}
                </div>
                <button className="btn btn-ghost" style={{ padding: '0.25rem', color: 'var(--text-secondary)' }} onClick={() => handleDeleteItem(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
