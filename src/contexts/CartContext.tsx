import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

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

export interface ShippingOption {
  code?: string;           // Service code from provider
  carrier?: string;        // Carrier name (e.g., "Correios", "Jadlog")
  sourceProvider?: string; // Source of quote: frenet, correios, loggi
  price: number;
  deliveryDays: number;
  label: string;
  isFree: boolean;
}

export interface CartShipping {
  cep: string;
  options: ShippingOption[];
  selected: ShippingOption | null;
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  addItem: (item: Omit<CartItem, 'id'>, onAdded?: (item: CartItem) => void) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
  // Shipping
  shipping: CartShipping;
  setShippingCep: (cep: string) => void;
  setShippingOptions: (options: ShippingOption[]) => void;
  selectShipping: (option: ShippingOption | null) => void;
  total: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = 'storefront_cart';

interface CartProviderProps {
  children: ReactNode;
  tenantSlug: string;
}

export function CartProvider({ children, tenantSlug }: CartProviderProps) {
  const storageKey = `${CART_STORAGE_KEY}_${tenantSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [shipping, setShipping] = useState<CartShipping>({
    cep: '',
    options: [],
    selected: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const hasHydrated = useRef(false);
  const currentStorageKey = useRef(storageKey);

  // Reset hydration flag and reload when storageKey changes
  useEffect(() => {
    if (currentStorageKey.current !== storageKey) {
      hasHydrated.current = false;
      currentStorageKey.current = storageKey;
      setIsLoading(true);
    }
    
    // Hydrate cart from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.items)) {
            setItems(parsed.items);
          } else if (Array.isArray(parsed)) {
            // Legacy format - just items array
            setItems(parsed);
          }
          if (parsed.shipping) {
            setShipping(parsed.shipping);
          }
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
    hasHydrated.current = true;
    setIsLoading(false);
  }, [storageKey]);

  // Save cart to localStorage - only after hydration complete
  useEffect(() => {
    if (!isLoading && hasHydrated.current) {
      localStorage.setItem(storageKey, JSON.stringify({ items, shipping }));
    }
  }, [items, shipping, storageKey, isLoading]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>, onAdded?: (item: CartItem) => void) => {
    if (!item.product_id) {
      console.error('Cannot add item without product_id');
      return;
    }
    
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.product_id === item.product_id && i.variant_id === item.variant_id
      );

      let newItems: CartItem[];
      let addedItem: CartItem;
      
      if (existingIndex >= 0) {
        // Item exists - ADD quantity to existing (increment)
        newItems = [...prev];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + item.quantity,
        };
        addedItem = newItems[existingIndex];
      } else {
        addedItem = { ...item, id: crypto.randomUUID() };
        newItems = [...prev, addedItem];
      }

      // Call callback with added item for tracking
      if (onAdded) {
        setTimeout(() => onAdded(addedItem), 0);
      }

      return newItems;
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
    setShipping({ cep: '', options: [], selected: null });
  }, []);

  // Shipping functions
  const setShippingCep = useCallback((cep: string) => {
    setShipping(prev => ({ ...prev, cep }));
  }, []);

  const setShippingOptions = useCallback((options: ShippingOption[]) => {
    setShipping(prev => ({ ...prev, options, selected: options[0] || null }));
  }, []);

  const selectShipping = useCallback((option: ShippingOption | null) => {
    setShipping(prev => ({ ...prev, selected: option }));
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = subtotal + (shipping.selected?.price || 0);

  return (
    <CartContext.Provider value={{
      items,
      isLoading,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      subtotal,
      totalItems,
      shipping,
      setShippingCep,
      setShippingOptions,
      selectShipping,
      total,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// Default empty cart for editor/preview contexts without provider
const emptyCart: CartContextType = {
  items: [],
  isLoading: false,
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
  subtotal: 0,
  totalItems: 0,
  shipping: { cep: '', options: [], selected: null },
  setShippingCep: () => {},
  setShippingOptions: () => {},
  selectShipping: () => {},
  total: 0,
};

export function useCart() {
  const context = useContext(CartContext);
  // Return empty cart if outside provider (e.g., in Builder editor)
  if (!context) {
    return emptyCart;
  }
  return context;
}
