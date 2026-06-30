/**
 * CourierSelector Component
 * 
 * Dropdown showing available couriers with:
 * - Estimated delivery time
 * - Delivery charge
 * - Courier logo
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { CourierProviderConfig } from '../../types/courier';

interface CourierSelectorProps {
  couriers: CourierProviderConfig[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

export const CourierSelector: React.FC<CourierSelectorProps> = ({
  couriers,
  selectedCode,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = couriers.find(c => c.code === selectedCode);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-slate-900 border border-app-border rounded-xl hover:border-slate-400 transition-colors flex items-center justify-between text-white"
      >
        <div className="flex items-center gap-3">
          {selected?.logo ? (
            <img
              src={selected.logo}
              alt={selected.name}
              className="w-6 h-6 object-contain rounded"
            />
          ) : (
            <div className="w-6 h-6 bg-[#F4631E]/20 text-[#F4631E] rounded flex items-center justify-center text-xs font-bold">
              {selected?.name?.charAt(0) || 'C'}
            </div>
          )}
          <span className="font-semibold">
            {selected?.name || 'Choose Courier...'}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-app-border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
          {couriers.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs font-semibold">
              No active couriers available
            </div>
          ) : (
            couriers.map(courier => {
              const isCurrent = courier.code === selectedCode;
              return (
                <button
                  key={courier.code}
                  type="button"
                  onClick={() => {
                    onSelect(courier.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 border-b border-app-border last:border-0 transition-colors flex items-center justify-between ${
                    isCurrent ? 'bg-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {courier.logo ? (
                      <img
                        src={courier.logo}
                        alt={courier.name}
                        className="w-6 h-6 object-contain rounded"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-[#F4631E]/20 text-[#F4631E] rounded flex items-center justify-center text-xs font-bold">
                        {courier.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white text-sm">{courier.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        Standard Nationwide delivery
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Est. Delivery</div>
                      <div className="text-xs font-bold text-emerald-400">1-3 days</div>
                    </div>
                    {isCurrent && <Check size={16} className="text-[#F4631E] ml-2" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CourierSelector;
