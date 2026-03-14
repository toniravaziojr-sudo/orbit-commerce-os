// =============================================
// BANNER ASSOCIATION STEP — User picks product/category/URL/none
// =============================================

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ProductSelector, CategorySelector } from '@/components/builder/DynamicSelectors';
import { BannerAssociationPayload } from '@/lib/builder/aiWizardRegistry';

interface BannerAssociationStepProps {
  value?: BannerAssociationPayload;
  onChange: (payload: BannerAssociationPayload) => void;
}

function deriveLink(type: string, data: Partial<BannerAssociationPayload>): string {
  if (type === 'url') return data.manualUrl || '';
  // Product and category links will be derived once selection is made
  // The actual slug resolution happens via the selector components
  if (type === 'none') return '';
  return '';
}

export function BannerAssociationStep({ value, onChange }: BannerAssociationStepProps) {
  const [assocType, setAssocType] = useState<BannerAssociationPayload['associationType']>(
    value?.associationType || 'none'
  );
  const [productId, setProductId] = useState(value?.productId || '');
  const [categoryId, setCategoryId] = useState(value?.categoryId || '');
  const [manualUrl, setManualUrl] = useState(value?.manualUrl || '');

  useEffect(() => {
    const payload: BannerAssociationPayload = {
      associationType: assocType,
      productId: assocType === 'product' ? productId : undefined,
      categoryId: assocType === 'category' ? categoryId : undefined,
      manualUrl: assocType === 'url' ? manualUrl : undefined,
      derivedLinkUrl: deriveLink(assocType, { manualUrl }),
    };
    onChange(payload);
  }, [assocType, productId, categoryId, manualUrl]);

  return (
    <div className="space-y-4">
      <RadioGroup
        value={assocType}
        onValueChange={(v) => setAssocType(v as BannerAssociationPayload['associationType'])}
        className="space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="product" id="assoc-product" />
          <Label htmlFor="assoc-product" className="text-sm cursor-pointer">Produto</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="category" id="assoc-category" />
          <Label htmlFor="assoc-category" className="text-sm cursor-pointer">Categoria</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="url" id="assoc-url" />
          <Label htmlFor="assoc-url" className="text-sm cursor-pointer">URL manual</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="none" id="assoc-none" />
          <Label htmlFor="assoc-none" className="text-sm cursor-pointer">Nenhum (institucional)</Label>
        </div>
      </RadioGroup>

      {assocType === 'product' && (
        <div className="pt-2">
          <ProductSelector
            value={productId}
            onChange={(v) => setProductId(v as string)}
            placeholder="Selecione um produto"
          />
        </div>
      )}

      {assocType === 'category' && (
        <div className="pt-2">
          <CategorySelector
            value={categoryId}
            onChange={(v) => setCategoryId(v as string)}
            placeholder="Selecione uma categoria"
          />
        </div>
      )}

      {assocType === 'url' && (
        <div className="pt-2">
          <Label className="text-xs text-muted-foreground mb-1">URL de destino</Label>
          <Input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://... ou /pagina"
          />
        </div>
      )}
    </div>
  );
}
