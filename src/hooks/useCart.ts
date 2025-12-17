import { useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image_url?: string;
}

const CART_STORAGE_KEY = 'storefront_cart';

export function useCart(tenantSlug: string) {
  const storageKey = `${CART_STORAGE_KEY}_${tenantSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
    setIsLoading(false);
  }, [storageKey]);

  // Save cart to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, storageKey, isLoading]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.product_id === item.product_id && i.variant_id === item.variant_id
      );

      if (existingIndex >= 0) {
        // Item exists - SET quantity (not add) to match user selection
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: item.quantity,
        };
        return updated;
      }

      return [...prev, { ...item, id: crypto.randomUUID() }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) {
        return prev.filter(i => i.id !== itemId);
      }
      return prev.map(i => (i.id === itemId ? { ...i, quantity } : i));
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    isLoading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    totalItems,
  };
}
