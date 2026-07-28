import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
}

/** Карточка статистики — белый фон, цвет только на иконке */
const iconColorMap = {
  emerald: 'bg-[#C0F11C] text-[#333333]',
  blue:    'bg-[#C0F11C] text-[#333333]',
  amber:   'bg-[#C0F11C] text-[#333333]',
  red:     'bg-[#C0F11C] text-[#333333]',
  purple:  'bg-[#C0F11C] text-[#333333]',
};

export default function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bento-panel p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-extrabold text-[#333333] tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${iconColorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
