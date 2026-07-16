import React from 'react';
import { Clock, Wifi, CreditCard, Banknote } from 'lucide-react';
import type { PaymentMethod } from '../../store/orders.store';

interface PaymentBadgeProps {
  method: PaymentMethod;
}

const config: Record<PaymentMethod, { icon: React.ElementType; label: string; color: string }> = {
  Unpaid:  { icon: Clock,      label: 'Unpaid', color: 'text-red-600   dark:text-red-400'    },
  Cash:    { icon: Banknote,   label: 'Cash',   color: 'text-amber-600 dark:text-amber-400'  },
  Card:    { icon: CreditCard, label: 'Card',   color: 'text-purple-600 dark:text-purple-400'},
  Online:  { icon: Wifi,       label: 'Online', color: 'text-blue-600   dark:text-blue-400'  },
};

export function PaymentBadge({ method }: PaymentBadgeProps) {
  const c = config[method] ?? config.Unpaid;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${c.color}`}>
      <Icon className="h-4 w-4" />
      {c.label}
    </span>
  );
}
