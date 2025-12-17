// =============================================
// ORDER DRAFT - Checkout state persistence
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CartItem, ShippingOption } from '@/contexts/CartContext';
import { CartTotals, calculateCartTotals } from '@/lib/cartTotals';

export interface OrderDraftCustomer {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement: string;
  shippingNeighborhood: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
}

export interface OrderDraft {
  // Cart snapshot
  items: CartItem[];
  // Shipping snapshot
  shipping: {
    cep: string;
    selected: ShippingOption | null;
  };
  // Customer form data
  customer: OrderDraftCustomer;
  // Calculated totals
  totals: CartTotals;
  // Payment state
  paymentMethod: string | null;
  // Timestamp
  updatedAt: number;
}

const DRAFT_STORAGE_KEY = 'orderDraft';

const emptyCustomer: OrderDraftCustomer = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  shippingStreet: '',
  shippingNumber: '',
  shippingComplement: '',
  shippingNeighborhood: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
};

const emptyTotals: CartTotals = {
  subtotal: 0,
  shippingTotal: 0,
  discountTotal: 0,
  grandTotal: 0,
  itemCount: 0,
  totalItems: 0,
};

function createEmptyDraft(): OrderDraft {
  return {
    items: [],
    shipping: { cep: '', selected: null },
    customer: emptyCustomer,
    totals: emptyTotals,
    paymentMethod: null,
    updatedAt: Date.now(),
  };
}

export function useOrderDraft() {
  const { tenantSlug } = useParams();
  const storageKey = `${DRAFT_STORAGE_KEY}:${tenantSlug || 'default'}`;
  
  const [draft, setDraft] = useState<OrderDraft>(createEmptyDraft);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<OrderDraft>;
        
        // Validate and merge with defaults
        setDraft({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          shipping: {
            cep: parsed.shipping?.cep || '',
            selected: parsed.shipping?.selected || null,
          },
          customer: { ...emptyCustomer, ...parsed.customer },
          totals: { ...emptyTotals, ...parsed.totals },
          paymentMethod: parsed.paymentMethod || null,
          updatedAt: parsed.updatedAt || Date.now(),
        });
      }
    } catch (error) {
      console.error('[OrderDraft] Error loading draft:', error);
    }
    setIsHydrated(true);
  }, [storageKey]);

  // Persist to localStorage on changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) {
      console.error('[OrderDraft] Error saving draft:', error);
    }
  }, [draft, storageKey, isHydrated]);

  // Update cart snapshot
  const updateCartSnapshot = useCallback((
    items: CartItem[],
    shipping: { cep: string; selected: ShippingOption | null }
  ) => {
    setDraft(prev => {
      const totals = calculateCartTotals({
        items,
        selectedShipping: shipping.selected,
        discountAmount: 0,
      });
      
      return {
        ...prev,
        items,
        shipping,
        totals,
        updatedAt: Date.now(),
      };
    });
  }, []);

  // Update customer data
  const updateCustomer = useCallback((data: Partial<OrderDraftCustomer>) => {
    setDraft(prev => ({
      ...prev,
      customer: { ...prev.customer, ...data },
      updatedAt: Date.now(),
    }));
  }, []);

  // Update payment method
  const setPaymentMethod = useCallback((method: string | null) => {
    setDraft(prev => ({
      ...prev,
      paymentMethod: method,
      updatedAt: Date.now(),
    }));
  }, []);

  // Clear draft (after successful payment)
  const clearDraft = useCallback(() => {
    setDraft(createEmptyDraft());
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[OrderDraft] Error clearing draft:', error);
    }
  }, [storageKey]);

  return {
    draft,
    isHydrated,
    updateCartSnapshot,
    updateCustomer,
    setPaymentMethod,
    clearDraft,
  };
}
