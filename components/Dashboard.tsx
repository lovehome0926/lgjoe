import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, Line, ComposedChart, Area
} from 'recharts';
import { 
  Trophy, Target, Activity, CheckCircle2, Send, Bot, Loader2, Users, 
  ChevronLeft, ChevronRight, LayoutGrid, Presentation, Award,
  Target as TargetIcon, ArrowUpRight, ArrowDownRight, Sparkles, 
  Calendar, Zap, GraduationCap, ClipboardList, BookOpen, Save, Trash2,
  Lightbulb, Search, PieChart, FileText, AlertTriangle, CheckSquare,
  Filter, MousePointerClick, Edit2, Megaphone, Gift, Flame, ShoppingBag,
  Rocket, Layers
} from 'lucide-react';
import { MonthlyData, ProductFilter, Category, ChatMessage, StrategicPlan } from '../types.ts';
import StatCard from './StatCard.tsx';
import { GoogleGenAI, Type } from '@google/genai';

interface DashboardProps {
  data: MonthlyData[];
  filter: ProductFilter;
  setFilter: (f: ProductFilter) => void;
  categories: Category[];
  isPresentationMode?: boolean;
  savedPlan?: StrategicPlan | null;
  onPlanFinalize?: (plan: StrategicPlan) => void;
  isStrategyLab?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  data, filter, setFilter, categories, isPresentationMode = false, 
  savedPlan = null, onPlanFinalize, isStrategyLab = false 
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeChatTab, setActiveChatTab] = useState<'sales' | 'recruitment' | 'strategy'>('sales');
  const [salesMessages, setSalesMessages] = useState<ChatMessage[]>([]);
  const [recruitMessages, setRecruitMessages] = useState<ChatMessage[]>([]);
  const [strategyMessages, setStrategyMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [tempPlan, setTempPlan] = useState<StrategicPlan | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMessages = useMemo(() => {
    if (activeChatTab === 'sales') return salesMessages;
    if (activeChatTab === 'recruitment') return recruitMessages;
    return strategyMessages;
  }, [activeChatTab, salesMessages, recruitMessages, strategyMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages]);

  const salesCategories = useMemo(() => categories.filter(c => c.type === 'sales'), [categories]);

  const metrics = useMemo(() => {
    const commercialCats = salesCategories;
    const recruitCats = categories.filter(c => c.type === 'recruitment');

    const calculate = (cats: Category[]) => {
      let t = 0, a = 0;
      data.forEach(item => {
        cats.forEach(cat => {
          t += (item[`${cat.id}Target`] as number || 0);
          a += (item[`${cat.id}Actual`] as number || 0);
        });
      });
      return { target: t, actual: a, percent: t > 0 ? parseFloat(((a / t) * 100).toFixed(1)) : 0 };
    };

    const funnel = { leads: 0, served: 0, closed: 0 };
    data.forEach(item => {
      funnel.leads += (item['leadsActual'] as number || 0);
      funnel.served += (item['servedActual'] as number || 0);
      funnel.closed += (item['closedActual'] as number || 0);
    });

    return {
      commercial: calculate(commercialCats),
      recruitment: calculate(recruitCats),
      funnel: {
        ...funnel,
        closingRate: funnel.leads > 0 ? parseFloat(((funnel.closed / funnel.leads) * 100).toFixed(1)) : 0,
        serviceRate: funnel.leads > 0 ? parseFloat(((funnel.served / funnel.leads) * 100).toFixed(1)) : 0
      }
    };
  }, [data, categories, salesCategories]);

  const domainData = useMemo(() => {
    return data.map(item => {
      let commTarget = 0, commActual = 0;
      let recTarget = 0, recActual = 0;
      categories.forEach(cat => {
        if (cat.type === 'sales') {
          commTarget += (item[`${cat.id}Target`] as number || 0);
          commActual += (item[`${cat.id}Actual`] as number || 0);
        } else if (cat.type === 'recruitment') {
          recTarget += (item[`${cat.id}Target`] as number || 0);
          recActual += (item[`${cat.id}Actual`] as number || 0);
        }
      });
      const leads = (item['leadsActual'] as number || 0);
      const closed = (item['closedActual'] as number || 0);
      return { 
        month: item.month, 
        commActual, commTarget, 
        recActual, recTarget,
        leads, 
        served: (item['servedActual'] as number || 0),
        closed,
        rate: leads > 0 ? parseFloat(((closed / leads) * 100).toFixed(1)) : 0
      };
    });
  }, [data, categories]);

  const handleUpdateTempPlan = (field: string, value: any) => {
    setTempPlan(prev => {
      const base = prev || savedPlan || {
        q1_discipline: '',
        q2_training: '',
        q3_marketing: { cny: '', raya: '', midYear: '', yearEnd: '' },
        q4_productivity: '',
        executive_summary: '',
        analysis_2025: ''
      };
      return { ...base, [field]: value };
    });
  };

  const handleUpdateQ3Marketing = (field: keyof StrategicPlan['q3_marketing'], value: string) => {
    setTempPlan(prev => {
      const base = prev || savedPlan || {
        q1_discipline: '',
        q2_training: '',
        q3_marketing: { cny: '', raya: '', midYear: '', yearEnd: '' },
        q4_productivity: '',
        executive_summary: '',
        analysis_2025: ''
      };
      return {
        ...base,
        q3_marketing: {
          ...base.q3_marketing,
          [field]: value
        }
      };
    });
  };

  const askAi = async (overrideInput?: string) => {
    const userMsg = overrideInput || input;
    if (!userMsg.trim() || isLoadingAi) return;
    const currentTab = activeChatTab;
    if (!overrideInput) setInput('');
    
    const msgUpdate = (role: 'user' | 'model', text: string) => {
      if (currentTab === 'sales') setSalesMessages(prev => [...prev, { role, text }]);
      else if (currentTab === 'recruitment') setRecruitMessages(prev => [...prev, { role, text }]);
      else setStrategyMessages(prev => [...prev, { role, text }]);
    };

    msgUpdate('user', userMsg);
    setIsLoadingAi(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextDataSummary = domainData.map(d => ({ month: d.month, recActual: d.recActual, recTarget: d.recTarget, salesActual: d.commActual, salesTarget: d.commTarget, leads: d.leads, closed: d.closed }));
      
      let systemInstruction = `You are a Performance Analyst. Data context: ${JSON.stringify(contextDataSummary)}. Current Plan/Audit context: ${JSON.stringify(tempPlan || savedPlan)}.`;
      let config: any = { systemInstruction };

      if (currentTab === 'strategy') {
        config.systemInstruction = "You are a Strategy Architect. Output structured JSON for audit/plan. Provide specific quarterly plans (Q1-Q4) based on 2025 performance gaps. Ensure Q3 includes marketing details for CNY, Raya, Mid-Year, and Year-End.";
        if (userMsg.toLowerCase().includes('audit') || userMsg.toLowerCase().includes('plan')) {
          config.responseMimeType = "application/json";
          config.responseSchema = {
            type: Type.OBJECT,
            properties: {
              q1_discipline: { type: Type.STRING },
              q2_training: { type: Type.STRING },
              q3_marketing: { 
                type: Type.OBJECT, 
                properties: { 
                  cny: { type: Type.STRING }, 
                  raya: { type: Type.STRING }, 
                  midYear: { type: Type.STRING }, 
                  yearEnd: { type: Type.STRING } 
                },
                required: ["cny", "raya", "midYear", "yearEnd"]
              },
              q4_productivity: { type: Type.STRING },
              executive_summary: { type: Type.STRING },
              analysis_2025: { type: Type.STRING }
            }
          };
        }
      }

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: userMsg, 
        config: config 
      });
      const aiText = response.text || "Analysis unavailable.";
      
      if (currentTab === 'strategy' && config.responseMimeType === "application/json") {
        try {
          const plan = JSON.parse(aiText);
          setTempPlan(prev => (prev ? { ...prev, ...plan } : plan));
          msgUpdate('model', "Strategic mapping updated in the lab panel.");
        } catch(e) { msgUpdate('model', aiText); }
      } else {
        msgUpdate('model', aiText);
      }
    } catch (err) { msgUpdate('model', "Connection error."); } finally { setIsLoadingAi(false); }
  };

  const handleStrategyAction = (action: 'analyze' | 'plan') => {
    const prompt = action === 'analyze' 
      ? "Perform a deep Performance Audit of 2025 based on data. Identify core problems and monthly volatility." 
      : "Build the 2026 Strategic Roadmap fixing the issues identified in the audit. Focus on Q1-Q4 growth, especially Q3 marketing campaigns.";
    setInput(prompt);
    setActiveChatTab('strategy');
    askAi(prompt);
  };

  const currentPlan = tempPlan || savedPlan;

  const slides = [
    {
      title: "Commercial Domain: Revenue Achievement",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
           <div className="space-y-6">
              <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[2.5rem]">
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-4">Portfolio Target Achievement</p>
                <div className="flex items-end gap-6">
                   <h3 className="text-6xl font-black text-white">{metrics.commercial.actual.toLocaleString()}</h3>
                   <div className="flex flex-col mb-1">
                      <span className="text-indigo-400 font-black text-sm">/ {metrics.commercial.target.toLocaleString()}</span>
                      <span className="text-xs font-bold text-white/40">Aggregated Performance</span>
                   </div>
                </div>
                <div className="mt-8 h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-50 shadow-[0_0_20px_#6366f1]" style={{width: `${Math.min(metrics.commercial.percent, 100)}%`}}></div></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[10px] font-black uppercase text-white/40 mb-2">Portfolio Yield</p><div className="text-2xl font-black text-white">{metrics.commercial.percent}%</div></div>
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[10px] font-black uppercase text-white/40 mb-2">Pace Analysis</p>
                   <div className={`text-2xl font-black flex items-center gap-2 ${metrics.commercial.percent >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{metrics.commercial.percent >= 100 ? <ArrowUpRight /> : <ArrowDownRight />}{metrics.commercial.percent >= 100 ? 'Optimized' : 'Behind'}</div>
                 </div>
              </div>
           </div>
           <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
             <p className="text-[10px] font-black uppercase text-indigo-400 mb-8 tracking-widest text-center">Monthly Revenue Stream</p>
             <ResponsiveContainer width="100%" height="90%">
               <BarChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                 <Bar dataKey="commTarget" name="Target" fill="#ffffff20" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="commActual" name="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      )
    },
    {
      title: "Recruitment Momentum: Sales Force Growth",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
           <div className="space-y-6">
              <div className="bg-rose-600/10 border border-rose-500/20 p-10 rounded-[2.5rem]">
                <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mb-4">Total Recruits</p>
                <div className="flex items-end gap-6">
                   <h3 className="text-6xl font-black text-white">{metrics.recruitment.actual.toLocaleString()}</h3>
                   <div className="flex flex-col mb-1">
                      <span className="text-rose-400 font-black text-sm">/ {metrics.recruitment.target.toLocaleString()}</span>
                      <span className="text-xs font-bold text-white/40">Recruitment Target</span>
                   </div>
                </div>
                <div className="mt-8 h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-rose-50 shadow-[0_0_20px_#f43f5e]" style={{width: `${Math.min(metrics.recruitment.percent, 100)}%`}}></div></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[10px] font-black uppercase text-white/40 mb-2">Success Rate</p><div className="text-2xl font-black text-white">{metrics.recruitment.percent}%</div></div>
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[10px] font-black uppercase text-white/40 mb-2">Growth Matrix</p><div className="text-2xl font-black text-cyan-400">Stable</div></div>
              </div>
           </div>
           <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
             <p className="text-[10px] font-black uppercase text-rose-400 mb-8 tracking-widest text-center">Talent Acquisition Trend</p>
             <ResponsiveContainer width="100%" height="90%">
               <BarChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                 <Bar dataKey="recTarget" name="Target" fill="#ffffff20" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="recActual" name="Actual" fill="#f43f5e" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      )
    },
    {
      title: "Efficiency Funnel: Lead Conversion Review",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 h-full">
           <div className="lg:col-span-4 space-y-6">
              <div className="bg-cyan-600/10 border border-cyan-500/20 p-10 rounded-[3rem]">
                <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-4">Total Funnel Velocity</p>
                <div className="space-y-8 mt-6">
                   <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-black uppercase text-white/40">Closing Rate</span>
                        <span className="text-4xl font-black text-cyan-400">{metrics.funnel.closingRate}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${metrics.funnel.closingRate}%`}}></div></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-6 rounded-2xl">
                         <p className="text-[8px] font-black uppercase text-white/40 mb-1">Total Leads</p>
                         <p className="text-xl font-black">{metrics.funnel.leads.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 p-6 rounded-2xl">
                         <p className="text-[8px] font-black uppercase text-white/40 mb-1">Deals Closed</p>
                         <p className="text-xl font-black text-emerald-400">{metrics.funnel.closed.toLocaleString()}</p>
                      </div>
                   </div>
                </div>
              </div>
           </div>
           <div className="lg:col-span-8 bg-white/5 border border-white/10 p-10 rounded-[4rem]">
             <p className="text-[10px] font-black uppercase text-cyan-400 mb-8 tracking-widest text-center">Lead Velocity vs Conversion</p>
             <ResponsiveContainer width="100%" height="90%">
               <ComposedChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                 <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#67e8f9', fontSize: 10}} />
                 <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                 <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#ffffff15" radius={[4, 4, 0, 0]} />
                 <Bar yAxisId="left" dataKey="closed" name="Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
                 <Line yAxisId="right" type="monotone" dataKey="rate" name="Rate %" stroke="#67e8f9" strokeWidth={4} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      )
    },
    {
      title: "2025 Strategic Audit: Performance Retrospective",
      content: (
        <div className="h-full flex flex-col justify-center items-center px-12 lg:px-24">
           {!savedPlan && !tempPlan?.analysis_2025 ? (
              <div className="text-center space-y-4 opacity-50">
                 <Search size={64} className="mx-auto text-indigo-400 animate-pulse" />
                 <p className="text-xs font-black uppercase tracking-widest text-white">Retrospective Required</p>
              </div>
           ) : (
              <div className="w-full max-w-[95rem] space-y-8 animate-fade-in overflow-hidden">
                 <div className="flex items-center gap-10 mb-6">
                    <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
                       <PieChart size={40} />
                    </div>
                    <div>
                       <h3 className="text-5xl font-black tracking-tighter uppercase text-white">2025 Performance Audit</h3>
                       <p className="text-indigo-400 text-sm font-black uppercase tracking-[0.5em]">Agency Critical Review</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-12 gap-10 h-[60vh]">
                    <div className="col-span-12 lg:col-span-7 bg-white/5 border border-white/10 p-12 rounded-[4rem] flex flex-col overflow-hidden">
                       <p className="text-[12px] font-black uppercase text-indigo-400 mb-6 flex items-center gap-4">Executive Performance Brief</p>
                       <div className="text-3xl leading-snug text-white font-medium italic overflow-y-auto pr-4 no-scrollbar">
                         {currentPlan?.executive_summary}
                       </div>
                    </div>
                    <div className="col-span-12 lg:col-span-5 bg-rose-600/10 border border-rose-500/20 p-12 rounded-[4rem] flex flex-col overflow-hidden">
                       <p className="text-[12px] font-black uppercase text-rose-400 mb-8 flex items-center gap-4">Friction points & Gaps</p>
                       <div className="text-xl leading-relaxed text-white/90 font-black overflow-y-auto pr-4 no-scrollbar">
                          {currentPlan?.analysis_2025}
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
      )
    },
    {
      title: "2026 Strategic Roadmap: Action Plan",
      content: (
        <div className="h-full flex flex-col px-12 lg:px-24">
           {!currentPlan?.q1_discipline ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                 <Rocket size={64} className="mx-auto text-emerald-400 animate-pulse" />
                 <p className="text-xs font-black uppercase tracking-widest text-white">Roadmap Not Yet Generated</p>
              </div>
           ) : (
              <div className="w-full max-w-[95rem] space-y-10 animate-fade-in py-10">
                 <div className="flex items-center gap-10">
                    <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
                       <Rocket size={40} />
                    </div>
                    <div>
                       <h3 className="text-5xl font-black tracking-tighter uppercase text-white">2026 Strategy Execution</h3>
                       <p className="text-emerald-400 text-sm font-black uppercase tracking-[0.5em]">Future-Proof Roadmap</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-10">
                       <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
                          <p className="text-[10px] font-black uppercase text-emerald-400 mb-4 tracking-[0.2em] flex items-center gap-3"><ClipboardList size={14}/> Q1: Discipline Matrix</p>
                          <p className="text-xl text-white/90 font-medium leading-relaxed">{currentPlan.q1_discipline}</p>
                       </div>
                       <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
                          <p className="text-[10px] font-black uppercase text-emerald-400 mb-4 tracking-[0.2em] flex items-center gap-3"><GraduationCap size={14}/> Q2: Capability Upscaling</p>
                          <p className="text-xl text-white/90 font-medium leading-relaxed">{currentPlan.q2_training}</p>
                       </div>
                       <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
                          <p className="text-[10px] font-black uppercase text-amber-400 mb-4 tracking-[0.2em] flex items-center gap-3"><Zap size={14}/> Q4: Scalability & Tech Drive</p>
                          <p className="text-xl text-white/90 font-medium leading-relaxed">{currentPlan.q4_productivity}</p>
                       </div>
                    </div>
                    
                    <div className="bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[4rem] flex flex-col">
                       <p className="text-[12px] font-black uppercase text-indigo-400 mb-8 tracking-[0.3em] flex items-center gap-4"><Megaphone size={18}/> Q3: Key Seasonal Campaigns</p>
                       <div className="space-y-8 flex-1">
                          <div className="flex items-start gap-6 bg-white/5 p-6 rounded-3xl">
                             <div className="p-3 bg-indigo-500 rounded-2xl text-white"><Gift size={20}/></div>
                             <div>
                                <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">CNY Festival</p>
                                <p className="text-lg text-white font-bold">{currentPlan.q3_marketing.cny}</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-6 bg-white/5 p-6 rounded-3xl">
                             <div className="p-3 bg-rose-500 rounded-2xl text-white"><Flame size={20}/></div>
                             <div>
                                <p className="text-[10px] font-black uppercase text-rose-400 mb-1">Hari Raya Celebration</p>
                                <p className="text-lg text-white font-bold">{currentPlan.q3_marketing.raya}</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-6 bg-white/5 p-6 rounded-3xl">
                             <div className="p-3 bg-emerald-500 rounded-2xl text-white"><ShoppingBag size={20}/></div>
                             <div>
                                <p className="text-[10px] font-black uppercase text-emerald-400 mb-1">Mid-Year Expo</p>
                                <p className="text-lg text-white font-bold">{currentPlan.q3_marketing.midYear}</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-6 bg-white/5 p-6 rounded-3xl">
                             <div className="p-3 bg-amber-500 rounded-2xl text-white"><Zap size={20}/></div>
                             <div>
                                <p className="text-[10px] font-black uppercase text-amber-400 mb-1">Year-End Closing Drive</p>
                                <p className="text-lg text-white font-bold">{currentPlan.q3_marketing.yearEnd}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </div>
      )
    }
  ];

  if (isPresentationMode) {
    return (
      <div className="h-full w-full flex flex-col p-12 lg:p-20 relative animate-fade-in bg-[#0F172A]">
         <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-indigo-600 rounded-3xl shadow-2xl"><Presentation size={32} className="text-white" /></div>
               <div>
                  <h1 className="text-3xl font-black uppercase text-white tracking-tighter">{slides[currentSlide].title}</h1>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Slide {currentSlide + 1} of {slides.length}</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <button disabled={currentSlide === 0} onClick={() => setCurrentSlide(prev => prev - 1)} className="p-5 bg-white/5 border border-white/10 rounded-full text-white hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronLeft size={24} /></button>
               <button disabled={currentSlide === slides.length - 1} onClick={() => setCurrentSlide(prev => prev + 1)} className="p-5 bg-indigo-600 rounded-full text-white shadow-xl shadow-indigo-600/20"><ChevronRight size={24} /></button>
            </div>
         </div>
         <div className="flex-1 min-h-0 overflow-hidden">{slides[currentSlide].content}</div>
         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3">
            {slides.map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-12 bg-indigo-50' : 'w-3 bg-white/10'}`}></div>)}
         </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <div className="lg:col-span-2 space-y-8 h-full flex flex-col">
        {!isStrategyLab ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-4 flex-nowrap scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <button onClick={() => setFilter('all')} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-500 hover:border-slate-300'}`}>Full Portfolio</button>
              {salesCategories.map(c => (
                <button key={c.id} onClick={() => setFilter(c.id)} className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all flex items-center gap-2 whitespace-nowrap ${filter === c.id ? `bg-indigo-600 text-white shadow-xl` : 'bg-white text-slate-500 hover:border-slate-300'}`}>{c.name}</button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard title="Total Revenue" value={metrics.commercial.actual.toLocaleString()} icon={Target} colorClass="bg-indigo-600" />
               <StatCard title="Total Recruits" value={metrics.recruitment.actual.toLocaleString()} icon={Users} colorClass="bg-rose-500" />
               <StatCard title="Closing Rate" value={`${metrics.funnel.closingRate}%`} icon={Filter} colorClass="bg-cyan-600" />
            </div>

            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[380px]">
                <p className="text-[10px] font-black uppercase text-indigo-500 mb-6 tracking-widest">Growth Performance Spectrum (Aggregate)</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={domainData}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{borderRadius: '1rem', border: 'none'}} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '10px'}} />
                    <Bar dataKey="commTarget" name="Target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="commActual" name="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Portfolio Deep-Dive: Individual Category Charts */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3 mb-2">
                    <Layers size={18} className="text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Portfolio Performance Deep-Dive</h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {salesCategories.filter(c => filter === 'all' || filter === c.id).map(cat => {
                       // Calculate category-specific achievement
                       const catTarget = data.reduce((sum, item) => sum + (item[`${cat.id}Target`] as number || 0), 0);
                       const catActual = data.reduce((sum, item) => sum + (item[`${cat.id}Actual`] as number || 0), 0);
                       const catPercent = catTarget > 0 ? parseFloat(((catActual / catTarget) * 100).toFixed(1)) : 0;

                       return (
                          <div key={cat.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[400px] animate-fade-in">
                            <div className="flex justify-between items-start mb-6">
                               <div>
                                  <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">{cat.name}</h5>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Direct Target Tracking</p>
                               </div>
                               <div className="text-right">
                                  <span className={`text-xl font-black ${catPercent >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{catPercent}%</span>
                                  <p className="text-[8px] font-black uppercase text-slate-400">Achievement</p>
                               </div>
                            </div>
                            <div className="flex-1">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#cbd5e1' }} />
                                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#cbd5e1' }} />
                                     <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                     <Bar dataKey={`${cat.id}Target`} name="Target" fill="#f1f5f9" radius={[4, 4, 0, 0]} />
                                     <Bar dataKey={`${cat.id}Actual`} name="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                               </ResponsiveContainer>
                            </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[380px]">
                  <p className="text-[10px] font-black uppercase text-rose-500 mb-6 tracking-widest">Recruitment Velocity</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={domainData}>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Bar dataKey="recTarget" name="Target" fill="#f1f5f9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="recActual" name="Actual" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[380px]">
                  <p className="text-[10px] font-black uppercase text-cyan-600 mb-6 tracking-widest">Conversion Index</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={domainData}>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#f1f5f9" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="left" type="monotone" dataKey="closed" name="Deals" stroke="#10b981" strokeWidth={3} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-amber-500 rounded-3xl shadow-xl text-white"><BookOpen size={24}/></div>
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase">Strategy Lab</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Audit 2025 &rarr; Plan 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {currentPlan && (
                  <button onClick={() => setIsEditMode(!isEditMode)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${isEditMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <Edit2 size={16} className="inline mr-2"/> {isEditMode ? 'Done Editing' : 'Manual Override'}
                  </button>
                )}
                <button onClick={() => { if(onPlanFinalize && currentPlan) onPlanFinalize(currentPlan); alert('Strategy committed!'); }} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl"><Save size={16} className="inline mr-2"/> Commit Plan</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleStrategyAction('analyze')} disabled={isLoadingAi} className="p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6"><Search size={24}/></div>
                  <h4 className="text-sm font-black uppercase mb-1">Step 1: Audit 2025</h4>
                </button>
                <button onClick={() => handleStrategyAction('plan')} disabled={isLoadingAi || (!tempPlan?.analysis_2025 && !savedPlan?.analysis_2025)} className={`p-8 border rounded-[2.5rem] transition-all text-left group ${(!tempPlan?.analysis_2025 && !savedPlan?.analysis_2025) ? 'opacity-40 grayscale pointer-events-none' : 'bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer'}`}>
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6"><Sparkles size={24}/></div>
                  <h4 className="text-sm font-black uppercase mb-1">Step 2: Generate 2026</h4>
                </button>
              </div>

              {currentPlan && (
                <div className="space-y-12 animate-fade-in pb-20">
                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Performance Summary & Matrix</h5>
                    <div className="p-10 bg-indigo-50 rounded-[3rem] border border-indigo-100 shadow-sm">
                       {isEditMode ? (
                          <div className="space-y-6">
                             <div>
                               <p className="text-[10px] font-black uppercase text-indigo-400 mb-2">Executive Summary</p>
                               <textarea value={currentPlan?.executive_summary} onChange={e => handleUpdateTempPlan('executive_summary', e.target.value)} className="w-full h-32 p-5 bg-white border border-indigo-200 rounded-2xl text-xs font-bold shadow-inner resize-none focus:ring-2 ring-indigo-500 outline-none" />
                             </div>
                             <div>
                               <p className="text-[10px] font-black uppercase text-rose-400 mb-2">Detailed Gaps</p>
                               <textarea value={currentPlan?.analysis_2025} onChange={e => handleUpdateTempPlan('analysis_2025', e.target.value)} className="w-full h-32 p-5 bg-white border border-rose-200 rounded-2xl text-xs font-bold shadow-inner resize-none focus:ring-2 ring-rose-500 outline-none" />
                             </div>
                          </div>
                       ) : (
                          <div className="text-sm text-slate-700 leading-relaxed font-semibold whitespace-pre-line italic">
                            {currentPlan?.executive_summary}
                            {"\n\n"}
                            {currentPlan?.analysis_2025}
                          </div>
                       )}
                    </div>
                  </div>

                  {(currentPlan?.q1_discipline) && (
                    <div className="space-y-6">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Quarterly Roadmap 2026</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><ClipboardList size={14}/> Q1: Discipline</p>
                           {isEditMode ? <textarea value={currentPlan?.q1_discipline} onChange={e => handleUpdateTempPlan('q1_discipline', e.target.value)} className="w-full h-20 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold resize-none" /> : <p className="text-sm text-slate-800 font-bold">{currentPlan?.q1_discipline}</p>}
                        </div>
                        <div className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><GraduationCap size={14}/> Q2: Training</p>
                           {isEditMode ? <textarea value={currentPlan?.q2_training} onChange={e => handleUpdateTempPlan('q2_training', e.target.value)} className="w-full h-20 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold resize-none" /> : <p className="text-sm text-slate-800 font-bold">{currentPlan?.q2_training}</p>}
                        </div>
                        
                        {/* Q3 Marketing Section */}
                        <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] shadow-sm md:col-span-2">
                           <p className="text-[10px] font-black text-indigo-600 uppercase mb-6 tracking-widest flex items-center gap-2"><Megaphone size={14}/> Q3: Marketing & Seasonal Campaigns</p>
                           {isEditMode ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Gift size={10}/> CNY Campaign</label>
                                 <input type="text" value={currentPlan?.q3_marketing.cny} onChange={e => handleUpdateQ3Marketing('cny', e.target.value)} className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-indigo-500" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Flame size={10}/> Raya Festival</label>
                                 <input type="text" value={currentPlan?.q3_marketing.raya} onChange={e => handleUpdateQ3Marketing('raya', e.target.value)} className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-indigo-500" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><ShoppingBag size={10}/> Mid-Year Sale</label>
                                 <input type="text" value={currentPlan?.q3_marketing.midYear} onChange={e => handleUpdateQ3Marketing('midYear', e.target.value)} className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-indigo-500" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1"><Zap size={10}/> Year-End Drive</label>
                                 <input type="text" value={currentPlan?.q3_marketing.yearEnd} onChange={e => handleUpdateQ3Marketing('yearEnd', e.target.value)} className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-indigo-500" />
                               </div>
                             </div>
                           ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="flex gap-4 items-start">
                                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Gift size={14}/></div>
                                  <div>
                                    <p className="text-[8px] font-black uppercase text-indigo-400">CNY Campaign</p>
                                    <p className="text-xs font-bold text-slate-800">{currentPlan?.q3_marketing.cny}</p>
                                  </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                  <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><Flame size={14}/></div>
                                  <div>
                                    <p className="text-[8px] font-black uppercase text-rose-400">Raya Festival</p>
                                    <p className="text-xs font-bold text-slate-800">{currentPlan?.q3_marketing.raya}</p>
                                  </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ShoppingBag size={14}/></div>
                                  <div>
                                    <p className="text-[8px] font-black uppercase text-emerald-400">Mid-Year Sale</p>
                                    <p className="text-xs font-bold text-slate-800">{currentPlan?.q3_marketing.midYear}</p>
                                  </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Zap size={14}/></div>
                                  <div>
                                    <p className="text-[8px] font-black uppercase text-amber-400">Year-End Drive</p>
                                    <p className="text-xs font-bold text-slate-800">{currentPlan?.q3_marketing.yearEnd}</p>
                                  </div>
                                </div>
                             </div>
                           )}
                        </div>

                        <div className="p-8 bg-emerald-50/50 border border-emerald-100 rounded-[2rem] shadow-sm md:col-span-2">
                           <p className="text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest flex items-center gap-2"><Zap size={14}/> Q4: Scalability & Productivity</p>
                           {isEditMode ? <textarea value={currentPlan?.q4_productivity} onChange={e => handleUpdateTempPlan('q4_productivity', e.target.value)} className="w-full h-20 p-4 bg-white border border-emerald-100 rounded-xl text-xs font-bold resize-none" /> : <p className="text-sm text-slate-800 font-bold">{currentPlan?.q4_productivity}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col h-[850px] overflow-hidden">
        <div className="p-1 bg-slate-100 flex rounded-t-[2.5rem]">
          <button onClick={() => setActiveChatTab('sales')} className={`flex-1 py-6 text-[10px] font-black uppercase transition-all ${activeChatTab === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Sales AI</button>
          <button onClick={() => setActiveChatTab('recruitment')} className={`flex-1 py-6 text-[10px] font-black uppercase transition-all ${activeChatTab === 'recruitment' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Talent AI</button>
          <button onClick={() => setActiveChatTab('strategy')} className={`flex-1 py-6 text-[10px] font-black uppercase transition-all ${activeChatTab === 'strategy' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}>Strategy Lab</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar" ref={scrollRef}>
          {currentMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
              <Bot size={48} />
              <p className="text-[10px] font-black uppercase tracking-widest">Neural Link Standby</p>
            </div>
          )}
          {currentMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-xs font-semibold ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700'}`}>{m.text}</div>
            </div>
          ))}
          {isLoadingAi && <div className="animate-pulse flex justify-start"><div className="bg-slate-50 p-4 rounded-2xl"><Loader2 size={16} className="animate-spin text-slate-300" /></div></div>}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 relative">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askAi()} placeholder="Analyze performance..." className="w-full pl-6 pr-16 py-5 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-bold shadow-sm focus:ring-2 ring-indigo-500" />
            <button onClick={() => askAi()} className={`absolute right-12 top-12 p-2 text-white rounded-xl shadow-lg transition-all active:scale-95 ${activeChatTab === 'sales' ? 'bg-indigo-600' : activeChatTab === 'recruitment' ? 'bg-rose-600' : 'bg-amber-500'}`}><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;