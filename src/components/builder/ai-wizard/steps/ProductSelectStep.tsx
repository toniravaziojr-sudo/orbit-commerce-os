// =============================================
// PRODUCT SELECT STEP — Simple: pick a product or "none"
// New architecture v2: replaces BannerAssociationStep for Banner wizard
// =============================================

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ProductSelector } from '@/components/builder/DynamicSelectors';

export interface ProductSelectData {
  hasProduct: boolean;
  productId?: string;
}

interface ProductSelectStepProps {
  value?: ProductSelectData;
  onChange: (data: ProductSelectData) => void;
}

export function ProductSelectStep({ value, onChange }: ProductSelectStepProps) {
  const [selection, setSelection] = useState<'product' | 'none'>(
    value?.hasProduct ? 'product' : 'none'
  );
  const [productId, setProductId] = useState(value?.productId || '');

  useEffect(() => {
    if (!value) {
      onChange({ hasProduct: false });
    }
  }, []);

  useEffect(() => {
    if (selection === 'none') {
      onChange({ hasProduct: false });
    } else {
      onChange({ hasProduct: true, productId: productId || undefined });
    }
  }, [selection, productId]);

  return (
    <div className="space-y-4">
      <RadioGroup
        value={selection}
        onValueChange={(v) => setSelection(v as 'product' | 'none')}
        className="space-y-2"
      >
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <RadioGroupItem value="product" id="ps-product" className="mt-0.5" />
          <div>
            <Label htmlFor="ps-product" className="text-sm font-medium cursor-pointer">
              Associar a um produto
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA usará o produto como referência visual
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
          <RadioGroupItem value="none" id="ps-none" className="mt-0.5" />
          <div>
            <Label htmlFor="ps-none" className="text-sm font-medium cursor-pointer">
              Nenhum produto
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Banner institucional, de campanha ou genérico
            </p>
          </div>
        </div>
      </RadioGroup>

      {selection === 'product' && (
        <div className="pt-2">
          <ProductSelector
            value={productId}
            onChange={(v) => setProductId(v as string)}
            placeholder="Selecione um produto"
          />
        </div>
      )}
    </div>
  );
}
