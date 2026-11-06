import type { LucideIcon } from 'lucide-react';
import { currency } from '../utils/format';
type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  caption: string;
};
export function StatCard({ label, value, icon: Icon, tone, caption }: Props) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={19} />
        </span>
      </div>
      <strong>{currency(value)}</strong>
      <small>{caption}</small>
    </article>
  );
}
