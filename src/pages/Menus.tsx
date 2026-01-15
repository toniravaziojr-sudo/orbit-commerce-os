import { useState } from 'react';
import { useMenus, useMenuItems, MenuItem } from '@/hooks/useMenus';
import { useCategories } from '@/hooks/useProducts';
import { useStorePages } from '@/hooks/useStorePages';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import MenuPanel from '@/components/menus/MenuPanel';
import MenuItemDialog from '@/components/menus/MenuItemDialog';

export default function Menus() {
  const { menus, isLoading, createMenu } = useMenus();
  const { categories } = useCategories();
  const { pages } = useStorePages();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMenuId, setDialogMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Get items for the dialog
  const { items: dialogMenuItems, createItem, updateItem } = useMenuItems(dialogMenuId);

  // Menu references
  const headerMenu = menus?.find(m => m.location === 'header');
  const footer1Menu = menus?.find(m => m.location === 'footer_1' || m.location === 'footer');
  const footer2Menu = menus?.find(m => m.location === 'footer_2');

  // Create menu helper
  const handleCreateMenu = async (location: 'header' | 'footer_1' | 'footer_2') => {
    const nameMap: Record<string, string> = {
      header: 'Menu Principal',
      footer_1: 'Menu',
      footer_2: 'Políticas',
    };
    await createMenu.mutateAsync({
      name: nameMap[location] || 'Menu',
      location,
    });
  };

  // Open add dialog
  const handleAddItem = (menuId: string) => {
    setDialogMenuId(menuId);
    setEditingItem(null);
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEditItem = (item: MenuItem) => {
    setDialogMenuId(item.menu_id);
    setEditingItem(item);
    setDialogOpen(true);
  };

  // Submit item
  const handleSubmitItem = async (data: {
    menu_id: string;
    label: string;
    item_type: 'category' | 'page' | 'external';
    ref_id: string | null;
    url: string | null;
    sort_order: number;
    parent_id: string | null;
  }) => {
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createItem.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Menus"
        description="Gerencie os menus de navegação da sua loja"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Header Menu Panel */}
        <MenuPanel
          title="Menu Header"
          location="header"
          menuId={headerMenu?.id || null}
          onCreateMenu={() => handleCreateMenu('header')}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
        />

        {/* Footer 1 Menu Panel */}
        <MenuPanel
          title="Footer 1"
          location="footer_1"
          menuId={footer1Menu?.id || null}
          onCreateMenu={() => handleCreateMenu('footer_1')}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
        />

        {/* Footer 2 Menu Panel */}
        <MenuPanel
          title="Footer 2"
          location="footer_2"
          menuId={footer2Menu?.id || null}
          onCreateMenu={() => handleCreateMenu('footer_2')}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
        />
      </div>

      {/* Shared Add/Edit Item Dialog */}
      {dialogMenuId && (
        <MenuItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          menuId={dialogMenuId}
          editingItem={editingItem}
          existingItems={dialogMenuItems || []}
          categories={categories || []}
          pages={(pages || []).map(p => ({
            id: p.id,
            title: p.title,
            menu_label: p.menu_label,
            is_published: p.is_published,
            show_in_menu: p.show_in_menu,
          }))}
          onSubmit={handleSubmitItem}
        />
      )}
    </div>
  );
}
