import { useState, useEffect } from 'react';
import { useProductBadges, useBadgeAssignments, ProductBadge, BadgeShape, BadgePosition, CreateBadgeInput } from '@/hooks/useProductBadges';
import { ProductMultiSelect } from '@/components/builder/ProductMultiSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Trash2, 
  Tag,
  Edit,
  ToggleLeft,
  ToggleRight,
  Package,
} from 'lucide-react';

const shapeLabels: Record<BadgeShape, string> = {
  square: 'Quadrado',
  rectangular: 'Retangular',
  circular: 'Circular',
  pill: 'Pílula',
};

const positionLabels: Record<BadgePosition, string> = {
  left: 'Esquerda',
  center: 'Centro',
  right: 'Direita',
};

interface BadgeFormData {
  name: string;
  background_color: string;
  text_color: string;
  shape: BadgeShape;
  position: BadgePosition;
  is_active: boolean;
}

const defaultFormData: BadgeFormData = {
  name: '',
  background_color: '#F59E0B',
  text_color: '#FFFFFF',
  shape: 'rectangular',
  position: 'left',
  is_active: true,
};

// Preview component for the badge
function BadgePreview({ data }: { data: BadgeFormData }) {
  const getShapeClasses = (shape: BadgeShape): string => {
    switch (shape) {
      case 'square':
        return 'px-2 py-1 rounded-sm';
      case 'rectangular':
        return 'px-3 py-1 rounded';
      case 'circular':
        return 'px-2 py-1 rounded-full min-w-[2rem] text-center';
      case 'pill':
        return 'px-4 py-1 rounded-full';
      default:
        return 'px-3 py-1 rounded';
    }
  };

  const getPositionClasses = (position: BadgePosition): string => {
    switch (position) {
      case 'left':
        return 'justify-start';
      case 'center':
        return 'justify-center';
      case 'right':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  };

  return (
    <div className={`flex ${getPositionClasses(data.position)} p-4 border rounded-lg bg-muted/50`}>
      <span
        className={`inline-flex items-center text-xs font-semibold ${getShapeClasses(data.shape)}`}
        style={{
          backgroundColor: data.background_color,
          color: data.text_color,
        }}
      >
        {data.name || 'Selo'}
      </span>
    </div>
  );
}

export function BadgesContent() {
  const { badges, isLoading, createBadge, updateBadge, deleteBadge, toggleBadge } = useProductBadges();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<ProductBadge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<BadgeFormData>(defaultFormData);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Fetch badge assignments when editing
  const { assignedProductIds, isLoading: isLoadingAssignments, updateAssignments } = useBadgeAssignments(editingBadge?.id);

  // Sync selected products when editing badge loads
  useEffect(() => {
    if (editingBadge && assignedProductIds.length >= 0) {
      setSelectedProducts(assignedProductIds);
    }
  }, [editingBadge, assignedProductIds]);

  const openCreateDialog = () => {
    setEditingBadge(null);
    setFormData(defaultFormData);
    setSelectedProducts([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (badge: ProductBadge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      background_color: badge.background_color,
      text_color: badge.text_color,
      shape: badge.shape as BadgeShape,
      position: badge.position as BadgePosition,
      is_active: badge.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const input: CreateBadgeInput = {
      name: formData.name,
      background_color: formData.background_color,
      text_color: formData.text_color,
      shape: formData.shape,
      position: formData.position,
      is_active: formData.is_active,
    };

    if (editingBadge) {
      await updateBadge.mutateAsync({ id: editingBadge.id, ...input });
      // Update product assignments
      await updateAssignments.mutateAsync({ badgeId: editingBadge.id, productIds: selectedProducts });
    } else {
      const newBadge = await createBadge.mutateAsync(input);
      // Create product assignments for new badge
      if (selectedProducts.length > 0 && newBadge?.id) {
        await updateAssignments.mutateAsync({ badgeId: newBadge.id, productIds: selectedProducts });
      }
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteBadge.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleToggle = async (badge: ProductBadge) => {
    await toggleBadge.mutateAsync({ id: badge.id, is_active: !badge.is_active });
  };

  const getShapeClasses = (shape: BadgeShape): string => {
    switch (shape) {
      case 'square':
        return 'px-2 py-0.5 rounded-sm';
      case 'rectangular':
        return 'px-2 py-0.5 rounded';
      case 'circular':
        return 'px-2 py-0.5 rounded-full';
      case 'pill':
        return 'px-3 py-0.5 rounded-full';
      default:
        return 'px-2 py-0.5 rounded';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Selos
              </CardTitle>
              <CardDescription>
                Crie selos personalizados para destacar seus produtos
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Selo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : badges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum selo cadastrado</p>
              <p className="text-sm">Crie selos para destacar seus produtos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {badges.map((badge) => (
                <Card key={badge.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(badge)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {badge.is_active ? (
                          <ToggleRight className="h-6 w-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center text-xs font-semibold ${getShapeClasses(badge.shape as BadgeShape)}`}
                          style={{
                            backgroundColor: badge.background_color,
                            color: badge.text_color,
                          }}
                        >
                          {badge.name}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{badge.name}</span>
                            {!badge.is_active && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{shapeLabels[badge.shape as BadgeShape]}</span>
                            <span>•</span>
                            <span>{positionLabels[badge.position as BadgePosition]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(badge)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(badge.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg sm:max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingBadge ? 'Editar Selo' : 'Novo Selo'}
            </DialogTitle>
            <DialogDescription>
              Configure a aparência do selo e selecione os produtos
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
            <div className="space-y-5 py-2">
              {/* Preview */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Prévia</Label>
                <BadgePreview data={formData} />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Nome do selo *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Promoção, Novo, -30%"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo 20 caracteres
                </p>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cor de fundo</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.background_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                      className="w-10 h-10 rounded border cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={formData.background_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                      className="flex-1"
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor do texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                      className="w-10 h-10 rounded border cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))}
                      className="flex-1"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>

              {/* Shape and Position in same row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Formato</Label>
                  <Select
                    value={formData.shape}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, shape: v as BadgeShape }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(shapeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Posição</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, position: v as BadgePosition }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(positionLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
                />
                <Label>Selo ativo</Label>
              </div>

              {/* Product Selection */}
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4" />
                  Produtos vinculados
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Selecione os produtos que exibirão este selo
                </p>
                {isLoadingAssignments && editingBadge ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Carregando produtos...
                  </div>
                ) : (
                  <ProductMultiSelect
                    value={selectedProducts}
                    onChange={setSelectedProducts}
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name.trim() || createBadge.isPending || updateBadge.isPending || updateAssignments.isPending}
            >
              {createBadge.isPending || updateBadge.isPending || updateAssignments.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir selo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O selo será removido de todos os produtos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
