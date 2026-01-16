// =============================================
// PRODUCT VARIANT SELECTOR - UI for selecting product variations
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { VariantOptionGroup } from '@/hooks/useProductVariants';

interface ProductVariantSelectorProps {
  optionGroups: VariantOptionGroup[];
  selectedOptions: Record<string, string>;
  onSelectOption: (optionName: string, value: string) => void;
  disabled?: boolean;
}

/**
 * Renders variant selectors (buttons) for each option group
 * e.g., Cor: [Azul] [Vermelho] [Verde]
 *       Tamanho: [P] [M] [G]
 */
export function ProductVariantSelector({
  optionGroups,
  selectedOptions,
  onSelectOption,
  disabled = false,
}: ProductVariantSelectorProps) {
  if (optionGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      {optionGroups.map((group) => (
        <div key={group.name} className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {group.name}
            {selectedOptions[group.name] && (
              <span className="text-muted-foreground font-normal ml-2">
                {selectedOptions[group.name]}
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {group.values.map((value) => {
              const isSelected = selectedOptions[group.name] === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectOption(group.name, value)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md border transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
