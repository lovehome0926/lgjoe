
export interface Category {
  id: string;
  name: string;
  color: string;
  type?: 'sales' | 'recruitment' | 'activity';
}

export interface MonthlyData {
  month: string;
  [key: string]: string | number;
}

export type ProductFilter = 'all' | string;
export type ActiveTab = 'dashboard' | 'edit' | 'strategy';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StrategicPlan {
  q1_discipline: string;
  q2_training: string;
  q3_marketing: {
    cny: string;
    raya: string;
    midYear: string;
    yearEnd: string;
  };
  q4_productivity: string;
  executive_summary: string;
  analysis_2025: string;
}
