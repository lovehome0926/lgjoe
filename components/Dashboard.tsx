import { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Line, ComposedChart
} from 'recharts';
import { 
  Target, Bot, Loader2, Users, 
  ChevronLeft, ChevronRight, Presentation, 
  ArrowUpRight, ArrowDownRight, Sparkles, 
  Zap, GraduationCap, ClipboardList, BookOpen, Save,
  Search, PieChart, Edit2, Megaphone, Gift, Flame, ShoppingBag,
  Rocket, Layers, Filter, FileOutput
} from 'lucide-react';
import { MonthlyData, ProductFilter, Category, ChatMessage, StrategicPlan } from '../types';
import StatCard from './StatCard';
import { GoogleGenAI, Type } from '@google/genai';
import pptxgen from 'pptxgenjs';

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

  // 颜色定义 - 销售图表专用 (红黄)
  const SALES_COLORS = {
    target: "#EF4444", // 鲜艳红
    actual: "#FACC15", // 明亮黄
  };

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
      
      let systemInstruction = `You are a Senior Strategic Advisor. Data context: ${JSON.stringify(contextDataSummary)}. Current Plan/Audit: ${JSON.stringify(tempPlan || savedPlan)}. 
      CRITICAL RULE: For all strategy points, analysis, and roadmaps, you MUST use Point Form (bullet points using •). Keep each point concise, high-impact and actionable.`;
      let config: any = { systemInstruction };

      if (currentTab === 'strategy') {
        if (userMsg.toLowerCase().includes('audit') || userMsg.toLowerCase().includes('plan')) {
          config.responseMimeType = "application/json";
          config.responseSchema = {
            type: Type.OBJECT,
            properties: {
              q1_discipline: { type: Type.STRING, description: "Actionable bullet points for Q1 Discipline" },
              q2_training: { type: Type.STRING, description: "Actionable bullet points for Q2 Training" },
              q3_marketing: { 
                type: Type.OBJECT, 
                properties: { 
                  cny: { type: Type.STRING }, 
                  raya: { type: Type.STRING }, 
                  midYear: { type: Type.STRING }, 
                  yearEnd: { type: Type.STRING } 
                }
              },
              q4_productivity: { type: Type.STRING, description: "Actionable bullet points for Q4 Scalability" },
              executive_summary: { type: Type.STRING, description: "Concise summary paragraph" },
              analysis_2025: { type: Type.STRING, description: "Bullet points of major gaps found in 2025" }
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
          msgUpdate('model', "Strategy Matrix generated in point form. See roadmap below.");
        } catch(e) { msgUpdate('model', aiText); }
      } else {
        msgUpdate('model', aiText);
      }
    } catch (err) { msgUpdate('model', "Sync error."); } finally { setIsLoadingAi(false); }
  };

  const exportToPPT = () => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    // Slide 1: Title
    let slide1 = pres.addSlide();
    slide1.background = { color: '0F172A' };
    slide1.addText('AGENCY STRATEGIC PERFORMANCE', { x: 0.5, y: 1.5, w: '90%', fontSize: 44, bold: true, color: 'FFFFFF', align: 'center' });
    slide1.addText('2026 Strategic Plan & 2025 Audit', { x: 0.5, y: 2.5, w: '90%', fontSize: 24, color: '6366F1', align: 'center' });

    // Slide 2: Data Overview
    let slide2 = pres.addSlide();
    slide2.addText('COMMERCIAL PERFORMANCE OVERVIEW', { x: 0.5, y: 0.5, fontSize: 28, bold: true, color: '0F172A' });
    slide2.addText([
      { text: `Total Revenue: ${metrics.commercial.actual.toLocaleString()} / ${metrics.commercial.target.toLocaleString()}`, options: { fontSize: 20, breakLine: true } },
      { text: `Achievement: ${metrics.commercial.percent}%`, options: { fontSize: 20, breakLine: true } },
      { text: `Total Recruits: ${metrics.recruitment.actual.toLocaleString()}`, options: { fontSize: 20, breakLine: true } },
    ], { x: 0.5, y: 1.5, w: 9 });

    // Slide 3: Strategy Points
    if (tempPlan || savedPlan) {
      const plan = tempPlan || savedPlan;
      let slide3 = pres.addSlide();
      slide3.addText('2026 STRATEGIC ROADMAP', { x: 0.5, y: 0.5, fontSize: 28, bold: true, color: '0F172A' });
      slide3.addText('Q1 Discipline Focus:\n' + plan?.q1_discipline, { x: 0.5, y: 1.2, w: 4.5, h: 2.5, fontSize: 14, color: '334155', valign: 'top' });
      slide3.addText('Q2 Training Focus:\n' + plan?.q2_training, { x: 5.2, y: 1.2, w: 4.5, h: 2.5, fontSize: 14, color: '334155', valign: 'top' });
      slide3.addText('Q4 Productivity Focus:\n' + plan?.q4_productivity, { x: 0.5, y: 4.0, w: 9.2, h: 2.5, fontSize: 14, color: '334155', valign: 'top' });
    }

    pres.writeFile({ fileName: `Agency_Strategic_Plan_2026.pptx` });
  };

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
        q3_marketing: { ...base.q3_marketing, [field]: value }
      };
    });
  };

  const handleStrategyAction = (action: 'analyze' | 'plan') => {
    const prompt = action === 'analyze' 
      ? "Execute a deep Performance Audit of 2025. Use point form to list top 3 growth blockers." 
      : "Develop a 2026 Point Roadmap. List 3 key points for Q1, Q2, and Q4.";
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
                <p className="text-indigo-400 text-[12px] font-black uppercase tracking-widest mb-4">Portfolio Target Achievement</p>
                <div className="flex items-end gap-6">
                   <h3 className="text-7xl font-black text-white">{metrics.commercial.actual.toLocaleString()}</h3>
                   <div className="flex flex-col mb-2">
                      <span className="text-rose-400 font-black text-lg">/ {metrics.commercial.target.toLocaleString()}</span>
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Aggregated Goal</span>
                   </div>
                </div>
                <div className="mt-8 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 shadow-[0_0_25px_#facc15]" style={{width: `${Math.min(metrics.commercial.percent, 100)}%`}}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[12px] font-black uppercase text-white/40 mb-2">Portfolio Yield</p><div className="text-4xl font-black text-yellow-400">{metrics.commercial.percent}%</div></div>
                 <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10"><p className="text-[12px] font-black uppercase text-white/40 mb-2">Pace Analysis</p>
                   <div className={`text-3xl font-black flex items-center gap-2 ${metrics.commercial.percent >= 100 ? 'text-emerald-400' : 'text-rose-400'}`}>{metrics.commercial.percent >= 100 ? <ArrowUpRight /> : <ArrowDownRight />}{metrics.commercial.percent >= 100 ? 'Optimized' : 'Behind'}</div>
                 </div>
              </div>
           </div>
           <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
             <p className="text-[16px] font-black uppercase text-indigo-400 mb-8 tracking-widest text-center">Monthly Revenue Stream (Red: Target | Yellow: Actual)</p>
             <ResponsiveContainer width="100%" height="90%">
               <BarChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 18, fontWeight: 'bold'}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 16}} />
                 <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', fontSize: '16px'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                 <Bar dataKey="commTarget" name="Target" fill={SALES_COLORS.target} radius={[4, 4, 0, 0]} />
                 <Bar dataKey="commActual" name="Actual" fill={SALES_COLORS.actual} radius={[4, 4, 0, 0]} />
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
                <p className="text-rose-400 text-[12px] font-black uppercase tracking-widest mb-4">Total Recruits</p>
                <div className="flex items-end gap-6">
                   <h3 className="text-7xl font-black text-white">{metrics.recruitment.actual.toLocaleString()}</h3>
                   <div className="flex flex-col mb-2">
                      <span className="text-rose-400 font-black text-lg">/ {metrics.recruitment.target.toLocaleString()}</span>
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Recruitment Target</span>
                   </div>
                </div>
                <div className="mt-8 h-3 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-rose-50 shadow-[0_0_20px_#f43f5e]" style={{width: `${Math.min(metrics.recruitment.percent, 100)}%`}}></div></div>
              </div>
           </div>
           <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
             <p className="text-[16px] font-black uppercase text-rose-400 mb-8 tracking-widest text-center">Talent Acquisition Trend</p>
             <ResponsiveContainer width="100%" height="90%">
               <BarChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 18, fontWeight: 'bold'}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 16}} />
                 <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', fontSize: '16px'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase'}} />
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
                <p className="text-cyan-400 text-[12px] font-black uppercase tracking-widest mb-4">Total Funnel Velocity</p>
                <div className="space-y-8 mt-6">
                   <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[12px] font-black uppercase text-white/40">Closing Rate</span>
                        <span className="text-5xl font-black text-cyan-400">{metrics.funnel.closingRate}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${metrics.funnel.closingRate}%`}}></div></div>
                   </div>
                </div>
              </div>
           </div>
           <div className="lg:col-span-8 bg-white/5 border border-white/10 p-10 rounded-[4rem]">
             <p className="text-[16px] font-black uppercase text-cyan-400 mb-8 tracking-widest text-center">Lead Velocity vs Conversion</p>
             <ResponsiveContainer width="100%" height="90%">
               <ComposedChart data={domainData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff0a" />
                 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 18, fontWeight: 'bold'}} />
                 <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 16}} />
                 <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#67e8f9', fontSize: 16}} />
                 <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '1rem', fontSize: '16px'}} />
                 <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                 <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#ffffff15" radius={[4, 4, 0, 0]} />
                 <Bar yAxisId="left" dataKey="closed" name="Closed" fill="#10b981" radius={[4, 4, 0, 0]} />
                 <Line yAxisId="right" type="monotone" dataKey="rate" name="Rate %" stroke="#67e8f9" strokeWidth={6} dot={{r: 6}} />
               </ComposedChart>
             </ResponsiveContainer>
           </div>
        </div>
      )
    },
    {
      title: "2025 Strategic Audit: Point Summary",
      content: (
        <div className="h-full flex flex-col justify-center items-center px-12 lg:px-24">
           {!currentPlan?.analysis_2025 ? (
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
                       <h3 className="text-6xl font-black tracking-tighter uppercase text-white">Performance Audit</h3>
                       <p className="text-indigo-400 text-sm font-black uppercase tracking-[0.5em]">Point Focus Matrix</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-12 gap-10 h-[60vh]">
                    <div className="col-span-12 lg:col-span-7 bg-white/5 border border-white/10 p-12 rounded-[4rem] flex flex-col overflow-hidden">
                       <p className="text-[14px] font-black uppercase text-indigo-400 mb-6 tracking-widest">Executive Summary</p>
                       <div className="text-3xl leading-snug text-white font-medium italic overflow-y-auto pr-4 no-scrollbar">
                         {currentPlan?.executive_summary}
                       </div>
                    </div>
                    <div className="col-span-12 lg:col-span-5 bg-rose-600/10 border border-rose-500/20 p-12 rounded-[4rem] flex flex-col overflow-hidden">
                       <p className="text-[14px] font-black uppercase text-rose-400 mb-8 tracking-widest">Critical Gaps (Point Form)</p>
                       <div className="text-2xl leading-relaxed text-white font-bold overflow-y-auto pr-4 no-scrollbar whitespace-pre-line">
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
      title: "2026 Strategic Roadmap: Point Summary",
      content: (
        <div className="h-full flex flex-col px-12 lg:px-24 overflow-hidden">
           {!currentPlan?.q1_discipline ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                 <Rocket size={64} className="mx-auto text-emerald-400 animate-pulse" />
                 <p className="text-xs font-black uppercase tracking-widest text-white">Roadmap Standby</p>
              </div>
           ) : (
              <div className="w-full max-w-[95rem] space-y-10 animate-fade-in py-10 h-full overflow-y-auto pr-4 no-scrollbar">
                 <div className="flex items-center gap-10">
                    <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
                       <Rocket size={40} />
                    </div>
                    <div>
                       <h3 className="text-6xl font-black tracking-tighter uppercase text-white">2026 Strategy Roadmap</h3>
                       <p className="text-emerald-400 text-sm font-black uppercase tracking-[0.5em]">Focused Point Matrix</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-10 pb-20">
                    <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem]">
                       <p className="text-[14px] font-black uppercase text-emerald-400 mb-6 tracking-widest">Q1 Discipline Points</p>
                       <div className="text-2xl text-white font-bold leading-relaxed whitespace-pre-line">{currentPlan.q1_discipline}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem]">
                       <p className="text-[14px] font-black uppercase text-emerald-400 mb-6 tracking-widest">Q2 Training Points</p>
                       <div className="text-2xl text-white font-bold leading-relaxed whitespace-pre-line">{currentPlan.q2_training}</div>
                    </div>
                    <div className="col-span-2 bg-indigo-600/10 border border-indigo-500/20 p-10 rounded-[3rem]">
                       <p className="text-[14px] font-black uppercase text-indigo-400 mb-6 tracking-widest">Q4 Scalability Points</p>
                       <div className="text-2xl text-white font-bold leading-relaxed whitespace-pre-line">{currentPlan.q4_productivity}</div>
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
               <div className="p-4 bg-indigo-600 rounded-3xl shadow-2xl"><Presentation size={40} className="text-white" /></div>
               <div>
                  <h1 className="text-4xl font-black uppercase text-white tracking-tighter">{slides[currentSlide].title}</h1>
                  <p className="text-white/40 text-[12px] font-black uppercase tracking-[0.3em]">Point Slide {currentSlide + 1} of {slides.length}</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={exportToPPT} className="px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-[10px] font-black uppercase hover:bg-white/20 transition-all flex items-center gap-2"><FileOutput size={18} /> Export PPT</button>
               <div className="flex items-center gap-3">
                  <button disabled={currentSlide === 0} onClick={() => setCurrentSlide(prev => prev - 1)} className="p-6 bg-white/5 border border-white/10 rounded-full text-white hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronLeft size={32} /></button>
                  <button disabled={currentSlide === slides.length - 1} onClick={() => setCurrentSlide(prev => prev + 1)} className="p-6 bg-indigo-600 rounded-full text-white shadow-xl shadow-indigo-600/20"><ChevronRight size={32} /></button>
               </div>
            </div>
         </div>
         <div className="flex-1 min-h-0 overflow-hidden">{slides[currentSlide].content}</div>
         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
            {slides.map((_, i) => <div key={i} className={`h-2 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-16 bg-yellow-400' : 'w-4 bg-white/10'}`}></div>)}
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
              <button onClick={() => setFilter('all')} className={`px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${filter === 'all' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-500 hover:border-slate-300'}`}>Full Portfolio</button>
              {salesCategories.map(c => (
                <button key={c.id} onClick={() => setFilter(c.id)} className={`px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 whitespace-nowrap ${filter === c.id ? `bg-indigo-600 text-white shadow-xl` : 'bg-white text-slate-500 hover:border-slate-300'}`}>{c.name}</button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard title="Total Revenue" value={metrics.commercial.actual.toLocaleString()} icon={Target} colorClass="bg-red-500" />
               <StatCard title="Total Recruits" value={metrics.recruitment.actual.toLocaleString()} icon={Users} colorClass="bg-indigo-600" />
               <StatCard title="Closing Rate" value={`${metrics.funnel.closingRate}%`} icon={Filter} colorClass="bg-cyan-600" />
            </div>

            <div className="space-y-8">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-[500px]">
                <p className="text-[14px] font-black uppercase text-red-500 mb-6 tracking-widest text-center">Revenue Benchmark (Red: Target | Yellow: Actual)</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={domainData}>
                    <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 18, fill: '#64748b', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 16, fill: '#94a3b8' }} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '1rem', border: 'none', fontSize: '16px'}} />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '30px', fontSize: '18px', fontWeight: 'bold'}} />
                    <Bar dataKey="commTarget" name="Target" fill={SALES_COLORS.target} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="commActual" name="Actual" fill={SALES_COLORS.actual} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-6">
                 <div className="flex items-center gap-3 mb-2">
                    <Layers size={22} className="text-slate-400" />
                    <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">Deep-Dive Analysis</h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                    {salesCategories.filter(c => filter === 'all' || filter === c.id).map(cat => {
                       const catTarget = data.reduce((sum, item) => sum + (item[`${cat.id}Target`] as number || 0), 0);
                       const catActual = data.reduce((sum, item) => sum + (item[`${cat.id}Actual`] as number || 0), 0);
                       const catPercent = catTarget > 0 ? parseFloat(((catActual / catTarget) * 100).toFixed(1)) : 0;
                       return (
                          <div key={cat.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-[500px]">
                            <div className="flex justify-between items-start mb-8">
                               <div>
                                  <h5 className="text-xl font-black text-slate-900 uppercase tracking-tight">{cat.name}</h5>
                                  <p className="text-[12px] font-bold text-slate-400 uppercase mt-1">Portfolio Tracking</p>
                               </div>
                               <div className="text-right">
                                  <span className={`text-4xl font-black ${catPercent >= 100 ? 'text-emerald-500' : 'text-rose-500'}`}>{catPercent}%</span>
                                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Goal Yield</p>
                               </div>
                            </div>
                            <div className="flex-1">
                               <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 16, fill: '#94a3b8', fontWeight: 'bold' }} />
                                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 14, fill: '#cbd5e1' }} />
                                     <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '14px' }} />
                                     <Bar dataKey={`${cat.id}Target`} name="Target" fill={SALES_COLORS.target} radius={[4, 4, 0, 0]} />
                                     <Bar dataKey={`${cat.id}Actual`} name="Actual" fill={SALES_COLORS.actual} radius={[4, 4, 0, 0]} />
                                  </BarChart>
                               </ResponsiveContainer>
                            </div>
                          </div>
                       );
                    })}
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
                   <h3 className="text-2xl font-black text-slate-900 uppercase">Strategy Point Lab</h3>
                   <p className="text-[12px] font-black text-slate-400 uppercase mt-1">Actionable Point Matrices</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={exportToPPT} className="px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2"><FileOutput size={16} /> Save PPT</button>
                <button onClick={() => { if(onPlanFinalize && currentPlan) onPlanFinalize(currentPlan); alert('Points Sync Complete'); }} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[12px] font-black uppercase shadow-xl flex items-center gap-2"><Save size={18} /> Sync Plans</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => handleStrategyAction('analyze')} disabled={isLoadingAi} className="p-10 bg-slate-50 border border-slate-200 rounded-[3rem] hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6"><Search size={30}/></div>
                  <h4 className="text-lg font-black uppercase mb-2">Audit Gaps</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Scan 2025 data for blockers in point form.</p>
                </button>
                <button onClick={() => handleStrategyAction('plan')} disabled={isLoadingAi || !currentPlan?.analysis_2025} className={`p-10 border rounded-[3rem] transition-all text-left group ${!currentPlan?.analysis_2025 ? 'opacity-40 grayscale pointer-events-none' : 'bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer'}`}>
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6"><Sparkles size={30}/></div>
                  <h4 className="text-lg font-black uppercase mb-2">Plan Roadmaps</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Map 2026 quarters in action points.</p>
                </button>
              </div>

              {currentPlan && (
                <div className="space-y-12 animate-fade-in pb-20">
                  <div className="space-y-6">
                    <h5 className="text-[14px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center gap-3">Point Matrix Summary</h5>
                    <div className="p-10 bg-indigo-50 rounded-[3rem] border border-indigo-100 shadow-sm">
                       <div className="text-xl text-slate-800 leading-snug font-bold italic mb-8 border-b border-indigo-100 pb-8">{currentPlan?.executive_summary}</div>
                       <div className="text-xl text-slate-700 leading-relaxed font-bold whitespace-pre-line">{currentPlan?.analysis_2025}</div>
                    </div>
                  </div>

                  {currentPlan?.q1_discipline && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm">
                           <p className="text-[14px] font-black text-slate-400 uppercase mb-6 tracking-widest flex items-center gap-3"><ClipboardList size={18}/> Q1: Discipline Points</p>
                           <p className="text-xl text-slate-800 font-bold leading-relaxed whitespace-pre-line">{currentPlan?.q1_discipline}</p>
                        </div>
                        <div className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm">
                           <p className="text-[14px] font-black text-slate-400 uppercase mb-6 tracking-widest flex items-center gap-3"><GraduationCap size={18}/> Q2: Training Points</p>
                           <p className="text-xl text-slate-800 font-bold leading-relaxed whitespace-pre-line">{currentPlan?.q2_training}</p>
                        </div>
                        <div className="p-10 bg-emerald-50 border border-emerald-100 rounded-[3rem] shadow-sm md:col-span-2">
                           <p className="text-[14px] font-black text-emerald-600 uppercase mb-6 tracking-widest flex items-center gap-3"><Zap size={18}/> Q4: Scalability Points</p>
                           <p className="text-xl text-slate-800 font-bold leading-relaxed whitespace-pre-line">{currentPlan?.q4_productivity}</p>
                        </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl flex flex-col h-[850px] overflow-hidden">
        <div className="p-1 bg-slate-100 flex rounded-t-[3rem]">
          <button onClick={() => setActiveChatTab('sales')} className={`flex-1 py-7 text-[12px] font-black uppercase transition-all ${activeChatTab === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Sales AI</button>
          <button onClick={() => setActiveChatTab('recruitment')} className={`flex-1 py-7 text-[12px] font-black uppercase transition-all ${activeChatTab === 'recruitment' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Talent AI</button>
          <button onClick={() => setActiveChatTab('strategy')} className={`flex-1 py-7 text-[12px] font-black uppercase transition-all ${activeChatTab === 'strategy' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}>Point Advisor</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar" ref={scrollRef}>
          {currentMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6 opacity-50">
              <Bot size={64} />
              <p className="text-[12px] font-black uppercase tracking-[0.3em]">AI Point Specialist Standby</p>
            </div>
          )}
          {currentMessages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-5 rounded-[1.5rem] text-sm font-bold shadow-sm ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700 whitespace-pre-line'}`}>{m.text}</div>
            </div>
          ))}
          {isLoadingAi && <div className="animate-pulse flex justify-start"><div className="bg-slate-50 p-5 rounded-[1.5rem]"><Loader2 size={24} className="animate-spin text-slate-300" /></div></div>}
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 relative">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askAi()} placeholder="Analyze or Plan points..." className="w-full pl-8 pr-20 py-6 bg-white border border-slate-200 rounded-[2rem] outline-none text-sm font-bold shadow-sm focus:ring-2 ring-indigo-500" />
            <button onClick={() => askAi()} className={`absolute right-14 top-14 p-3 text-white rounded-2xl shadow-lg transition-all active:scale-95 ${activeChatTab === 'sales' ? 'bg-indigo-600' : activeChatTab === 'recruitment' ? 'bg-rose-600' : 'bg-amber-500'}`}><Rocket size={24} /></button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;