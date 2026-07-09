import React from 'react';
import type { SellerProductIntelligence } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  products?: SellerProductIntelligence[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function SellerProductIntelligenceTable({ products, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Product Intelligence"
      subtitle="Per-product performance signals"
      loading={loading}
      error={error}
      isEmpty={!products?.length}
      emptyTitle="No products"
      emptyMessage="Publish products to unlock product-level intelligence."
      onRetry={onRetry}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-app-text-secondary border-b border-app-border">
              <th className="py-3 pr-4">Product</th>
              <th className="py-3 pr-4">Views</th>
              <th className="py-3 pr-4">Wishlist</th>
              <th className="py-3 pr-4">Compare</th>
              <th className="py-3 pr-4">Rating</th>
              <th className="py-3 pr-4">Reviews</th>
              <th className="py-3 pr-4">Stock</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Score</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product) => (
              <tr key={product.id} className="border-b border-app-border/50 last:border-0">
                <td className="py-3 pr-4">
                  <div className="font-bold text-white">{product.title}</div>
                  <div className="text-[10px] text-app-text-secondary">
                    {product.brandName} • {product.categoryName}
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono">{product.views}</td>
                <td className="py-3 pr-4 font-mono">{product.wishlist}</td>
                <td className="py-3 pr-4 font-mono">{product.compareCount}</td>
                <td className="py-3 pr-4 font-mono">{product.averageRating || '—'}</td>
                <td className="py-3 pr-4 font-mono">{product.reviewCount}</td>
                <td className="py-3 pr-4">
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      product.stockStatus === 'out_of_stock'
                        ? 'text-rose-400'
                        : product.stockStatus === 'low_stock'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {product.stockStatus.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 pr-4 capitalize">{product.approvalStatus}</td>
                <td className="py-3 pr-4 font-mono text-app-accent">{product.performanceScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
