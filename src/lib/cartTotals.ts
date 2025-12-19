// =============================================
// CART TOTALS - Single source of truth for calculations
// =============================================

import { CartItem, ShippingOption } from '@/contexts/CartContext';

export interface CartTotalsInput {
  items: CartItem[];
  selectedShipping: ShippingOption | null;
  discountAmount?: number;
}

export interface CartTotals {
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  itemCount: number;
  totalItems: number;
}

/**
 * Single source of truth for cart totals calculation.
 * Must be used by Cart, Checkout, and Thank You pages.
 * DO NOT calculate totals anywhere else.
 */
export function calculateCartTotals(input: CartTotalsInput): CartTotals {
  const { items, selectedShipping, discountAmount = 0 } = input;

  // Subtotal from items
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 0);
    return sum + itemTotal;
  }, 0);

  // Shipping
  const shippingTotal = selectedShipping?.isFree ? 0 : (selectedShipping?.price || 0);

  // Discount (ensure non-negative)
  const discountTotal = Math.max(0, discountAmount);

  // Grand total (ensure non-negative)
  const grandTotal = Math.max(0, subtotal + shippingTotal - discountTotal);

  // Item counts
  const itemCount = items.length;
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    subtotal,
    shippingTotal,
    discountTotal,
    grandTotal,
    itemCount,
    totalItems,
  };
}

/**
 * Safely convert any value to a valid number.
 * Handles strings, objects, null, undefined gracefully.
 */
export function toSafeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  // Handle objects that might have a numeric property
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('price' in obj && typeof obj.price === 'number') return obj.price;
    if ('value' in obj && typeof obj.value === 'number') return obj.value;
  }
  return 0;
}

/**
 * Format currency for display (BRL) - SAFE version
 * Always returns valid string even if input is invalid
 */
export function formatCurrency(value: unknown): string {
  const safeValue = toSafeNumber(value);
  return `R$ ${safeValue.toFixed(2).replace('.', ',')}`;
}

/**
 * Format price for display - SAFE version (without R$ prefix)
 */
export function formatPrice(value: unknown): string {
  const safeValue = toSafeNumber(value);
  return safeValue.toFixed(2).replace('.', ',');
}

/**
 * Debug helper for development - logs totals state
 */
export function debugCartTotals(
  label: string,
  totals: CartTotals,
  shipping: { cep: string; selected: ShippingOption | null } | null
): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('debugCart')) return;

  console.group(`[CartTotals] ${label}`);
  console.log('Subtotal:', formatCurrency(totals.subtotal));
  console.log('Shipping:', formatCurrency(totals.shippingTotal));
  console.log('Discount:', formatCurrency(totals.discountTotal));
  console.log('Grand Total:', formatCurrency(totals.grandTotal));
  console.log('Items:', totals.itemCount, 'Total qty:', totals.totalItems);
  if (shipping) {
    console.log('CEP:', shipping.cep);
    console.log('Selected:', shipping.selected?.label || 'None');
  }
  console.groupEnd();
}
