import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MenuItem } from '@/hooks/useMenus';

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  editingItem: MenuItem | null;
  existingItems: MenuItem[];
  categories: Array<{ id: string; name: string }>;
  pages: Array<{ id: string; title: string; menu_label?: string; is_published?: boolean; show_in_menu?: boolean }>;
  onSubmit: (data: {
    menu_id: string;
    label: string;
    item_type: 'category' | 'page' | 'external';
    ref_id: string | null;
    url: string | null;
    sort_order: number;
    parent_id: string | null;
  }) => Promise<void>;
}

export default function MenuItemDialog({
  open,
  onOpenChange,
  menuId,
  editingItem,
  existingItems,
  categories,
  pages,
  onSubmit,
}: MenuItemDialogProps) {
  const [form, setForm] = useState({
    label: '',
    item_type: 'category' as 'category' | 'page' | 'external',
    ref_id: '',
    url: '',
    parent_id: '' as string | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes or editing item changes
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setForm({
          label: editingItem.label,
          item_type: editingItem.item_type as 'category' | 'page' | 'external',
          ref_id: editingItem.ref_id || '',
          url: editingItem.url || '',
          parent_id: editingItem.parent_id || null,
        });
      } else {
        setForm({
          label: '',
          item_type: 'category',
          ref_id: '',
          url: '',
          parent_id: null,
        });
      }
    }
  }, [open, editingItem]);

  // Parent options: only root items (no parent) and not self
  const parentOptions = existingItems.filter(i => !i.parent_id && i.id !== editingItem?.id);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        menu_id: menuId,
        label: form.label,
        item_type: form.item_type,
        ref_id: form.item_type !== 'external' ? form.ref_id || null : null,
        url: form.item_type === 'external' ? form.url : null,
        sort_order: editingItem?.sort_order ?? existingItems.length,
        parent_id: form.parent_id || null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = form.label && 
    ((form.item_type !== 'external' && form.ref_id) || 
     (form.item_type === 'external' && form.url));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.item_type}
              onValueChange={(v: 'category' | 'page' | 'external') =>
                setForm({ ...form, item_type: v, ref_id: '', url: '' })
              }
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
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Texto exibido no menu"
            />
          </div>

          {parentOptions.length > 0 && (
            <div>
              <Label>Item Pai (opcional)</Label>
              <Select
                value={form.parent_id || '_none'}
                onValueChange={(v) => setForm({ ...form, parent_id: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum (item raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (item raiz)</SelectItem>
                  {parentOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Ou arraste o item para dentro de outro após criar
              </p>
            </div>
          )}

          {form.item_type === 'category' && (
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.ref_id}
                onValueChange={(v) => {
                  const cat = categories.find(c => c.id === v);
                  setForm({
                    ...form,
                    ref_id: v,
                    label: form.label || cat?.name || '',
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.item_type === 'page' && (
            <div>
              <Label>Página</Label>
              <Select
                value={form.ref_id}
                onValueChange={(v) => {
                  const page = pages.find(p => p.id === v);
                  setForm({
                    ...form,
                    ref_id: v,
                    label: form.label || page?.menu_label || page?.title || '',
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma página" /></SelectTrigger>
                <SelectContent>
                  {pages.filter(p => p.is_published !== false).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.menu_label || p.title}</span>
                        {p.show_in_menu && (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.item_type === 'external' && (
            <div>
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Salvando...' : editingItem ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
