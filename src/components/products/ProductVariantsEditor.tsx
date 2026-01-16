import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  GripVertical,
  ImageIcon,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ProductVariantsEditorProps {
  variants: PendingVariant[];
  onChange: (variants: PendingVariant[]) => void;
  productName?: string;
  productSku?: string;
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

export function ProductVariantsEditor({
  variants,
  onChange,
  productName = '',
  productSku = ''
}: ProductVariantsEditorProps) {
  const [optionTypes, setOptionTypes] = useState<{ name: string; values: string[] }[]>([
    { name: 'Tamanho', values: [] }
  ]);

  const handleAddVariant = () => {
    const newVariant: PendingVariant = {
      id: generateTempId(),
      sku: `${productSku}-${variants.length + 1}`,
      name: '',
      option1_name: optionTypes[0]?.name || '',
      option1_value: '',
      option2_name: optionTypes[1]?.name || '',
      option2_value: '',
      option3_name: optionTypes[2]?.name || '',
      option3_value: '',
      price: null,
      compare_at_price: null,
      cost_price: null,
      stock_quantity: 0,
      weight: null,
      gtin: '',
      is_active: true,
      image_url: null,
    };
    onChange([...variants, newVariant]);
  };

  const handleRemoveVariant = (id: string) => {
    onChange(variants.filter(v => v.id !== id));
  };

  const handleUpdateVariant = (id: string, field: keyof PendingVariant, value: any) => {
    onChange(variants.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleAddOptionType = () => {
    if (optionTypes.length < 3) {
      const newOptionName = optionTypes.length === 0 ? 'Tamanho' 
        : optionTypes.length === 1 ? 'Cor' 
        : 'Material';
      setOptionTypes([...optionTypes, { name: newOptionName, values: [] }]);
    }
  };

  const handleRemoveOptionType = (index: number) => {
    const newTypes = optionTypes.filter((_, i) => i !== index);
    setOptionTypes(newTypes);
    
    // Clear corresponding option values from variants
    const optionField = `option${index + 1}_name` as keyof PendingVariant;
    const valueField = `option${index + 1}_value` as keyof PendingVariant;
    onChange(variants.map(v => ({
      ...v,
      [optionField]: '',
      [valueField]: ''
    })));
  };

  const handleOptionTypeNameChange = (index: number, name: string) => {
    const newTypes = [...optionTypes];
    newTypes[index].name = name;
    setOptionTypes(newTypes);
    
    // Update all variants with the new option name
    const optionField = `option${index + 1}_name` as keyof PendingVariant;
    onChange(variants.map(v => ({
      ...v,
      [optionField]: name
    })));
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
      <CardContent className="space-y-4">
        {/* Option Types */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tipos de Opção</Label>
          <div className="flex flex-wrap gap-2">
            {optionTypes.map((option, index) => (
              <div key={index} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <Input
                  value={option.name}
                  onChange={(e) => handleOptionTypeNameChange(index, e.target.value)}
                  className="h-8 w-32 text-sm"
                  placeholder={`Opção ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveOptionType(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {optionTypes.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOptionType}
                className="h-10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar opção
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ex: Tamanho (P, M, G), Cor (Azul, Vermelho), Material (Algodão, Poliéster)
          </p>
        </div>

        {/* Variants List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Variações</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar variação
            </Button>
          </div>

          {variants.length === 0 ? (
            <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma variação cadastrada</p>
              <p className="text-xs mt-1">Clique em "Adicionar variação" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="border rounded-lg p-4 space-y-4 bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Ativo</Label>
                        <Switch
                          checked={variant.is_active}
                          onCheckedChange={(checked) => handleUpdateVariant(variant.id, 'is_active', checked)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveVariant(variant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

                      {/* Option Values */}
                      <div className="grid gap-3 md:grid-cols-3">
                        {optionTypes.map((option, optIndex) => (
                          <div key={optIndex} className="space-y-1">
                            <Label className="text-xs">{option.name}</Label>
                            <Input
                              value={
                                optIndex === 0 ? variant.option1_value :
                                optIndex === 1 ? variant.option2_value :
                                variant.option3_value
                              }
                              onChange={(e) => handleUpdateVariant(
                                variant.id, 
                                optIndex === 0 ? 'option1_value' :
                                optIndex === 1 ? 'option2_value' :
                                'option3_value',
                                e.target.value
                              )}
                              placeholder={`Ex: ${
                                option.name.toLowerCase() === 'tamanho' ? 'M' :
                                option.name.toLowerCase() === 'cor' ? 'Azul' :
                                'Valor'
                              }`}
                            />
                          </div>
                        ))}
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
