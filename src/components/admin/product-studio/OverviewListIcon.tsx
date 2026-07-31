import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BadgeCheck,
  Cable,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Droplets,
  Factory,
  FileBadge,
  FileText,
  GitCompare,
  Headset,
  Layers,
  LayoutGrid,
  Lock,
  MessageCircleMore,
  Package,
  PackageSearch,
  Percent,
  Plane,
  Plug,
  RefreshCw,
  SearchCheck,
  Shield,
  Shirt,
  Smartphone,
  Star,
  Tag,
  Truck,
  Users,
} from 'lucide-react';

/** Keyword → Lucide icon for overview / specs bullet lines (first match wins). */
const ICON_RULES: Array<{ test: RegExp; icon: LucideIcon }> = [
  { test: /spill|dust|coat|water|proof|droplet/i, icon: Droplets },
  { test: /sew|authentic|brand.?label|verified/i, icon: Shield },
  { test: /unbreakable|finish|structure|build|integrity/i, icon: Layers },
  { test: /breath|cloth|wear|apparel|garment|fashion|textile/i, icon: Shirt },
  { test: /refund|exchange|return|guarantee/i, icon: RefreshCw },
  { test: /warranty|serial/i, icon: Clock },
  { test: /checkout|payment|secure.?partner|lock/i, icon: Lock },
  { test: /deliver|nationwide|ship|transit|courier/i, icon: Truck },
  { test: /message|support|inbound|headset|staff/i, icon: Headset },
  { test: /certificat|verification|deposit/i, icon: BadgeCheck },
  { test: /compliance|regulat/i, icon: ClipboardCheck },
  { test: /compar/i, icon: GitCompare },
  { test: /review|insight|rating/i, icon: Star },
  { test: /promo|campaign|deal|discount|percent/i, icon: Percent },
  { test: /price|tracking|tracker/i, icon: Tag },
  { test: /creator|influencer|lifestyle|audience|buyer|shopper|circle/i, icon: Users },
  { test: /quality.?control|inspect/i, icon: SearchCheck },
  { test: /manufactur|production|factory/i, icon: Factory },
  { test: /export/i, icon: Plane },
  { test: /sourc|buying.?house|vendor/i, icon: PackageSearch },
  { test: /develop|product.?dev/i, icon: Package },
  { test: /charg(e|ing)|cable/i, icon: Cable },
  { test: /device|phone|smart/i, icon: Smartphone },
  { test: /document|manual|guide/i, icon: FileText },
  { test: /warranty.?card|serial.?code/i, icon: FileBadge },
  { test: /plug|power|adapter/i, icon: Plug },
  { test: /categor/i, icon: LayoutGrid },
  { test: /^brand\b|brand:/i, icon: Award },
  { test: /messag(e|ing)|chat/i, icon: MessageCircleMore },
];

export function resolveOverviewListIcon(text: string): LucideIcon {
  const value = String(text || '').trim();
  for (const rule of ICON_RULES) {
    if (rule.test.test(value)) return rule.icon;
  }
  return CheckCircle2;
}

export interface OverviewListItemProps {
  text: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  iconSize?: number;
}

/** Bullet row: contextual Lucide icon + text — mirrors storefront OverviewListItem. */
export function OverviewListItem({
  text,
  className = '',
  iconClassName = '',
  textClassName = '',
  iconSize = 14,
}: OverviewListItemProps) {
  const Icon = resolveOverviewListIcon(text);
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <Icon
        size={iconSize}
        strokeWidth={2.25}
        className={`shrink-0 mt-0.5 text-[#EB4501] ${iconClassName}`}
        aria-hidden
      />
      <span className={textClassName}>{text}</span>
    </div>
  );
}
