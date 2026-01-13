import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Edit3, CheckCircle, Plus, Trash2, Camera, Loader2, Package, Briefcase, 
  ChevronRight, Activity, Filter, MousePointerClick, X
} from 'lucide-react';
import { MonthlyData, Category } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

interface DataEntryProps {
  data: MonthlyData[];
  categories: Category[];
  onDataChange: (index: number, field: string, value: string | number) => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (id: string) => void;
  onSetData: (data: MonthlyData[]) => void;
  onFinish: () => void;
}

const DataEntry: React.FC<DataEntryProps> = ({ 
  data, categories, onDataChange, onAddCategory, onRemoveCategory, onSetData, onFinish 
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'products' | 'talent' | 'activity'>('products');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const visionInputRef = useRef<HTMLInputElement>(null);

  const productCategories = useMemo(() => categories.filter(c => c.type === 'sales'), [categories]);
  const talentCategories = useMemo(() => categories.filter(c => c.type === 'recruitment'), [categories]);
  const activityCategories = useMemo(() => categories.filter(c => c.type === 'activity'), [categories]);
  
  const activeCategories = useMemo(() => {
    if (activeMainTab === 'products') return productCategories;
    if (activeMainTab === 'talent') return talentCategories;
    return activityCategories;
  }, [activeMainTab, productCategories, talentCategories, activityCategories]);

  const [focusedCatId, setFocusedCatId] = useState<string | null>(null);
  
  useEffect(() => {
    if (activeMainTab === 'products' || activeMainTab === 'talent') {
      if (activeCategories.length > 0) {
        // If the current focusedCatId is no longer in active categories, switch to first available
        if (!activeCategories.find(c => c.id === focusedCatId)) {
          setFocusedCatId(activeCategories[0].id);
        }
      } else {
        setFocusedCatId(null);
      }
    } else {
      setFocusedCatId('funnel_combined');
    }
  }, [activeMainTab, activeCategories]);

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim());
      setNewCatName('');
      setIsAddingCat(false);
    }
  };

  const handleVisionImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isAiProcessing) return;
    setIsAiProcessing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>(resolve => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ inlineData: { data: base64Data, mimeType: file.type } }, { text: `Extract monthly table data. Return valid JSON.` }] }],
        config: { responseMimeType: "application/json" }
      });
      alert("AI scan simulation: Verify data mapping.");
    } catch (err) { alert("AI Vision failed."); } finally { setIsAiProcessing(false); }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div className="flex flex-col items-center gap-6 mb-2">
        <div className="bg-slate-200/50 p-1.5 rounded-[2.5rem] flex gap-2 border border-slate-100 shadow-inner max-w-full overflow-x-auto flex-nowrap no-scrollbar">
          <button onClick={() => setActiveMainTab('products')} className={`flex items-center gap-3 px-10 py-4 rounded-[2.2rem] text-xs font-black uppercase transition-all whitespace-nowrap ${activeMainTab === 'products' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}><Package size={18} /> Sales Portfolio</button>
          <button onClick={() => setActiveMainTab('talent')} className={`flex items-center gap-3 px-10 py-4 rounded-[2.2rem] text-xs font-black uppercase transition-all whitespace-nowrap ${activeMainTab === 'talent' ? 'bg-white text-rose-600 shadow-xl' : 'text-slate-500'}`}><Briefcase size={18} /> Recruitment</button>
          <button onClick={() => setActiveMainTab('activity')} className={`flex items-center gap-3 px-10 py-4 rounded-[2.2rem] text-xs font-black uppercase transition-all whitespace-nowrap ${activeMainTab === 'activity' ? 'bg-white text-cyan-600 shadow-xl' : 'text-slate-500'}`}><Activity size={18} /> Funnel Activity</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Structure</h3>
               {activeMainTab === 'products' && (
                 <button 
                  onClick={() => setIsAddingCat(true)}
                  className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                  title="Add Category"
                 >
                   <Plus size={16} />
                 </button>
               )}
             </div>

             {isAddingCat && (
               <div className="mb-4 p-4 bg-indigo-50 rounded-2xl animate-fade-in border border-indigo-100">
                 <p className="text-[10px] font-black uppercase text-indigo-600 mb-2">New Sales Category</p>
                 <div className="flex gap-2">
                    <input 
                      autoFocus
                      type="text" 
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="e.g. Solar Panels" 
                      className="flex-1 p-2 text-xs font-bold bg-white border border-indigo-200 rounded-lg outline-none"
                    />
                    <button onClick={handleAddCategory} className="p-2 bg-indigo-600 text-white rounded-lg"><CheckCircle size={16} /></button>
                    <button onClick={() => setIsAddingCat(false)} className="p-2 text-slate-400"><X size={16} /></button>
                 </div>
               </div>
             )}

             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
              {activeMainTab === 'activity' ? (
                <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-100">
                  <p className="text-[10px] font-black uppercase text-cyan-600 mb-1">Combined Mode</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Editing Leads, Served, & Closed side-by-side.</p>
                </div>
              ) : activeCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-slate-200 transition-all">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{c.name}</span>
                  {activeMainTab === 'products' && categories.length > 1 && (
                    <button 
                      onClick={() => onRemoveCategory(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {activeCategories.length === 0 && activeMainTab !== 'activity' && (
                <div className="p-10 text-center opacity-30 italic text-xs font-bold uppercase">No items in domain</div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white">
            <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-3 mb-4"><Camera size={20} className="text-indigo-400" /> Vision Sync</h4>
            <p className="text-[10px] text-white/40 font-bold uppercase mb-6">Import table data from screenshots.</p>
            <button onClick={() => visionInputRef.current?.click()} className="w-full py-4 rounded-2xl font-black text-[10px] uppercase bg-indigo-600">Scan Table</button>
            <input type="file" ref={visionInputRef} onChange={handleVisionImport} accept="image/*" className="hidden" />
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[850px]">
          <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-5">
            <div className={`p-3 rounded-2xl ${activeMainTab === 'products' ? 'bg-indigo-100 text-indigo-600' : activeMainTab === 'talent' ? 'bg-rose-100 text-rose-600' : 'bg-cyan-100 text-cyan-600'}`}><Edit3 size={20} /></div>
            <div><p className="text-sm font-black text-slate-900 uppercase">Performance Matrix</p></div>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-[500px]">
             {activeMainTab !== 'activity' && (
               <div className="w-1/3 border-r border-slate-100 bg-slate-50/30 overflow-y-auto p-6 space-y-3 no-scrollbar">
                  {activeCategories.map(cat => (
                    <button key={cat.id} onClick={() => setFocusedCatId(cat.id)} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${focusedCatId === cat.id ? 'bg-white border-indigo-200 shadow-md' : 'bg-transparent border-transparent hover:bg-slate-100'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 text-left leading-tight">{cat.name}</span>
                      <ChevronRight size={14} className={focusedCatId === cat.id ? 'text-indigo-400' : 'text-slate-300'} />
                    </button>
                  ))}
               </div>
             )}
             <div className="flex-1 overflow-y-auto p-10 bg-white no-scrollbar">
               {activeMainTab === 'activity' ? (
                 <div className="space-y-6">
                    <h4 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">Funnel Performance Spreadsheet <Filter size={20} className="text-cyan-500"/></h4>
                    <div className="grid grid-cols-12 gap-4 px-4 text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">
                      <div className="col-span-3">Month</div>
                      <div className="col-span-3 text-center">Leads</div>
                      <div className="col-span-3 text-center">Served</div>
                      <div className="col-span-3 text-center">Closed</div>
                    </div>
                    <div className="space-y-3 pb-10">
                      {data.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-4 items-center p-3 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-colors">
                          <div className="col-span-3 font-black text-slate-900 text-[10px] uppercase">{row.month}</div>
                          <div className="col-span-3"><input type="number" value={row['leadsActual'] || 0} onChange={e => onDataChange(idx, 'leadsActual', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold" /></div>
                          <div className="col-span-3"><input type="number" value={row['servedActual'] || 0} onChange={e => onDataChange(idx, 'servedActual', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold" /></div>
                          <div className="col-span-3"><input type="number" value={row['closedActual'] || 0} onChange={e => onDataChange(idx, 'closedActual', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-black text-emerald-600" /></div>
                        </div>
                      ))}
                    </div>
                 </div>
               ) : focusedCatId ? (
                 <div className="space-y-6">
                    <h4 className="text-xl font-black uppercase tracking-tighter leading-tight">{activeCategories.find(c => c.id === focusedCatId)?.name} Matrix</h4>
                    <div className="grid grid-cols-12 gap-4 px-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      <div className="col-span-4">Month</div>
                      <div className="col-span-4 text-center">Target</div>
                      <div className="col-span-4 text-center">Actual</div>
                    </div>
                    <div className="space-y-3 pb-10">
                      {data.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 rounded-2xl">
                          <div className="col-span-4 font-black text-slate-900 text-xs uppercase">{row.month}</div>
                          <div className="col-span-4"><input type="number" value={row[`${focusedCatId}Target`] || 0} onChange={e => onDataChange(idx, `${focusedCatId}Target`, e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold" /></div>
                          <div className="col-span-4"><input type="number" value={row[`${focusedCatId}Actual`] || 0} onChange={e => onDataChange(idx, `${focusedCatId}Actual`, e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-black text-indigo-600" /></div>
                        </div>
                      ))}
                    </div>
                 </div>
               ) : <div className="h-full flex items-center justify-center text-slate-300 text-xs font-black uppercase">Select Section</div>}
             </div>
          </div>
          <div className="p-10 bg-slate-50/80 border-t border-slate-100 flex justify-end">
            <button onClick={onFinish} className="px-20 py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 uppercase text-[10px] tracking-widest">Sync Agency Matrix <CheckCircle size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataEntry;