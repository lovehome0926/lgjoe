import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  colorClass: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, icon: Icon, colorClass, trend }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-6">
      <div className={`p-4 rounded-2xl shadow-lg ${colorClass}`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      {trend && (
        <span className={`text-[12px] font-black px-3 py-1.5 rounded-full ${trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>
      )}
    </div>
    <div>
      <p className="text-slate-400 text-[12px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
      <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{value}</h3>
      {subtext && <p className="text-[12px] font-bold text-slate-400 mt-3 uppercase tracking-widest">{subtext}</p>}
    </div>
  </div>
);

export default StatCard;