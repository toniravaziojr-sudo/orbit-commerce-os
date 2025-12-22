// =============================================
// DISCOUNT CONTEXT - Global state for applied coupon
// Single source of truth for discounts in storefront
// =============================================

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

export interface AppliedDiscount {
  discount_id: string;
  discount_name: string;
  discount_code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  free_shipping: boolean;
}

interface DiscountContextType {
  appliedDiscount: AppliedDiscount | null;
  isValidating: boolean;
  applyDiscount: (
    storeHost: string,
    code: string,
    subtotal: number,
    shippingPrice?: number,
    customerEmail?: string
  ) => Promise<boolean>;
  removeDiscount: () => void;
  revalidateDiscount: (
    storeHost: string,
    subtotal: number,
    shippingPrice?: number,
    customerEmail?: string
  ) => Promise<void>;
  getDiscountAmount: (subtotal: number, shippingPrice?: number) => number;
}

const DiscountContext = createContext<DiscountContextType | null>(null);

const STORAGE_KEY_PREFIX = 'coupon_';

interface DiscountProviderProps {
  children: ReactNode;
}

export function DiscountProvider({ children }: DiscountProviderProps) {
  const { tenantSlug } = useParams();
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  const storageKey = `${STORAGE_KEY_PREFIX}${tenantSlug || 'default'}`;

  // Load from localStorage on mount
  useEffect(() => {
    if (!tenantSlug) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.discount_code) {
          setAppliedDiscount(parsed);
        }
      }
    } catch (e) {
      console.error('[DiscountContext] Error loading from localStorage:', e);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, tenantSlug]);

  // Persist to localStorage when discount changes
  useEffect(() => {
    if (!tenantSlug) return;
    
    if (appliedDiscount) {
      localStorage.setItem(storageKey, JSON.stringify(appliedDiscount));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [appliedDiscount, storageKey, tenantSlug]);

  const applyDiscount = useCallback(async (
    storeHost: string,
    code: string,
    subtotal: number,
    shippingPrice: number = 0,
    customerEmail?: string
  ): Promise<boolean> => {
    if (!code.trim()) return false;

    setIsValidating(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discount-validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            store_host: storeHost,
            code: code.trim(),
            subtotal,
            shipping_price: shippingPrice,
            customer_email: customerEmail,
          }),
        }
      );

      const data = await response.json();

      if (!data.valid) {
        toast.error(data.error || 'Cupom inválido');
        return false;
      }

      const discount: AppliedDiscount = {
        discount_id: data.discount_id,
        discount_name: data.discount_name,
        discount_code: data.discount_code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_amount: data.discount_amount,
        free_shipping: data.free_shipping,
      };

      setAppliedDiscount(discount);
      toast.success('Cupom aplicado com sucesso!');
      return true;
    } catch (err) {
      console.error('[DiscountContext] Error validating discount:', err);
      toast.error('Erro ao validar cupom');
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const removeDiscount = useCallback(() => {
    setAppliedDiscount(null);
    toast.info('Cupom removido');
  }, []);

  const revalidateDiscount = useCallback(async (
    storeHost: string,
    subtotal: number,
    shippingPrice: number = 0,
    customerEmail?: string
  ) => {
    if (!appliedDiscount) return;

    setIsValidating(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discount-validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            store_host: storeHost,
            code: appliedDiscount.discount_code,
            subtotal,
            shipping_price: shippingPrice,
            customer_email: customerEmail,
          }),
        }
      );

      const data = await response.json();

      if (!data.valid) {
        // Coupon became invalid
        setAppliedDiscount(null);
        toast.warning(`Cupom ${appliedDiscount.discount_code} não é mais válido: ${data.error}`);
        return;
      }

      // Update with new calculated values
      setAppliedDiscount({
        discount_id: data.discount_id,
        discount_name: data.discount_name,
        discount_code: data.discount_code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_amount: data.discount_amount,
        free_shipping: data.free_shipping,
      });
    } catch (err) {
      console.error('[DiscountContext] Error revalidating discount:', err);
      // Keep current discount on network error
    } finally {
      setIsValidating(false);
    }
  }, [appliedDiscount]);

  const getDiscountAmount = useCallback((subtotal: number, shippingPrice: number = 0): number => {
    if (!appliedDiscount) return 0;

    switch (appliedDiscount.discount_type) {
      case 'order_percent':
        return Math.round((subtotal * appliedDiscount.discount_value / 100) * 100) / 100;
      case 'order_fixed':
        return Math.min(appliedDiscount.discount_value, subtotal);
      case 'free_shipping':
        return 0; // Free shipping is handled separately
      default:
        return appliedDiscount.discount_amount;
    }
  }, [appliedDiscount]);

  return (
    <DiscountContext.Provider
      value={{
        appliedDiscount,
        isValidating,
        applyDiscount,
        removeDiscount,
        revalidateDiscount,
        getDiscountAmount,
      }}
    >
      {children}
    </DiscountContext.Provider>
  );
}

export function useDiscount() {
  const context = useContext(DiscountContext);
  if (!context) {
    // Return a no-op context if used outside provider
    return {
      appliedDiscount: null,
      isValidating: false,
      applyDiscount: async () => false,
      removeDiscount: () => {},
      revalidateDiscount: async () => {},
      getDiscountAmount: () => 0,
    };
  }
  return context;
}
