import { useState, useRef } from 'react';
import { useMenus, useMenuItems, MenuItem } from '@/hooks/useMenus';
import { useCategories } from '@/hooks/useProducts';
import { useStorePages } from '@/hooks/useStorePages';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import MenuPanel from '@/components/menus/MenuPanel';
import MenuItemDialog from '@/components/menus/MenuItemDialog';

// Local item type for pending changes
interface LocalMenuItem {
  id: string;
  menu_id: string;
  label: string;
  item_type: 'category' | 'page' | 'external';
  ref_id: string | null;
  url: string | null;
  sort_order: number;
  parent_id: string | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

export default function Menus() {
  const { menus, isLoading, createMenu } = useMenus();
  const { categories } = useCategories();
  const { pages } = useStorePages();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMenuId, setDialogMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  // Callback refs for local state updates
  const onItemCreatedRef = useRef<((item: LocalMenuItem) => void) | null>(null);
  const onItemUpdatedRef = useRef<((item: LocalMenuItem) => void) | null>(null);

  // Get items for the dialog (only for existingItems reference)
  const { items: dialogMenuItems } = useMenuItems(dialogMenuId);

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

  // Open add dialog with callback
  const handleAddItem = (menuId: string, onItemCreated: (item: LocalMenuItem) => void) => {
    setDialogMenuId(menuId);
    setEditingItem(null);
    onItemCreatedRef.current = onItemCreated;
    onItemUpdatedRef.current = null;
    setDialogOpen(true);
  };

  // Open edit dialog with callback
  const handleEditItem = (item: MenuItem, onItemUpdated: (item: LocalMenuItem) => void) => {
    setDialogMenuId(item.menu_id);
    setEditingItem(item);
    onItemCreatedRef.current = null;
    onItemUpdatedRef.current = onItemUpdated;
    setDialogOpen(true);
  };

  // Submit item - now calls the callback instead of DB
  const handleSubmitItem = async (data: {
    menu_id: string;
    label: string;
    item_type: 'category' | 'page' | 'external';
    ref_id: string | null;
    url: string | null;
    sort_order: number;
    parent_id: string | null;
  }) => {
    if (editingItem && onItemUpdatedRef.current) {
      // Update existing item locally
      onItemUpdatedRef.current({
        id: editingItem.id,
        ...data,
      });
    } else if (onItemCreatedRef.current) {
      // Create new item locally with temp ID
      onItemCreatedRef.current({
        id: crypto.randomUUID(),
        ...data,
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      onItemCreatedRef.current = null;
      onItemUpdatedRef.current = null;
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
          onOpenChange={handleDialogClose}
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
