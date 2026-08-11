import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import { syncFoodLists } from '../../lib/foodSync';
import type { FoodList, FoodPlace } from '../../lib/foodSync';
import { Utensils, Plus, Trash2, Shuffle, MapPin, Upload, Link as LinkIcon, Loader2 } from 'lucide-react';

export default function FoodApp() {
  const { token, activeFolderId: folderId } = useAuth();
  const [lists, setLists] = useState<FoodList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  
  // Randomizer state
  const [isSpinning, setIsSpinning] = useState(false);
  const [randomResult, setRandomResult] = useState<FoodPlace | null>(null);
  const [currentSpinName, setCurrentSpinName] = useState<string>('');

  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('新餐廳清單');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token || !folderId) return;
    setIsLoading(true);
    syncFoodLists(token, folderId, [])
      .then(fetched => {
        setLists(fetched);
        if (fetched.length > 0) {
          setActiveListId(fetched[0].id);
          setSelectedListIds(new Set(fetched.map(f => f.id)));
        }
      })
      .finally(() => setIsLoading(false));
  }, [token, folderId]);

  const activeLists = lists.filter(l => !l.isDeleted);

  const saveLists = async (newLists: FoodList[]) => {
    setLists(newLists);
    if (token && folderId) {
      await syncFoodLists(token, folderId, newLists);
    }
  };

  const handleCreateList = async () => {
    const places: FoodPlace[] = importText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(name => ({ id: crypto.randomUUID(), name }));
    
    if (places.length === 0) {
      alert('請至少輸入一家餐廳！');
      return;
    }

    const newList: FoodList = {
      id: crypto.randomUUID(),
      name: importName || '新餐廳清單',
      places,
      timestamp: Date.now()
    };

    await saveLists([newList, ...lists]);
    setSelectedListIds(prev => new Set(prev).add(newList.id));
    setActiveListId(newList.id);
    setIsImportModalOpen(false);
    setImportText('');
    setImportName('新餐廳清單');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      // Basic CSV parsing for Google Takeout 'Saved Places.csv'
      // Title, Note, URL, Comment
      const lines = text.split('\n');
      const places: string[] = [];
      
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        let title = '';
        if (line.startsWith('"')) {
          const endQuote = line.indexOf('"', 1);
          if (endQuote !== -1) {
            title = line.substring(1, endQuote);
          }
        } else {
          title = line.split(',')[0];
        }
        
        if (title) places.push(title);
      }

      if (places.length > 0) {
        setImportText(places.join('\n'));
        setImportName(file.name.replace('.csv', ''));
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromUrl = async () => {
    const url = prompt('請貼上 Google Maps 清單的分享連結 (需為公開清單)：');
    if (!url) return;
    
    setImportText('正在解析連結中，請稍候...');
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      const html = data.contents;
      
      // Heuristic extraction for Google Maps List HTML
      const places = new Set<string>();
      
      // Method 1: Look for og:description which sometimes lists places
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
      if (descMatch && descMatch[1]) {
        const desc = descMatch[1];
        if (desc.includes('·')) {
          desc.split('·').forEach((p: string) => places.add(p.trim()));
        }
      }

      // Method 2: Look for title elements
      const titleRegex = /<meta content="([^"]+)" itemprop="name"/g;
      let match;
      while ((match = titleRegex.exec(html)) !== null) {
        places.add(match[1]);
      }

      if (places.size > 0) {
        setImportText(Array.from(places).join('\n'));
      } else {
        setImportText('無法自動解析此連結內的餐廳。\n請嘗試使用「Google Takeout 匯出 CSV」或手動複製貼上。');
      }
    } catch (e) {
      setImportText('解析失敗，可能是網路阻擋或連結無效。建議手動貼上或使用 CSV 匯入。');
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('確定要刪除這個清單嗎？')) return;
    const newLists = lists.map(l => l.id === id ? { ...l, isDeleted: true, timestamp: Date.now() } : l);
    await saveLists(newLists);
    if (activeListId === id) {
      setActiveListId(activeLists.find(l => l.id !== id)?.id || null);
    }
  };

  const toggleListSelection = (id: string) => {
    const next = new Set(selectedListIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedListIds(next);
  };

  const spin = () => {
    // Gather all places from selected lists
    const candidatePlaces: FoodPlace[] = [];
    activeLists.forEach(list => {
      if (selectedListIds.has(list.id)) {
        candidatePlaces.push(...list.places);
      }
    });

    if (candidatePlaces.length === 0) {
      alert('請先勾選至少一個包含餐廳的清單！');
      return;
    }

    setIsSpinning(true);
    setRandomResult(null);
    
    // Animation effect
    let spins = 0;
    const maxSpins = 20;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * candidatePlaces.length);
      setCurrentSpinName(candidatePlaces[randomIndex].name);
      spins++;
      
      if (spins >= maxSpins) {
        clearInterval(interval);
        const finalWinner = candidatePlaces[Math.floor(Math.random() * candidatePlaces.length)];
        setRandomResult(finalWinner);
        setCurrentSpinName('');
        setIsSpinning(false);
      }
    }, 100); // 100ms per spin step
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Utensils color="var(--accent-primary)" /> 吃什麼 (美食扭蛋)
        </h2>
        <button className="btn btn-primary" onClick={() => setIsImportModalOpen(true)}>
          <Plus size={16} /> 新增/匯入清單
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel: Lists Management */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0 }}>我的清單</h3>
          
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /></div>
            ) : activeLists.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                尚未建立清單
              </div>
            ) : (
              activeLists.map(list => (
                <div 
                  key={list.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.75rem', 
                    background: activeListId === list.id ? 'var(--bg-dark)' : 'transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: activeListId === list.id ? 'var(--accent-primary)' : 'transparent'
                  }}
                  onClick={() => setActiveListId(list.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedListIds.has(list.id)}
                    onChange={() => toggleListSelection(list.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {list.name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({list.places.length})</span>
                  </div>
                  <button 
                    className="btn btn-ghost" 
                    style={{ padding: '0.25rem' }} 
                    onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                  >
                    <Trash2 size={14} color="var(--text-secondary)" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Randomizer & List View */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
          {/* Randomizer Section */}
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 2rem 0', color: 'var(--text-secondary)' }}>從已勾選的清單中隨機抽選一家餐廳</h3>
            
            {isSpinning ? (
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '2rem', animation: 'pulse 0.5s infinite alternate' }}>
                {currentSpinName || '思考中...'}
              </div>
            ) : randomResult ? (
              <div style={{ animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
                  {randomResult.name}
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(randomResult.name)}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: '#3b82f6' }}
                >
                  <MapPin size={20} /> 在 Google Maps 查看
                </a>
              </div>
            ) : (
              <div style={{ fontSize: '2rem', color: 'var(--text-secondary)', marginBottom: '2rem', opacity: 0.5 }}>
                ?
              </div>
            )}

            <button 
              className="btn btn-primary" 
              style={{ padding: '1rem 3rem', fontSize: '1.2rem', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: randomResult ? '2rem' : 0 }}
              onClick={spin}
              disabled={isSpinning || selectedListIds.size === 0}
            >
              <Shuffle size={24} /> {randomResult ? '再抽一次' : '開始抽籤'}
            </button>
          </div>

          {/* Active List View */}
          {activeListId && (
            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>{activeLists.find(l => l.id === activeListId)?.name} 餐廳列表</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {activeLists.find(l => l.id === activeListId)?.places.map(place => (
                  <div key={place.id} style={{ background: 'var(--bg-dark)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>
                    {place.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <h2>新增 / 匯入餐廳清單</h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
                <Upload size={18} /> 上傳 Google Maps CSV
              </button>
              <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              
              <button className="btn btn-ghost" onClick={handleImportFromUrl} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem', border: '1px solid var(--border-color)' }}>
                <LinkIcon size={18} /> 貼上分享連結
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>清單名稱</label>
              <input 
                type="text" 
                value={importName} 
                onChange={e => setImportName(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>餐廳名單 (每行一家)</label>
              <textarea 
                value={importText} 
                onChange={e => setImportText(e.target.value)} 
                rows={10}
                placeholder="在此貼上多筆餐廳名稱..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-dark)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-ghost" onClick={() => setIsImportModalOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreateList} disabled={!importText.trim()}>儲存清單</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
