import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { syncTravels } from '../../lib/travelSync';
import type { Trip } from '../../lib/travelSync';
import { Plane, Plus, Loader2, Calendar, Map, Trash2, ArrowLeft, Settings } from 'lucide-react';
import TripDetail from './TripDetail';
import TemplateManager from './TemplateManager';

export default function TravelApp() {
  const { token, activeFolderId: folderId } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');

  const loadData = async () => {
    if (!token || !folderId) return;
    setIsLoading(true);
    try {
      const syncedTrips = await syncTravels(token, folderId, trips);
      setTrips(syncedTrips);
    } catch (e) {
      console.error(e);
      alert('同步旅遊資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTrips([]);
    setSelectedTripId(null);
    loadData();
  }, [folderId]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) return;

    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title,
      startDate,
      endDate,
      budget: Number(budget) || 0,
      days: [],
      checklists: { packing: [], todo: [] },
      expenses: [],
      timestamp: Date.now()
    };

    // Pre-populate days based on date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      newTrip.days.push({
        id: crypto.randomUUID(),
        date: d.toISOString().split('T')[0],
        items: []
      });
    }

    const updatedTrips = [newTrip, ...trips];
    setTrips(updatedTrips);
    setIsModalOpen(false);
    setTitle('');
    setStartDate('');
    setEndDate('');
    setBudget('');

    if (token && folderId) {
      syncTravels(token, folderId, updatedTrips).then(setTrips);
    }
  };

  const handleDeleteTrip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('確定要刪除這個旅程嗎？此操作無法復原。')) return;

    const updatedTrips = trips.map(t => 
      t.id === id ? { ...t, isDeleted: true, timestamp: Date.now() } : t
    );
    setTrips(updatedTrips);

    if (token && folderId) {
      syncTravels(token, folderId, updatedTrips).then(setTrips);
    }
  };

  const activeTrips = trips.filter(t => !t.isDeleted);
  const selectedTrip = trips.find(t => t.id === selectedTripId);

  if (selectedTrip && selectedTripId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-dark)' }}>
        <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <button className="btn btn-ghost" style={{ padding: '0.5rem' }} onClick={() => setSelectedTripId(null)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{selectedTrip.title}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {selectedTrip.startDate} ~ {selectedTrip.endDate}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TripDetail 
            trip={selectedTrip} 
            onUpdate={(updatedTrip) => {
              const newTrips = trips.map(t => t.id === updatedTrip.id ? updatedTrip : t);
              setTrips(newTrips);
              if (token && folderId) {
                syncTravels(token, folderId, newTrips);
              }
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Plane color="var(--accent-primary)" /> 旅遊行程
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setIsTemplateManagerOpen(true)}>
            <Settings size={16} /> 管理清單範本
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> 新增旅程
          </button>
        </div>
      </div>

      {isLoading && activeTrips.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : activeTrips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Map size={48} style={{ opacity: 0.5, margin: '0 auto 1rem' }} />
          <p>尚未建立任何旅程，開始規劃你的下一趟旅行吧！</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setIsModalOpen(true)}>
            新增旅程
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {activeTrips.map(trip => (
            <div 
              key={trip.id} 
              style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '1.25rem',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onClick={() => setSelectedTripId(trip.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <button 
                className="btn btn-ghost" 
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.5rem', color: 'var(--text-secondary)' }}
                onClick={(e) => handleDeleteTrip(trip.id, e)}
              >
                <Trash2 size={16} />
              </button>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', paddingRight: '2rem' }}>{trip.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <Calendar size={14} />
                <span>{trip.startDate} ~ {trip.endDate}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                總預算: ${trip.budget.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem 0' }}>新增旅程</h3>
            <form onSubmit={handleCreateTrip}>
              <div className="form-group">
                <label>旅程名稱</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="例如：日本京阪神五日遊"
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>開始日期</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>結束日期</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>總預算 (可留空)</label>
                <input 
                  type="number" 
                  value={budget} 
                  onChange={e => setBudget(e.target.value)} 
                  placeholder="0"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>取消</button>
                <button type="submit" className="btn btn-primary">建立</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTemplateManagerOpen && (
        <TemplateManager onClose={() => setIsTemplateManagerOpen(false)} />
      )}
    </div>
  );
}
