import { useState } from 'react';
import { useCategories, Category } from '@/hooks/useProducts';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FolderTree, Package, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { CategoryProductsManager } from '@/components/categories/CategoryProductsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const emptyFormData = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  is_active: true,
  sort_order: 0,
  seo_title: '',
  seo_description: '',
  banner_desktop_url: '',
  banner_mobile_url: '',
};

export default function Categories() {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [activeTab, setActiveTab] = useState<'details' | 'products'>('details');

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
      parent_id: null, // Categories are flat - hierarchy is managed in menus
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
      await deleteCategory.mutateAsync(deleteId);
      setDeleteId(null);
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
        description="Gerencie as categorias da sua loja. A hierarquia de navegação é definida nos Menus."
        actions={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Categoria
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderTree className="h-5 w-5" />
                Lista de Categorias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma categoria cadastrada
                </p>
              ) : (
                categories?.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                      editingCategory?.id === category.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => handleEdit(category)}
                  >
                    <div className="flex items-center gap-3">
                      {category.image_url ? (
                        <img 
                          src={category.image_url} 
                          alt={category.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <FolderTree className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-xs text-muted-foreground">/c/{category.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(category);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(category.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              
              {/* Helper text */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-xs text-muted-foreground">
                  <strong>Dica:</strong> Categorias são entidades simples. A hierarquia de navegação (menus com submenus) é configurada em <strong>Menus</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
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
