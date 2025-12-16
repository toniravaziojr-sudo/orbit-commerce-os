import { useState, useMemo } from 'react';
import { useCategories, Category } from '@/hooks/useProducts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FolderTree, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryTree } from '@/components/categories/CategoryTree';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { CategoryProductsManager } from '@/components/categories/CategoryProductsManager';
import { toast } from 'sonner';

const emptyFormData = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  parent_id: '',
  is_active: true,
  sort_order: 0,
  seo_title: '',
  seo_description: '',
  banner_desktop_url: '',
  banner_mobile_url: '',
};

export default function Categories() {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory, reorderCategories } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [activeTab, setActiveTab] = useState<'details' | 'products'>('details');

  // All categories can be parents (for multiple levels)
  const parentCategories = useMemo(() => categories || [], [categories]);

  const resetForm = () => {
    setFormData(emptyFormData);
    setEditingCategory(null);
    setShowForm(false);
    setActiveTab('details');
  };

  const handleCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      image_url: category.image_url || '',
      parent_id: category.parent_id || '',
      is_active: category.is_active ?? true,
      sort_order: category.sort_order || 0,
      seo_title: category.seo_title || '',
      seo_description: category.seo_description || '',
      banner_desktop_url: (category as any).banner_desktop_url || '',
      banner_mobile_url: (category as any).banner_mobile_url || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const data = {
      ...formData,
      parent_id: formData.parent_id || null,
      slug: formData.slug || formData.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    };

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({ id: editingCategory.id, ...data });
      } else {
        await createCategory.mutateAsync(data);
      }
      resetForm();
    } catch (error) {
      // Error toast is handled by the hook
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      // Check if category has children
      const hasChildren = categories?.some(c => c.parent_id === deleteId);
      if (hasChildren) {
        toast.error('Não é possível excluir uma categoria com subcategorias. Remova ou mova as subcategorias primeiro.');
        setDeleteId(null);
        return;
      }
      await deleteCategory.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleMoveCategory = async (categoryId: string, newParentId: string | null, newPosition: number) => {
    try {
      // Get siblings at the target level
      const siblings = categories?.filter(c => c.parent_id === newParentId && c.id !== categoryId) || [];
      
      // Insert the moved category at the new position
      const orderedIds = [...siblings.map(c => c.id)];
      orderedIds.splice(newPosition, 0, categoryId);

      await reorderCategories.mutateAsync({
        categoryId,
        newParentId,
        orderedSiblingIds: orderedIds,
      });
    } catch (error) {
      toast.error('Erro ao mover categoria');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Categorias"
        description="Organize suas categorias arrastando para reordenar ou criar hierarquias"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Categoria
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Tree with Drag & Drop */}
        <div className="lg:col-span-1">
          <CategoryTree
            categories={categories || []}
            onEdit={handleEdit}
            onDelete={setDeleteId}
            onMoveCategory={handleMoveCategory}
          />
        </div>

        {/* Category Form / Products Manager */}
        <div className="lg:col-span-2">
          {showForm ? (
            editingCategory ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'products')}>
                <TabsList className="mb-4">
                  <TabsTrigger value="details" className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Detalhes
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produtos
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <CategoryForm
                    formData={formData}
                    onChange={setFormData}
                    onSubmit={handleSubmit}
                    onClose={resetForm}
                    isEditing={!!editingCategory}
                    parentCategories={parentCategories}
                    editingCategoryId={editingCategory?.id}
                    isLoading={createCategory.isPending || updateCategory.isPending}
                  />
                </TabsContent>
                <TabsContent value="products">
                  <CategoryProductsManager
                    categoryId={editingCategory.id}
                    categoryName={editingCategory.name}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <CategoryForm
                formData={formData}
                onChange={setFormData}
                onSubmit={handleSubmit}
                onClose={resetForm}
                isEditing={false}
                parentCategories={parentCategories}
                editingCategoryId={undefined}
                isLoading={createCategory.isPending}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <FolderTree className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">
                  Selecione uma categoria para editar
                </p>
                <p className="text-sm text-muted-foreground">
                  ou clique em "Nova Categoria" para criar uma nova
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os produtos vinculados a esta categoria não serão excluídos,
              apenas o vínculo será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
