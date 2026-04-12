import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { CheckoutLinkList } from '@/components/checkout-links/CheckoutLinkList';
import { CheckoutLinkForm } from '@/components/checkout-links/CheckoutLinkForm';

type View = 'list' | 'create' | 'edit';

interface CheckoutLink {
  id: string;
  name: string;
  slug: string;
  product_id: string;
  quantity: number;
  coupon_code: string | null;
  shipping_override: number | null;
  price_override: number | null;
  additional_products: any[];
  is_active: boolean;
  expires_at: string | null;
  click_count: number;
  conversion_count: number;
}

export default function CheckoutLinks() {
  const [view, setView] = useState<View>('list');
  const [editingLink, setEditingLink] = useState<CheckoutLink | null>(null);

  const handleCreate = () => {
    setEditingLink(null);
    setView('create');
  };

  const handleEdit = (link: CheckoutLink) => {
    setEditingLink(link);
    setView('edit');
  };

  const handleCancel = () => {
    setEditingLink(null);
    setView('list');
  };

  const handleSuccess = () => {
    setEditingLink(null);
    setView('list');
  };

  return (
    <div className="space-y-6 animate-fade-in min-h-full">
      {view === 'list' && (
        <>
          <PageHeader
            title="Link Checkout"
            description="Crie links personalizados para checkout com produtos, cupons e condições especiais"
          />
          <CheckoutLinkList
            onCreateLink={handleCreate}
            onEditLink={handleEdit}
          />
        </>
      )}

      {(view === 'create' || view === 'edit') && (
        <CheckoutLinkForm
          link={editingLink}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
