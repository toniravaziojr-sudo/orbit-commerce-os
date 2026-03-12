import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MenuItem, MenuItemType } from '@/hooks/useMenus';

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
    item_type: MenuItemType;
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
    item_type: 'category' as MenuItemType,
    ref_id: '',
    url: '',
    parent_id: '' as string | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableCategories = useMemo(
    () => categories.filter((category) => Boolean(category.id)),
    [categories]
  );

  const availablePages = useMemo(
    () => pages.filter((page) => page.is_published !== false && Boolean(page.id)),
    [pages]
  );

  const categoryIds = useMemo(
    () => new Set(availableCategories.map((category) => category.id)),
    [availableCategories]
  );

  const pageIds = useMemo(
    () => new Set(availablePages.map((page) => page.id)),
    [availablePages]
  );

  // Reset form when dialog opens/closes or editing item changes
  useEffect(() => {
    if (!open) return;

    if (editingItem) {
      const nextItemType = editingItem.item_type as MenuItemType;
      const hasValidPageRef = nextItemType === 'page' ? pageIds.has(editingItem.ref_id || '') : true;
      const hasValidCategoryRef = nextItemType === 'category' ? categoryIds.has(editingItem.ref_id || '') : true;

      setForm({
        label: editingItem.label,
        item_type: nextItemType,
        ref_id: hasValidPageRef && hasValidCategoryRef ? editingItem.ref_id || '' : '',
        url: editingItem.url || '',
        parent_id: editingItem.parent_id || null,
      });
      return;
    }

    setForm({
      label: '',
      item_type: 'category',
      ref_id: '',
      url: '',
      parent_id: null,
    });
  }, [open, editingItem, categoryIds, pageIds]);

  // Parent options: root items (no parent) that are not self
  // Also exclude any descendants of the current item to prevent circular references
  const getDescendantIds = (itemId: string): string[] => {
    const descendants: string[] = [];
    const children = existingItems.filter(i => i.parent_id === itemId);
    children.forEach(child => {
      descendants.push(child.id);
      descendants.push(...getDescendantIds(child.id));
    });
    return descendants;
  };
  
  const descendantIds = editingItem ? getDescendantIds(editingItem.id) : [];
  // Allow any item that is not the current item and not a descendant of current item
  // For simplicity, limit to root items only (items without parent_id) to maintain 2-level max depth
  const parentOptions = existingItems.filter(i => 
    !i.parent_id && // Only root items can be parents
    i.id !== editingItem?.id && // Not self
    !descendantIds.includes(i.id) // Not a descendant
  );

  const hasInvalidSelectedCategory = form.item_type === 'category' && !!form.ref_id && !categoryIds.has(form.ref_id);
  const hasInvalidSelectedPage = form.item_type === 'page' && !!form.ref_id && !pageIds.has(form.ref_id);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const normalizedLabel = form.label.trim();
      const normalizedUrl = form.url.trim();

      // Para blog e tracking, não precisa de ref_id nem url externa
      const needsRefId = form.item_type === 'category' || form.item_type === 'page';
      const needsUrl = form.item_type === 'external';

      const selectedRefId = needsRefId
        ? form.item_type === 'category'
          ? (categoryIds.has(form.ref_id) ? form.ref_id : '')
          : (pageIds.has(form.ref_id) ? form.ref_id : '')
        : '';

      await onSubmit({
        menu_id: menuId,
        label: normalizedLabel,
        item_type: form.item_type,
        ref_id: needsRefId ? selectedRefId || null : null,
        url: needsUrl ? normalizedUrl : null,
        sort_order: editingItem?.sort_order ?? existingItems.length,
        parent_id: form.parent_id || null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validação: blog e tracking só precisam do label
  const isValid = Boolean(form.label.trim()) && (
    (form.item_type === 'category' && !!form.ref_id && categoryIds.has(form.ref_id)) ||
    (form.item_type === 'page' && !!form.ref_id && pageIds.has(form.ref_id)) ||
    (form.item_type === 'external' && !!form.url.trim()) ||
    form.item_type === 'blog' ||
    form.item_type === 'tracking'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Item do Menu' : 'Adicionar Item ao Menu'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Tipo de item */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Link</Label>
            <Select
              value={form.item_type}
              onValueChange={(v: MenuItemType) => {
                // Auto-preencher label para tipos especiais
                let newLabel = form.label;
                if (v === 'blog' && !form.label) newLabel = 'Blog';
                if (v === 'tracking' && !form.label) newLabel = 'Rastrear Pedido';
                setForm({ ...form, item_type: v, ref_id: '', url: '', label: newLabel });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="page">Página Institucional</SelectItem>
                <SelectItem value="blog">Página do Blog</SelectItem>
                <SelectItem value="tracking">Página de Rastreio</SelectItem>
                <SelectItem value="external">Link Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rótulo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rótulo *</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Texto exibido no menu"
            />
            <p className="text-xs text-muted-foreground">Este texto aparecerá no menu de navegação</p>
          </div>

          {/* Item pai (opcional) */}
          {parentOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Item Pai (opcional)</Label>
              <Select
                value={form.parent_id || '_none'}
                onValueChange={(v) => setForm({ ...form, parent_id: v === '_none' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (item raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (item raiz)</SelectItem>
                  {parentOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ou arraste o item para dentro de outro após criar
              </p>
            </div>
          )}

          {/* Seletor de categoria */}
          {form.item_type === 'category' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoria *</Label>
              <Select
                value={form.ref_id}
                onValueChange={(v) => {
                  const category = availableCategories.find(c => c.id === v);
                  setForm({
                    ...form,
                    ref_id: v,
                    label: form.label || category?.name || '',
                  });
                }}
              >
                <SelectTrigger className={!form.ref_id ? 'text-muted-foreground' : ''}>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhuma categoria disponível
                    </div>
                  ) : (
                    availableCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {hasInvalidSelectedCategory && (
                <p className="text-xs text-destructive">
                  A categoria vinculada foi removida. Selecione outra para salvar.
                </p>
              )}
            </div>
          )}

          {/* Seletor de página */}
          {form.item_type === 'page' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Página *</Label>
              <Select
                value={form.ref_id}
                onValueChange={(v) => {
                  const page = availablePages.find(p => p.id === v);
                  setForm({
                    ...form,
                    ref_id: v,
                    label: form.label || page?.menu_label || page?.title || '',
                  });
                }}
              >
                <SelectTrigger className={!form.ref_id ? 'text-muted-foreground' : ''}>
                  <SelectValue placeholder="Selecione uma página" />
                </SelectTrigger>
                <SelectContent>
                  {availablePages.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhuma página publicada
                    </div>
                  ) : (
                    availablePages.map(page => (
                      <SelectItem key={page.id} value={page.id}>
                        <div className="flex items-center gap-2">
                          <span>{page.menu_label || page.title}</span>
                          {page.show_in_menu && (
                            <span className="text-xs text-muted-foreground">✓</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {hasInvalidSelectedPage && (
                <p className="text-xs text-destructive">
                  A página vinculada foi removida ou não está publicada. Selecione outra para salvar.
                </p>
              )}
            </div>
          )}

          {/* URL para link externo */}
          {form.item_type === 'external' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://exemplo.com"
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Use URLs completas começando com https://
              </p>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              type="button"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
