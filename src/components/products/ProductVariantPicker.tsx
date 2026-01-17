// =============================================
// PRODUCT VARIANT PICKER - Select pre-defined variant types and options for a product
// =============================================

import { useState, useEffect, useMemo } from 'react';
import { useProductVariantTypes, VariantType } from '@/hooks/useProductVariantTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  GripVertical,
  ImageIcon,
  Package,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

export interface PendingVariant {
  id: string; // temporary ID for UI
  sku: string;
  name: string;
  option1_name: string;
  option1_value: string;
  option2_name: string;
  option2_value: string;
  option3_name: string;
  option3_value: string;
  price: number | null;
  compare_at_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  weight: number | null;
  gtin: string;
  is_active: boolean;
  image_url: string | null;
  image_file?: File;
}

interface SelectedVariationType {
  typeId: string;
  typeName: string;
  selectedOptions: string[];
}

interface ProductVariantPickerProps {
  variants: PendingVariant[];
  onChange: (variants: PendingVariant[]) => void;
  productName?: string;
  productSku?: string;
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export function ProductVariantPicker({
  variants,
  onChange,
  productName = '',
  productSku = ''
}: ProductVariantPickerProps) {
  const { variantTypes, isLoading } = useProductVariantTypes();
  const [selectedTypes, setSelectedTypes] = useState<SelectedVariationType[]>([]);

  // Generate variant combinations when options change
  const generateVariantCombinations = (types: SelectedVariationType[]): PendingVariant[] => {
    const activeTypes = types.filter(t => t.selectedOptions.length > 0);
    if (activeTypes.length === 0) return [];

    // Generate all combinations
    const combinations: Record<string, string>[] = [];
    
    const generateCombos = (index: number, current: Record<string, string>) => {
      if (index === activeTypes.length) {
        combinations.push({ ...current });
        return;
      }
      
      const type = activeTypes[index];
      for (const option of type.selectedOptions) {
        generateCombos(index + 1, { ...current, [type.typeName]: option });
      }
    };
    
    generateCombos(0, {});

    // Map to PendingVariant format
    return combinations.map((combo, idx) => {
      const optionEntries = Object.entries(combo);
      const variantName = optionEntries.map(([_, v]) => v).join(' / ');
      
      // Check if variant already exists (to preserve edits)
      const existingVariant = variants.find(v => {
        const existingOptions = [
          v.option1_value,
          v.option2_value,
          v.option3_value
        ].filter(Boolean).join(' / ');
        return existingOptions === variantName;
      });

      if (existingVariant) return existingVariant;

      return {
        id: generateTempId(),
        sku: `${productSku}-${idx + 1}`,
        name: `${productName} - ${variantName}`.trim(),
        option1_name: optionEntries[0]?.[0] || '',
        option1_value: optionEntries[0]?.[1] || '',
        option2_name: optionEntries[1]?.[0] || '',
        option2_value: optionEntries[1]?.[1] || '',
        option3_name: optionEntries[2]?.[0] || '',
        option3_value: optionEntries[2]?.[1] || '',
        price: null,
        compare_at_price: null,
        cost_price: null,
        stock_quantity: 0,
        weight: null,
        gtin: '',
        is_active: true,
        image_url: null,
      };
    });
  };

  // Handle variant type selection
  const handleAddVariantType = (typeId: string) => {
    const type = variantTypes.find(t => t.id === typeId);
    if (!type || selectedTypes.some(st => st.typeId === typeId)) return;
    if (selectedTypes.length >= 3) return;

    const newSelectedTypes = [...selectedTypes, {
      typeId: type.id,
      typeName: type.name,
      selectedOptions: [],
    }];
    setSelectedTypes(newSelectedTypes);
  };

  const handleRemoveVariantType = (typeId: string) => {
    const newSelectedTypes = selectedTypes.filter(st => st.typeId !== typeId);
    setSelectedTypes(newSelectedTypes);
    
    // Regenerate variants
    const newVariants = generateVariantCombinations(newSelectedTypes);
    onChange(newVariants);
  };

  const handleToggleOption = (typeId: string, optionValue: string) => {
    const newSelectedTypes = selectedTypes.map(st => {
      if (st.typeId !== typeId) return st;
      
      const hasOption = st.selectedOptions.includes(optionValue);
      return {
        ...st,
        selectedOptions: hasOption
          ? st.selectedOptions.filter(o => o !== optionValue)
          : [...st.selectedOptions, optionValue],
      };
    });
    
    setSelectedTypes(newSelectedTypes);
    
    // Regenerate variants
    const newVariants = generateVariantCombinations(newSelectedTypes);
    onChange(newVariants);
  };

  const handleUpdateVariant = (id: string, field: keyof PendingVariant, value: any) => {
    onChange(variants.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleImageUpload = (variantId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange(variants.map(v => 
        v.id === variantId 
          ? { ...v, image_url: e.target?.result as string, image_file: file } 
          : v
      ));
    };
    reader.readAsDataURL(file);
  };

  // Available types (not yet selected)
  const availableTypes = variantTypes.filter(
    t => !selectedTypes.some(st => st.typeId === t.id)
  );

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (variantTypes.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Variações do Produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você ainda não cadastrou tipos de variação. 
              <Link to="/offers" className="ml-1 underline text-primary">
                Acesse Aumentar Ticket → Variações
              </Link>
              {' '}para criar variações como Cor, Tamanho, etc.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Variações do Produto
          </CardTitle>
          <Badge variant="secondary">
            {variants.length} {variants.length === 1 ? 'variação' : 'variações'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variant Type Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select 
                onValueChange={handleAddVariantType}
                disabled={selectedTypes.length >= 3 || availableTypes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo de variação..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.options?.length || 0} opções)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTypes.length >= 3 && (
              <p className="text-xs text-muted-foreground">Máximo de 3 tipos</p>
            )}
          </div>

          {/* Selected Types with Options */}
          {selectedTypes.length > 0 && (
            <div className="space-y-4">
              {selectedTypes.map(st => {
                const type = variantTypes.find(t => t.id === st.typeId);
                if (!type) return null;

                return (
                  <div key={st.typeId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">{st.typeName}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveVariantType(st.typeId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {type.options?.map(option => {
                        const isSelected = st.selectedOptions.includes(option.value);
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                              isSelected 
                                ? "bg-primary/10 border-primary" 
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleOption(st.typeId, option.value)}
                            />
                            <span className="text-sm">{option.value}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Generated Variants */}
        {variants.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Variações Geradas</Label>
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="border rounded-lg p-4 space-y-4 bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-medium text-sm">
                        {[variant.option1_value, variant.option2_value, variant.option3_value]
                          .filter(Boolean)
                          .join(' / ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Ativo</Label>
                      <Switch
                        checked={variant.is_active}
                        onCheckedChange={(checked) => handleUpdateVariant(variant.id, 'is_active', checked)}
                      />
                    </div>
                  </div>

                  {/* Image and Name */}
                  <div className="grid gap-4 md:grid-cols-[100px_1fr]">
                    {/* Image Upload */}
                    <div className="space-y-1">
                      <Label className="text-xs">Imagem</Label>
                      <label
                        className={cn(
                          "flex flex-col items-center justify-center w-[100px] h-[100px] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                          variant.image_url && "border-solid"
                        )}
                      >
                        {variant.image_url ? (
                          <img
                            src={variant.image_url}
                            alt={variant.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                            <span className="text-xs mt-1">Upload</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(variant.id, file);
                          }}
                        />
                      </label>
                    </div>

                    {/* Name and SKU */}
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome da Variação</Label>
                          <Input
                            value={variant.name}
                            onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                            placeholder={`${productName} - Variação ${index + 1}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SKU</Label>
                          <Input
                            value={variant.sku}
                            onChange={(e) => handleUpdateVariant(variant.id, 'sku', e.target.value)}
                            placeholder="SKU-VAR-001"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price and Stock */}
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.price ?? ''}
                        onChange={(e) => handleUpdateVariant(variant.id, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Preço Comparativo</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.compare_at_price ?? ''}
                        onChange={(e) => handleUpdateVariant(variant.id, 'compare_at_price', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.cost_price ?? ''}
                        onChange={(e) => handleUpdateVariant(variant.id, 'cost_price', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estoque</Label>
                      <Input
                        type="number"
                        value={variant.stock_quantity}
                        onChange={(e) => handleUpdateVariant(variant.id, 'stock_quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={variant.weight ?? ''}
                        onChange={(e) => handleUpdateVariant(variant.id, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0,000"
                      />
                    </div>
                  </div>

                  {/* GTIN */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">GTIN/EAN (Código de Barras)</Label>
                      <Input
                        value={variant.gtin}
                        onChange={(e) => handleUpdateVariant(variant.id, 'gtin', e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="Apenas números"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no variants generated */}
        {variants.length === 0 && selectedTypes.length > 0 && (
          <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Selecione opções acima para gerar variações</p>
          </div>
        )}

        {selectedTypes.length === 0 && (
          <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Selecione um tipo de variação para começar</p>
            <p className="text-xs mt-1">
              Precisa criar variações?{' '}
              <Link to="/offers" className="underline text-primary">
                Acesse Aumentar Ticket → Variações
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
