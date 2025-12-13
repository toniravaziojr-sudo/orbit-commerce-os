import { useState } from 'react';
import { useMenus, useMenuItems } from '@/hooks/useMenus';
import { useCategories } from '@/hooks/useProducts';
import { useStorePages } from '@/hooks/useStorePages';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical, Menu as MenuIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Menus() {
  const { menus, isLoading, createMenu } = useMenus();
  const { categories } = useCategories();
  const { pages } = useStorePages();
  
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    label: '',
    item_type: 'category' as 'category' | 'page' | 'external',
    ref_id: '',
    url: '',
  });

  const { items, createItem, updateItem, deleteItem, reorderItems } = useMenuItems(selectedMenuId);

  const selectedMenu = menus?.find(m => m.id === selectedMenuId);

  const handleCreateMenu = async (location: 'header' | 'footer') => {
    await createMenu.mutateAsync({
      name: location === 'header' ? 'Menu Principal' : 'Menu Rodapé',
      location,
    });
  };

  const resetItemForm = () => {
    setItemForm({ label: '', item_type: 'category', ref_id: '', url: '' });
    setEditingItem(null);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      label: item.label,
      item_type: item.item_type,
      ref_id: item.ref_id || '',
      url: item.url || '',
    });
    setIsItemDialogOpen(true);
  };

  const handleSubmitItem = async () => {
    const data = {
      menu_id: selectedMenuId!,
      label: itemForm.label,
      item_type: itemForm.item_type,
      ref_id: itemForm.item_type !== 'external' ? itemForm.ref_id || null : null,
      url: itemForm.item_type === 'external' ? itemForm.url : null,
      sort_order: editingItem?.sort_order ?? (items?.length || 0),
      parent_id: null,
    };

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createItem.mutateAsync(data);
    }
    setIsItemDialogOpen(false);
    resetItemForm();
  };

  const handleDeleteItem = async () => {
    if (deleteItemId) {
      await deleteItem.mutateAsync(deleteItemId);
      setDeleteItemId(null);
    }
  };

  const handleMoveItem = async (index: number, direction: 'up' | 'down') => {
    if (!items) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    await reorderItems.mutateAsync(newItems.map(i => i.id));
  };

  const headerMenu = menus?.find(m => m.location === 'header');
  const footerMenu = menus?.find(m => m.location === 'footer');

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Menus"
        description="Gerencie os menus de navegação da sua loja"
      />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Header Menu */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MenuIcon className="h-5 w-5" />
              Menu Header
            </CardTitle>
            {headerMenu && (
              <Badge variant="outline">Ativo</Badge>
            )}
          </CardHeader>
          <CardContent>
            {headerMenu ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedMenuId(headerMenu.id)}
              >
                Editar Itens
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={() => handleCreateMenu('header')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Menu Header
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Footer Menu */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MenuIcon className="h-5 w-5" />
              Menu Footer
            </CardTitle>
            {footerMenu && (
              <Badge variant="outline">Ativo</Badge>
            )}
          </CardHeader>
          <CardContent>
            {footerMenu ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedMenuId(footerMenu.id)}
              >
                Editar Itens
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={() => handleCreateMenu('footer')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Menu Footer
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Menu Items Editor */}
      {selectedMenu && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Itens do {selectedMenu.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Arraste para reordenar ou use as setas
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedMenuId(null)}>
                Fechar
              </Button>
              <Button onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items && items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.item_type === 'category' && 'Categoria'}
                        {item.item_type === 'page' && 'Página'}
                        {item.item_type === 'external' && item.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === items.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteItemId(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={(open) => { setIsItemDialogOpen(open); if (!open) resetItemForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo</Label>
              <Select 
                value={itemForm.item_type} 
                onValueChange={(v: 'category' | 'page' | 'external') => setItemForm({ ...itemForm, item_type: v, ref_id: '', url: '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="page">Página Institucional</SelectItem>
                  <SelectItem value="external">Link Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rótulo</Label>
              <Input 
                value={itemForm.label} 
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                placeholder="Texto exibido no menu"
              />
            </div>

            {itemForm.item_type === 'category' && (
              <div>
                <Label>Categoria</Label>
                <Select value={itemForm.ref_id} onValueChange={(v) => setItemForm({ ...itemForm, ref_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {itemForm.item_type === 'page' && (
              <div>
                <Label>Página</Label>
                <Select value={itemForm.ref_id} onValueChange={(v) => setItemForm({ ...itemForm, ref_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma página" /></SelectTrigger>
                  <SelectContent>
                    {pages?.filter(p => p.is_published).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {itemForm.item_type === 'external' && (
              <div>
                <Label>URL</Label>
                <Input 
                  value={itemForm.url} 
                  onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}

            <Button 
              onClick={handleSubmitItem} 
              disabled={!itemForm.label || (itemForm.item_type !== 'external' && !itemForm.ref_id) || (itemForm.item_type === 'external' && !itemForm.url)}
              className="w-full"
            >
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
