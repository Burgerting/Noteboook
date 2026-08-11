import React, { useState } from 'react';
import { Trip } from '../../lib/travelSync';
import { MapPin, DollarSign, CheckSquare } from 'lucide-react';
import ItineraryTab from './ItineraryTab';
import TravelExpensesTab from './TravelExpensesTab';
import ChecklistsTab from './ChecklistsTab';

interface TripDetailProps {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

type TabType = 'itinerary' | 'expenses' | 'checklists';

export default function TripDetail({ trip, onUpdate }: TripDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', padding: '0 1rem' }}>
        <button 
          className={`nav-tab ${activeTab === 'itinerary' ? 'active' : ''}`}
          onClick={() => setActiveTab('itinerary')}
          style={{ padding: '0.75rem 1rem', border: 'none', borderBottom: activeTab === 'itinerary' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'itinerary' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'itinerary' ? 600 : 400 }}
        >
          <MapPin size={16} /> 行程表
        </button>
        <button 
          className={`nav-tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
          style={{ padding: '0.75rem 1rem', border: 'none', borderBottom: activeTab === 'expenses' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'expenses' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'expenses' ? 600 : 400 }}
        >
          <DollarSign size={16} /> 旅遊記帳
        </button>
        <button 
          className={`nav-tab ${activeTab === 'checklists' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklists')}
          style={{ padding: '0.75rem 1rem', border: 'none', borderBottom: activeTab === 'checklists' ? '2px solid var(--accent-primary)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'checklists' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'checklists' ? 600 : 400 }}
        >
          <CheckSquare size={16} /> 清單
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {activeTab === 'itinerary' && <ItineraryTab trip={trip} onUpdate={onUpdate} />}
        {activeTab === 'expenses' && <TravelExpensesTab trip={trip} onUpdate={onUpdate} />}
        {activeTab === 'checklists' && <ChecklistsTab trip={trip} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
