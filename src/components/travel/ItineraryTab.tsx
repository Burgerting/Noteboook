import React, { useState } from 'react';
import type { Trip, TravelItem } from '../../lib/travelSync';
import { Map, Clock, Plus, Trash2, ExternalLink } from 'lucide-react';

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

export default function ItineraryTab({ trip, onUpdate }: Props) {
  const [selectedDayId, setSelectedDayId] = useState<string>(trip.days[0]?.id || '');
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [note, setNote] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedDayId) return;

    const newItem: TravelItem = {
      id: crypto.randomUUID(),
      time,
      title,
      location,
      locationUrl,
      note
    };

    const updatedDays = trip.days.map(day => {
      if (day.id === selectedDayId) {
        // Add and sort by time
        const newItems = [...day.items, newItem].sort((a, b) => a.time.localeCompare(b.time));
        return { ...day, items: newItems };
      }
      return day;
    });

    onUpdate({
      ...trip,
      days: updatedDays,
      timestamp: Date.now()
    });

    setIsAdding(false);
    setTime('');
    setTitle('');
    setLocation('');
    setLocationUrl('');
    setNote('');
  };

  const handleDeleteItem = (dayId: string, itemId: string) => {
    if (!confirm('確定要刪除此行程嗎？')) return;

    const updatedDays = trip.days.map(day => {
      if (day.id === dayId) {
        return { ...day, items: day.items.filter(item => item.id !== itemId) };
      }
      return day;
    });

    onUpdate({
      ...trip,
      days: updatedDays,
      timestamp: Date.now()
    });
  };

  const selectedDay = trip.days.find(d => d.id === selectedDayId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Day Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {trip.days.map((day, index) => (
          <button
            key={day.id}
            onClick={() => setSelectedDayId(day.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              border: 'none',
              background: day.id === selectedDayId ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: day.id === selectedDayId ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: day.id === selectedDayId ? 600 : 400,
              boxShadow: day.id === selectedDayId ? '0 2px 8px rgba(59, 130, 246, 0.4)' : 'none'
            }}
          >
            Day {index + 1} ({day.date.substring(5)})
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedDay && selectedDay.items.length === 0 && !isAdding ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <p>這天還沒有安排任何行程哦！</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setIsAdding(true)}>
              新增行程
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Timeline View */}
            {selectedDay?.items.map((item, index) => (
              <div key={item.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                {/* Timeline Line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)', marginTop: '0.25rem', zIndex: 1 }}></div>
                  {index < selectedDay.items.length - 1 && (
                    <div style={{ width: '2px', flex: 1, background: 'var(--border-color)', margin: '4px 0' }}></div>
                  )}
                </div>
                
                {/* Content Card */}
                <div style={{ flex: 1, background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', position: 'relative', marginBottom: index === selectedDay.items.length - 1 ? 0 : '0.5rem' }}>
                  <button 
                    className="btn btn-ghost" 
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem', color: 'var(--text-secondary)' }}
                    onClick={() => handleDeleteItem(selectedDay.id, item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <Clock size={14} /> {item.time || '未定時'}
                  </div>
                  
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{item.title}</h4>
                  
                  {item.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <Map size={14} /> 
                      {item.locationUrl ? (
                        <a href={item.locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {item.location} <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span>{item.location}</span>
                      )}
                    </div>
                  )}
                  
                  {item.note && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', background: 'var(--bg-dark)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                      {item.note}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isAdding ? (
              <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <form onSubmit={handleAddItem}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>時間</label>
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 3 }}>
                      <label>標題 (必填)</label>
                      <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="例如：清水寺" />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>地點名稱</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例如：京都市東山區清水1丁目294" />
                  </div>
                  
                  <div className="form-group">
                    <label>Google Maps 連結</label>
                    <input type="url" value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  
                  <div className="form-group">
                    <label>備註</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="營業時間、必吃美食..." />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>取消</button>
                    <button type="submit" className="btn btn-primary">儲存</button>
                  </div>
                </form>
              </div>
            ) : (
              <button 
                className="btn btn-ghost" 
                style={{ width: '100%', padding: '1rem', border: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: selectedDay?.items.length ? '1rem' : 0 }}
                onClick={() => setIsAdding(true)}
              >
                <Plus size={16} /> 新增行程
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
