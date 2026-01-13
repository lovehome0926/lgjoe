
import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, 
  Table, 
  TrendingUp, 
  Save,
  Sparkles,
  Maximize2,
  Minimize2,
  DownloadCloud,
  UploadCloud,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import { MonthlyData, ProductFilter, ActiveTab, Category, StrategicPlan } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import DataEntry from './components/DataEntry.tsx';

const INITIAL_CATEGORIES: Category[] = [
  { id: 'water', name: 'Water Systems', color: 'indigo', type: 'sales' },
  { id: 'air', name: 'Air Purifiers', color: 'emerald', type: 'sales' },
  { id: 'leads', name: 'Total Leads', color: 'amber', type: 'activity' },
  { id: 'served', name: 'Leads Served', color: 'cyan', type: 'activity' },
  { id: 'closed', name: 'Deals Closed', color: 'emerald', type: 'activity' },
  { id: 'recruitment', name: 'Agent Recruitment', color: 'rose', type: 'recruitment' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateInitialData = (categories: Category[]): MonthlyData[] => {
  return MONTHS.map(month => {
    const entry: MonthlyData = { month };
    categories.forEach(cat => {
      entry[`${cat.id}Target`] = 0;
      entry[`${cat.id}Actual`] = 0;
    });
    return entry;
  });
};

export default function App() {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('sales_categories_v3');
    try {
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [data, setData] = useState<MonthlyData[]>(() => {
    const saved = localStorage.getItem('sales_data_v3');
    try {
      return saved ? JSON.parse(saved) : generateInitialData(INITIAL_CATEGORIES);
    } catch {
      return generateInitialData(INITIAL_CATEGORIES);
    }
  });

  const [savedPlan, setSavedPlan] = useState<StrategicPlan | null>(() => {
    const saved = localStorage.getItem('sales_strategy_v3');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories, data, savedPlan]);

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem('sales_categories_v3', JSON.stringify(categories));
    localStorage.setItem('sales_data_v3', JSON.stringify(data));
    if (savedPlan) {
      localStorage.setItem('sales_strategy_v3', JSON.stringify(savedPlan));
    } else {
      localStorage.removeItem('sales_strategy_v3');
    }
    setTimeout(() => {
      setIsSaving(false);
    }, 500);
  };

  const handleExport = () => {
    const backupData = {
      categories,
      data,
      savedPlan,
      exportedAt: new Date().toISOString(),
      version: "3.1"
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Agency_BI_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.data && Array.isArray(json.data)) {
          localStorage.setItem('sales_categories_v3', JSON.stringify(json.categories || INITIAL_CATEGORIES));
          localStorage.setItem('sales_data_v3', JSON.stringify(json.data));
          if (json.savedPlan) {
            localStorage.setItem('sales_strategy_v3', JSON.stringify(json.savedPlan));
          } else {
            localStorage.removeItem('sales_strategy_v3');
          }
          alert("Restore Successful! The engine will restart to apply data.");
          window.location.reload(); 
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) { 
        alert("Failed to read the backup file."); 
      }
    };
    reader.readAsText(file);
  };

  const handleDataChange = (index: number, field: string, value: string | number) => {
    const newData = [...data];
    newData[index][field] = Number(value);
    setData(newData);
  };

  const addCategory = (name: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (categories.find(c => c.id === id)) return;
    const colors = ['indigo', 'emerald', 'rose', 'amber', 'cyan', 'purple', 'orange'];
    const newColor = colors[categories.length % colors.length];
    const newCat: Category = { id, name, color: newColor, type: 'sales' };
    setCategories(prev => [...prev, newCat]);
    setData(prev => prev.map(item => ({ ...item, [`${id}Target`]: 0, [`${id}Actual`] : 0 })));
  };

  const removeCategory = (id: string) => {
    if (categories.length <= 1) return;
    setCategories(categories.filter(c => c.id !== id));
  };

  const togglePresentation = () => {
    setIsPresentationMode(!isPresentationMode);
    if (!isPresentationMode) setActiveTab('dashboard');
  };

  const finalizePlan = (plan: StrategicPlan) => {
    setSavedPlan(plan);
    localStorage.setItem('sales_strategy_v3', JSON.stringify(plan));
    handleSave();
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isPresentationMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC]'}`}>
      {!isPresentationMode && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-20 items-center">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                  <TrendingUp className="text-white w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">
                    Strategic Hub <span className="text-indigo-600">2026</span>
                  </h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">AI-Powered Agency BI</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 gap-1">
                   <button title="Download Backup" onClick={handleExport} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-slate-500 transition-all flex items-center gap-2 text-[10px] font-black uppercase"><DownloadCloud size={16} /></button>
                   <button title="Upload Backup" onClick={() => fileInputRef.current?.click()} className="p-2.5 hover:bg-white hover:shadow-sm rounded-xl text-slate-500 transition-all flex items-center gap-2 text-[10px] font-black uppercase"><UploadCloud size={16} /></button>
                   <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <button onClick={handleSave} disabled={isSaving} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-sm ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} {isSaving ? 'Syncing...' : 'Save Sync'}
                </button>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button onClick={() => setActiveTab('dashboard')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><BarChart2 size={14} /> Analytics</button>
                  <button onClick={() => setActiveTab('strategy')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'strategy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Lightbulb size={14} /> Strategy</button>
                  <button onClick={() => setActiveTab('edit')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Table size={14} /> Matrix</button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      <button onClick={togglePresentation} className={`fixed bottom-6 right-6 z-[100] px-8 py-5 rounded-[2rem] shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-4 font-black text-[10px] uppercase tracking-[0.2em] ${isPresentationMode ? 'bg-white text-slate-900' : 'bg-indigo-600 text-white'}`}>
        {isPresentationMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />} {isPresentationMode ? 'Exit Deck' : 'Launch Presentation'}
      </button>

      <main className={`${isPresentationMode ? 'w-full h-screen overflow-hidden' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {!isPresentationMode && (
          <div className="mb-10 animate-fade-in flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                {activeTab === 'dashboard' ? 'Performance Analytics' : activeTab === 'strategy' ? 'Strategy Workshop' : 'Data Entry Matrix'}
                <Sparkles className="text-amber-500 w-6 h-6" />
              </h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Dynamic Intelligence Dashboard v3.1</p>
            </div>
          </div>
        )}

        <div className="animate-fade-in h-full">
          {activeTab === 'edit' ? (
            <DataEntry data={data} categories={categories} onDataChange={handleDataChange} onAddCategory={addCategory} onRemoveCategory={removeCategory} onSetData={setData} onFinish={() => setActiveTab('dashboard')} />
          ) : (
            <Dashboard 
              data={data} 
              filter={productFilter} 
              setFilter={setProductFilter} 
              categories={categories} 
              isPresentationMode={isPresentationMode}
              savedPlan={savedPlan}
              onPlanFinalize={finalizePlan}
              isStrategyLab={activeTab === 'strategy'}
            />
          )}
        </div>
      </main>
    </div>
  );
}
