// =============================================
// PRODUCT VARIANT TYPES CONTENT - Tab content for variant types management
// =============================================

import { useState } from 'react';
import { useProductVariantTypes, VariantType } from '@/hooks/useProductVariantTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Palette,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProductVariantTypesContent() {
  const {
    variantTypes,
    isLoading,
    createVariantType,
    updateVariantType,
    deleteVariantType,
    addOption,
    updateOption,
    deleteOption,
  } = useProductVariantTypes();

  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [newOptionValues, setNewOptionValues] = useState<Record<string, string>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionValue, setEditingOptionValue] = useState('');

  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    createVariantType.mutate(newTypeName.trim(), {
      onSuccess: () => setNewTypeName(''),
    });
  };

  const handleUpdateType = (id: string) => {
    if (!editingTypeName.trim()) return;
    updateVariantType.mutate({ id, name: editingTypeName.trim() }, {
      onSuccess: () => {
        setEditingTypeId(null);
        setEditingTypeName('');
      },
    });
  };

  const handleDeleteType = (id: string) => {
    deleteVariantType.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const toggleExpanded = (typeId: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  const handleAddOption = (typeId: string) => {
    const value = newOptionValues[typeId]?.trim();
    if (!value) return;
    addOption.mutate({ variantTypeId: typeId, value }, {
      onSuccess: () => {
        setNewOptionValues(prev => ({ ...prev, [typeId]: '' }));
      },
    });
  };

  const handleUpdateOption = (id: string) => {
    if (!editingOptionValue.trim()) return;
    updateOption.mutate({ id, value: editingOptionValue.trim() }, {
      onSuccess: () => {
        setEditingOptionId(null);
        setEditingOptionValue('');
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Variações do Produto
            </CardTitle>
            <CardDescription>
              Crie tipos de variações (ex: Cor, Tamanho) e suas opções para usar nos produtos
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create new variant type */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Nome da variação (ex: Cor, Tamanho, Material)"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
              />
            </div>
            <Button 
              onClick={handleCreateType}
              disabled={!newTypeName.trim() || createVariantType.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Variação
            </Button>
          </div>

          {/* List of variant types */}
          {variantTypes.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <Palette className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhuma variação cadastrada</p>
              <p className="text-xs mt-1">
                Crie variações como "Cor", "Tamanho" ou "Material" para usar nos seus produtos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {variantTypes.map((type) => (
                <VariantTypeCard
                  key={type.id}
                  type={type}
                  isExpanded={expandedTypes.has(type.id)}
                  isEditing={editingTypeId === type.id}
                  editingName={editingTypeName}
                  newOptionValue={newOptionValues[type.id] || ''}
                  editingOptionId={editingOptionId}
                  editingOptionValue={editingOptionValue}
                  onToggleExpand={() => toggleExpanded(type.id)}
                  onStartEdit={() => {
                    setEditingTypeId(type.id);
                    setEditingTypeName(type.name);
                  }}
                  onCancelEdit={() => {
                    setEditingTypeId(null);
                    setEditingTypeName('');
                  }}
                  onSaveEdit={() => handleUpdateType(type.id)}
                  onEditingNameChange={setEditingTypeName}
                  onDelete={() => setDeleteConfirmId(type.id)}
                  onNewOptionChange={(value) => setNewOptionValues(prev => ({ ...prev, [type.id]: value }))}
                  onAddOption={() => handleAddOption(type.id)}
                  onStartEditOption={(optionId, value) => {
                    setEditingOptionId(optionId);
                    setEditingOptionValue(value);
                  }}
                  onCancelEditOption={() => {
                    setEditingOptionId(null);
                    setEditingOptionValue('');
                  }}
                  onSaveEditOption={() => handleUpdateOption(editingOptionId!)}
                  onEditingOptionValueChange={setEditingOptionValue}
                  onDeleteOption={(optionId) => deleteOption.mutate(optionId)}
                  isPending={updateVariantType.isPending || addOption.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover variação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as opções desta variação também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDeleteType(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Sub-component for each variant type card
interface VariantTypeCardProps {
  type: VariantType;
  isExpanded: boolean;
  isEditing: boolean;
  editingName: string;
  newOptionValue: string;
  editingOptionId: string | null;
  editingOptionValue: string;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditingNameChange: (value: string) => void;
  onDelete: () => void;
  onNewOptionChange: (value: string) => void;
  onAddOption: () => void;
  onStartEditOption: (optionId: string, value: string) => void;
  onCancelEditOption: () => void;
  onSaveEditOption: () => void;
  onEditingOptionValueChange: (value: string) => void;
  onDeleteOption: (optionId: string) => void;
  isPending: boolean;
}

function VariantTypeCard({
  type,
  isExpanded,
  isEditing,
  editingName,
  newOptionValue,
  editingOptionId,
  editingOptionValue,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditingNameChange,
  onDelete,
  onNewOptionChange,
  onAddOption,
  onStartEditOption,
  onCancelEditOption,
  onSaveEditOption,
  onEditingOptionValueChange,
  onDeleteOption,
  isPending,
}: VariantTypeCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "border-b"
        )}
        onClick={() => !isEditing && onToggleExpand()}
      >
        <div className="flex items-center gap-3 flex-1">
          <button 
            className="p-1 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                className="h-8 max-w-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
              />
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={onSaveEdit}
                disabled={isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={onCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <span className="font-medium">{type.name}</span>
              <Badge variant="secondary" className="ml-2">
                {type.options?.length || 0} {type.options?.length === 1 ? 'opção' : 'opções'}
              </Badge>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onStartEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Options list - expandable */}
      {isExpanded && (
        <div className="p-4 bg-muted/30 space-y-3">
          <Label className="text-sm font-medium">Opções disponíveis</Label>
          
          {/* Add new option */}
          <div className="flex gap-2">
            <Input
              placeholder="Nova opção (ex: Azul, P, Algodão)"
              value={newOptionValue}
              onChange={(e) => onNewOptionChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddOption()}
              className="flex-1"
            />
            <Button 
              size="sm" 
              onClick={onAddOption}
              disabled={!newOptionValue.trim() || isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Options list */}
          {type.options && type.options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {type.options.map((option) => (
                <div key={option.id} className="group">
                  {editingOptionId === option.id ? (
                    <div className="flex items-center gap-1 bg-background border rounded-lg px-2 py-1">
                      <Input
                        value={editingOptionValue}
                        onChange={(e) => onEditingOptionValueChange(e.target.value)}
                        className="h-6 w-24 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveEditOption();
                          if (e.key === 'Escape') onCancelEditOption();
                        }}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={onSaveEditOption}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={onCancelEditOption}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover:bg-background transition-colors pr-1"
                    >
                      <span 
                        className="pr-2"
                        onClick={() => onStartEditOption(option.id, option.value)}
                      >
                        {option.value}
                      </span>
                      <button
                        className="ml-1 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => onDeleteOption(option.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma opção cadastrada. Adicione opções como "Azul", "Verde", "P", "M", "G", etc.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
