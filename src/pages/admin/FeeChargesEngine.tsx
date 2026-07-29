import React, { useEffect, useMemo, useState } from 'react';
import { Percent, Plus, Trash2, Pencil, Wallet, Calculator, ToggleLeft, ToggleRight } from 'lucide-react';
import { useFeeCharges, FeeCharge, FeeChargeType, FeeRateType, FeeScopeType } from '../../contexts/FeeChargesContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogBrand, CatalogCategory } from '../../types/catalog';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

type PageTab = 'rules' | 'payment-options';

const FEE_TYPE_LABEL: Record<FeeChargeType, string> = {
  service_charge: 'Service Charge',
  platform_fee: 'Platform Fee',
  tax: 'Tax',
  delivery: 'Delivery',
};

const emptyDraft = (): Partial<FeeCharge> => ({
  name: '',
  type: 'platform_fee',
  rateType: 'percentage',
  rateValue: 0,
  scopeType: 'platform',
  scopeBrandIds: [],
  scopeCategoryIds: [],
  scopeProductIds: [],
  active: true,
  description: '',
});

export default function FeeChargesEngine() {
  const { feeCharges, paymentOptions, loading, createFeeCharge, updateFeeCharge, deleteFeeCharge, toggleFeeChargeActive, updatePaymentOptions, previewFees } =
    useFeeCharges();

  const [activeTab, setActiveTab] = useState<PageTab>('rules');
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<FeeCharge>>(emptyDraft());
  const [previewPrice, setPreviewPrice] = useState(1000);

  const [minDeposit, setMinDeposit] = useState(paymentOptions.minDepositPercent);
  const [maxDeposit, setMaxDeposit] = useState(paymentOptions.maxDepositPercent);
  const [partialEnabled, setPartialEnabled] = useState(paymentOptions.partialPaymentEnabled);

  useEffect(() => {
    catalogApi.listBrands().then(setBrands).catch(() => {});
    catalogApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setMinDeposit(paymentOptions.minDepositPercent);
    setMaxDeposit(paymentOptions.maxDepositPercent);
    setPartialEnabled(paymentOptions.partialPaymentEnabled);
  }, [paymentOptions]);

  const openCreateModal = () => {
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const openEditModal = (fee: FeeCharge) => {
    setDraft({ ...fee });
    setModalOpen(true);
  };

  const handleSaveDraft = async () => {
    if (!draft.name?.trim()) return;
    if (draft.id) {
      await updateFeeCharge(draft.id, draft);
    } else {
      await createFeeCharge(draft as Omit<FeeCharge, 'id' | 'createdAt' | 'updatedAt'>);
    }
    setModalOpen(false);
  };

  const stats = useMemo(() => {
    const active = feeCharges.filter((f) => f.active).length;
    const scoped = feeCharges.filter((f) => f.scopeType !== 'platform').length;
    return { total: feeCharges.length, active, scoped };
  }, [feeCharges]);

  const preview = previewFees({
    basePrice: previewPrice,
    brandId: draft.scopeType === 'brand' ? draft.scopeBrandIds?.[0] : undefined,
    categoryId: draft.scopeType === 'category' ? draft.scopeCategoryIds?.[0] : undefined,
  });

  const columns: DataTableColumn<FeeCharge>[] = [
    {
      key: 'name',
      header: 'Fee / Charge',
      sortValue: (f) => f.name,
      render: (f) => (
        <div>
          <div className="text-[13px] font-bold text-app-text-primary">{f.name}</div>
          <div className="text-[10px] text-app-text-secondary">{f.description}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (f) => f.type,
      render: (f) => <Badge variant="neutral">{FEE_TYPE_LABEL[f.type]}</Badge>,
    },
    {
      key: 'rate',
      header: 'Rate',
      sortValue: (f) => f.rateValue,
      render: (f) => (
        <span className="font-mono font-bold text-[13px] text-app-text-primary">
          {f.rateType === 'percentage' ? `${f.rateValue}%` : `৳ ${f.rateValue}`}
        </span>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      sortValue: (f) => f.scopeType,
      render: (f) => {
        if (f.scopeType === 'platform') return <Badge variant="accent">Platform-wide</Badge>;
        if (f.scopeType === 'brand') return <Badge variant="info">{f.scopeBrandIds?.length || 0} brand(s)</Badge>;
        if (f.scopeType === 'category') return <Badge variant="info">{f.scopeCategoryIds?.length || 0} categor{(f.scopeCategoryIds?.length || 0) === 1 ? 'y' : 'ies'}</Badge>;
        return <Badge variant="info">{f.scopeProductIds?.length || 0} product(s)</Badge>;
      },
    },
    {
      key: 'active',
      header: 'Status',
      sortValue: (f) => (f.active ? 1 : 0),
      render: (f) => <Badge variant={f.active ? 'success' : 'neutral'}>{f.active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (f) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => toggleFeeChargeActive(f.id)}
            className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
            title={f.active ? 'Deactivate' : 'Activate'}
          >
            {f.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => openEditModal(f)}
            className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteFeeCharge(f.id)}
            className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const tabs: TabItem[] = [
    { key: 'rules', label: 'Fee Rules', icon: Percent, badge: feeCharges.length },
    { key: 'payment-options', label: 'Payment Options', icon: Wallet },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Fee & Charges Engine</h1>
          <p className="text-app-text-secondary text-[12px]">
            Configure service charges, platform fees, tax and delivery rules, plus platform-wide advance payment options.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
        >
          <Plus className="w-4 h-4" /> New Fee / Charge
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Total Rules" value={stats.total} icon={Percent} accent="orange" />
        <StatTile label="Active Rules" value={stats.active} icon={Calculator} accent="emerald" />
        <StatTile label="Brand / Category Scoped" value={stats.scoped} icon={Wallet} accent="indigo" />
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as PageTab)} />

      {activeTab === 'rules' && (
        <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
          <DataTable
            columns={columns}
            rows={feeCharges}
            getRowId={(f) => f.id}
            isLoading={loading}
            emptyMessage="No fee or charge rules configured yet."
          />
        </GlassCard>
      )}

      {activeTab === 'payment-options' && (
        <GlassCard hoverLift={false} className="p-6 space-y-6 max-w-xl">
          <div>
            <h3 className="text-base font-extrabold text-app-text-primary">Advance / Partial Payment</h3>
            <p className="text-xs text-app-text-secondary mt-1">
              Set the platform-wide allowed deposit percentage range. Sellers can enable partial payment per-product in Product Studio
              and choose a deposit % within this range.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={partialEnabled}
              onChange={(e) => setPartialEnabled(e.target.checked)}
              className="rounded border-app-border text-app-accent focus:ring-app-accent w-4 h-4"
            />
            <span className="text-[12px] font-bold text-app-text-primary">Enable partial/advance payment platform-wide</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Minimum Deposit %</label>
              <input
                type="number"
                min={1}
                max={100}
                value={minDeposit}
                onChange={(e) => setMinDeposit(Number(e.target.value))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Maximum Deposit %</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxDeposit}
                onChange={(e) => setMaxDeposit(Number(e.target.value))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
          </div>

          <button
            onClick={() => updatePaymentOptions({ partialPaymentEnabled: partialEnabled, minDepositPercent: minDeposit, maxDepositPercent: maxDeposit })}
            className="w-full py-2.5 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
          >
            Save Payment Options
          </button>
        </GlassCard>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.id ? 'Edit Fee / Charge' : 'New Fee / Charge'}
        maxWidth="max-w-lg"
        footer={
          <button
            onClick={handleSaveDraft}
            className="w-full py-2.5 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
          >
            {draft.id ? 'Save Changes' : 'Create Fee / Charge'}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Name</label>
            <input
              value={draft.name || ''}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Dhaka Metro Delivery Fee"
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Charge Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as FeeChargeType }))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
              >
                {Object.entries(FEE_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Rate Type</label>
              <select
                value={draft.rateType}
                onChange={(e) => setDraft((d) => ({ ...d, rateType: e.target.value as FeeRateType }))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (৳)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">
              Rate Value {draft.rateType === 'percentage' ? '(%)' : '(৳)'}
            </label>
            <input
              type="number"
              value={draft.rateValue ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, rateValue: Number(e.target.value) }))}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Scope</label>
            <select
              value={draft.scopeType}
              onChange={(e) => setDraft((d) => ({ ...d, scopeType: e.target.value as FeeScopeType, scopeBrandIds: [], scopeCategoryIds: [], scopeProductIds: [] }))}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            >
              <option value="platform">Platform-wide</option>
              <option value="brand">Specific Brand(s)</option>
              <option value="category">Specific Category(ies)</option>
              <option value="product">Specific Product(s)</option>
            </select>
          </div>

          {draft.scopeType === 'brand' && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Brands (multi-select)</label>
              <select
                multiple
                value={draft.scopeBrandIds || []}
                onChange={(e) => setDraft((d) => ({ ...d, scopeBrandIds: Array.from(e.target.selectedOptions).map((o: HTMLOptionElement) => o.value) }))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition h-28"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {draft.scopeType === 'category' && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Categories (multi-select)</label>
              <select
                multiple
                value={draft.scopeCategoryIds || []}
                onChange={(e) => setDraft((d) => ({ ...d, scopeCategoryIds: Array.from(e.target.selectedOptions).map((o: HTMLOptionElement) => o.value) }))}
                className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition h-28"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Description</label>
            <textarea
              value={draft.description || ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary h-16 focus:border-app-accent focus:outline-none transition"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.active ?? true}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              className="rounded border-app-border text-app-accent focus:ring-app-accent"
            />
            <span className="text-[11px] font-bold text-app-text-secondary uppercase tracking-wider">Active</span>
          </label>

          {/* Live price preview */}
          <div className="bg-slate-50 border border-app-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Live Price Preview</span>
              <input
                type="number"
                value={previewPrice}
                onChange={(e) => setPreviewPrice(Number(e.target.value))}
                className="w-24 bg-white border border-app-border rounded-lg px-2 py-1 text-[11px] font-mono text-right"
              />
            </div>
            {preview.lines.length === 0 ? (
              <p className="text-[11px] text-app-text-secondary italic">No active fees apply to this scope yet.</p>
            ) : (
              <div className="space-y-1">
                {preview.lines.map((line) => (
                  <div key={line.feeId} className="flex justify-between text-[11px] text-app-text-secondary">
                    <span>{line.name}</span>
                    <span className="font-mono">+৳ {line.amount}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-[12px] font-extrabold text-app-text-primary pt-2 border-t border-app-border">
              <span>Final Price</span>
              <span className="font-mono">৳ {preview.finalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
