import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { ProductList } from '@/components/products/ProductList';
import { ProductForm } from '@/components/products/ProductForm';
import { FileImportDialog } from '@/components/import/FileImportDialog';
import { Product, useProducts } from '@/hooks/useProducts';

type View = 'list' | 'create' | 'edit';

export default function Products() {
  const [view, setView] = useState<View>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { products } = useProducts();

  // Deep link: /products?edit=<productId> opens that product in edit mode.
  // Used by the Mercado Livre "Pendências" shortcut (opens in a new tab).
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    if (editingProduct?.id === editId) return;
    const target = products.find(p => p.id === editId);
    if (target) {
      setEditingProduct(target);
      setView('edit');
    }
  }, [searchParams, products, editingProduct?.id]);

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setView('create');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setView('edit');
  };

  const clearEditParam = () => {
    if (searchParams.get('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setView('list');
    clearEditParam();
  };

  const handleSuccess = () => {
    setEditingProduct(null);
    setView('list');
    clearEditParam();
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
