import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { ProductList } from '@/components/products/ProductList';
import { ProductForm } from '@/components/products/ProductForm';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { Product } from '@/hooks/useProducts';

type View = 'list' | 'create' | 'edit';

export default function Products() {
  const [view, setView] = useState<View>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // ... keep existing code (handlers)
  const handleCreateProduct = () => {
    setEditingProduct(null);
    setView('create');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setView('edit');
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setView('list');
  };

  const handleSuccess = () => {
    setEditingProduct(null);
    setView('list');
  };

  return (
    <div className="space-y-6 animate-fade-in min-h-full">
      {view === 'list' && (
        <>
          <PageHeader
            title="Produtos"
            description="Catálogo completo com variantes, preços e controle de estoque"
          />
          <ProductList
            onCreateProduct={handleCreateProduct}
            onEditProduct={handleEditProduct}
            onImport={() => setImportOpen(true)}
          />
        </>
      )}

      {(view === 'create' || view === 'edit') && (
        <ProductForm
          product={editingProduct}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
        />
      )}

      <FileImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        module="products"
      />
    </div>
  );
}