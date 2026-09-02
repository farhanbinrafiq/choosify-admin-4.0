import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, Handshake, Wallet } from 'lucide-react';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import Consumers from './Consumers';
import CreatorEconomy from './CreatorEconomy';
import CreatorEarnings from './CreatorEarnings';

type HubTab = 'roster' | 'economy' | 'earnings';

/** Reuses the Consumers page's existing `viewMode=creators` filter (see ViewModeWrapper in App.tsx). */
function CreatorRosterTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('viewMode') !== 'creators') {
      const next = new URLSearchParams(searchParams);
      next.set('viewMode', 'creators');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  return <Consumers />;
}

export default function CreatorsHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('roster');

  const tabs: TabItem[] = [
    { key: 'roster', label: 'Creator Roster', icon: Users },
    { key: 'economy', label: 'Collaborations & Campaigns', icon: Handshake },
    { key: 'earnings', label: 'Earnings & Payouts', icon: Wallet },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Creators Hub</h1>
          <p className="text-app-text-secondary text-[12px]">
            Creator roster, brand collaborations &amp; campaigns, and creator earnings — unified in one workspace.
          </p>
        </div>
        <Link
          to="/admin/creator-studio"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF5B00] hover:bg-[#FF5B00] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm no-underline"
        >
          Open Creator Studio
        </Link>
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as HubTab)} />

      {activeTab === 'roster' && <CreatorRosterTab />}
      {activeTab === 'economy' && <CreatorEconomy />}
      {activeTab === 'earnings' && <CreatorEarnings />}
    </div>
  );
}
