// =============================================
// FLOATING CART BUTTON - Quick cart popup in bottom-right corner
// Shows when user has items in cart and showFloatingCart is enabled
// =============================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { getPublicCartUrl } from '@/lib/publicUrls';
import { cn } from '@/lib/utils';

interface FloatingCartButtonProps {
  tenantSlug: string;
  isPreview?: boolean;
  isEditing?: boolean;
}

/**
 * Floating cart button that appears in bottom-right corner
 * Only visible when:
 * 1. showFloatingCart setting is true (controlled by parent)
 * 2. Cart has at least 1 item
 */
export function FloatingCartButton({
  tenantSlug,
  isPreview = false,
  isEditing = false,
}: FloatingCartButtonProps) {
  const navigate = useNavigate();
  const { totalItems } = useCart();

  // Don't render if cart is empty
  if (totalItems === 0) return null;

  // Don't navigate in editing mode
  const handleClick = () => {
    if (isEditing) return;
    const cartUrl = getPublicCartUrl(tenantSlug, isPreview);
    navigate(cartUrl);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isEditing}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isEditing && 'cursor-not-allowed opacity-70'
      )}
      aria-label={`Carrinho com ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`}
    >
      <ShoppingCart className="w-5 h-5" />
      <span className="font-semibold">{totalItems}</span>
    </button>
  );
}
