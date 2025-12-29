// =============================================
// MAPEAMENTO SHOPIFY → FORMATO INTERNO
// =============================================

import type {
  NormalizedProduct,
  NormalizedCategory,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedProductImage,
  NormalizedProductVariant,
  NormalizedAddress,
  NormalizedOrderItem,
} from '../types';

// Campos do Shopify (como vêm da API/CSV)
export interface ShopifyProduct {
  id?: string | number;
  handle?: string;
  title?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  published?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  // CSV fields
  'Handle'?: string;
  'Title'?: string;
  'Body (HTML)'?: string;
  'Vendor'?: string;
  'Product Category'?: string;
  'Type'?: string;
  'Tags'?: string;
  'Published'?: string;
  'Variant SKU'?: string;
  'Variant Price'?: string;
  'Variant Compare At Price'?: string;
  'Variant Inventory Qty'?: string;
  'Variant Weight'?: string;
  'Image Src'?: string;
  'Image Alt Text'?: string;
  'SEO Title'?: string;
  'SEO Description'?: string;
  'Cost per item'?: string;
  'Variant Barcode'?: string;
}

export interface ShopifyVariant {
  id?: string | number;
  title?: string;
  price?: string | number;
  compare_at_price?: string | number | null;
  sku?: string;
  inventory_quantity?: number;
  weight?: number;
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface ShopifyImage {
  id?: string | number;
  src?: string;
  alt?: string;
  position?: number;
}

export interface ShopifyCustomer {
  id?: string | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  accepts_marketing?: boolean;
  tags?: string;
  note?: string;
  default_address?: ShopifyAddress;
  addresses?: ShopifyAddress[];
  // CSV fields
  'Email'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Phone'?: string;
  'Accepts Marketing'?: string;
  'Tags'?: string;
  'Note'?: string;
}

export interface ShopifyAddress {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  default?: boolean;
}

export interface ShopifyOrder {
  id?: string | number;
  name?: string; // Order number like #1001
  order_number?: number;
  email?: string;
  phone?: string;
  financial_status?: string;
  fulfillment_status?: string;
  subtotal_price?: string | number;
  total_discounts?: string | number;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  total_price?: string | number;
  currency?: string;
  created_at?: string;
  processed_at?: string;
  line_items?: ShopifyLineItem[];
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  note?: string;
  // CSV fields
  'Name'?: string;
  'Email'?: string;
  'Financial Status'?: string;
  'Fulfillment Status'?: string;
  'Subtotal'?: string;
  'Discount Amount'?: string;
  'Shipping'?: string;
  'Total'?: string;
  'Created at'?: string;
}

export interface ShopifyLineItem {
  title?: string;
  variant_title?: string;
  sku?: string;
  quantity?: number;
  price?: string | number;
}

// Funções de normalização
export function normalizeShopifyProduct(raw: ShopifyProduct): NormalizedProduct {
  const handle = raw.handle || raw['Handle'] || '';
  const title = raw.title || raw['Title'] || 'Produto sem nome';
  const description = raw.body_html || raw['Body (HTML)'] || null;
  
  const price = parseFloat(raw.variants?.[0]?.price?.toString() || raw['Variant Price'] || '0');
  const compareAtPrice = parseFloat(raw.variants?.[0]?.compare_at_price?.toString() || raw['Variant Compare At Price'] || '0') || null;
  const costPrice = parseFloat(raw['Cost per item'] || '0') || null;
  
  const sku = raw.variants?.[0]?.sku || raw['Variant SKU'] || null;
  const barcode = raw['Variant Barcode'] || null;
  const weight = parseFloat(raw.variants?.[0]?.weight?.toString() || raw['Variant Weight'] || '0') || null;
  const stockQuantity = parseInt(raw.variants?.[0]?.inventory_quantity?.toString() || raw['Variant Inventory Qty'] || '0', 10);
  
  const published = raw.published ?? raw['Published']?.toLowerCase() === 'true';
  const tags = (raw.tags || raw['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean);
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.src || '',
        alt: img.alt || null,
        is_primary: idx === 0,
        position: img.position || idx,
      });
    });
  } else if (raw['Image Src']) {
    images.push({
      url: raw['Image Src'],
      alt: raw['Image Alt Text'] || null,
      is_primary: true,
      position: 0,
    });
  }
  
  // Variantes
  const variants: NormalizedProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    raw.variants.forEach(v => {
      const options: Record<string, string> = {};
      if (v.option1) options['Opção 1'] = v.option1;
      if (v.option2) options['Opção 2'] = v.option2;
      if (v.option3) options['Opção 3'] = v.option3;
      
      variants.push({
        name: v.title || 'Default',
        sku: v.sku || null,
        price: parseFloat(v.price?.toString() || '0'),
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price.toString()) : null,
        stock_quantity: v.inventory_quantity || null,
        options,
      });
    });
  }
  
  // Categorias
  const productType = raw.product_type || raw['Type'] || raw['Product Category'] || '';
  const categories = productType ? [slugify(productType)] : [];
  
  return {
    name: title,
    slug: handle || slugify(title),
    description,
    short_description: null,
    price,
    compare_at_price: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
    cost_price: costPrice,
    sku,
    barcode,
    weight,
    width: null,
    height: null,
    depth: null,
    stock_quantity: stockQuantity,
    is_featured: tags.includes('featured') || tags.includes('destaque'),
    status: published ? 'active' : 'draft',
    seo_title: raw['SEO Title'] || null,
    seo_description: raw['SEO Description'] || null,
    images,
    variants,
    categories,
  };
}

export function normalizeShopifyCustomer(raw: ShopifyCustomer): NormalizedCustomer {
  const email = raw.email || raw['Email'] || '';
  const firstName = raw.first_name || raw['First Name'] || '';
  const lastName = raw.last_name || raw['Last Name'] || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Cliente';
  const phone = raw.phone || raw['Phone'] || null;
  const acceptsMarketing = raw.accepts_marketing ?? raw['Accepts Marketing']?.toLowerCase() === 'yes';
  const tags = (raw.tags || raw['Tags'] || '').split(',').map(t => t.trim()).filter(Boolean);
  const note = raw.note || raw['Note'] || null;
  
  const addresses: NormalizedAddress[] = [];
  const allAddresses = raw.addresses || (raw.default_address ? [raw.default_address] : []);
  
  allAddresses.forEach((addr, idx) => {
    addresses.push(normalizeShopifyAddress(addr, idx === 0));
  });
  
  return {
    email,
    full_name: fullName,
    phone: normalizePhone(phone),
    cpf: null,
    birth_date: null,
    gender: null,
    accepts_marketing: acceptsMarketing,
    status: 'active',
    addresses,
    tags,
    notes: note,
  };
}

export function normalizeShopifyAddress(raw: ShopifyAddress, isDefault: boolean = false): NormalizedAddress {
  const name = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Destinatário';
  
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: name,
    street: raw.address1 || '',
    number: '', // Shopify não separa número
    complement: raw.address2 || null,
    neighborhood: '',
    city: raw.city || '',
    state: raw.province_code || raw.province || '',
    postal_code: (raw.zip || '').replace(/\D/g, ''),
    country: raw.country_code || raw.country || 'BR',
    is_default: raw.default ?? isDefault,
  };
}

export function normalizeShopifyOrder(raw: ShopifyOrder): NormalizedOrder {
  const orderNumber = raw.name || raw['Name'] || `#${raw.order_number || Date.now()}`;
  const email = raw.email || raw['Email'] || '';
  
  const financialStatus = raw.financial_status || raw['Financial Status'] || 'pending';
  const fulfillmentStatus = raw.fulfillment_status || raw['Fulfillment Status'] || null;
  
  const subtotal = parseFloat(raw.subtotal_price?.toString() || raw['Subtotal'] || '0');
  const discountTotal = parseFloat(raw.total_discounts?.toString() || raw['Discount Amount'] || '0');
  const shippingTotal = parseFloat(
    raw.total_shipping_price_set?.shop_money?.amount || raw['Shipping'] || '0'
  );
  const total = parseFloat(raw.total_price?.toString() || raw['Total'] || '0');
  
  const items: NormalizedOrderItem[] = (raw.line_items || []).map(item => ({
    product_name: item.title || 'Produto',
    product_sku: item.sku || null,
    variant_name: item.variant_title || null,
    quantity: item.quantity || 1,
    unit_price: parseFloat(item.price?.toString() || '0'),
    total_price: parseFloat(item.price?.toString() || '0') * (item.quantity || 1),
  }));
  
  return {
    order_number: orderNumber.replace('#', ''),
    status: mapShopifyStatus(financialStatus, fulfillmentStatus),
    payment_status: mapShopifyPaymentStatus(financialStatus),
    payment_method: null,
    shipping_status: fulfillmentStatus,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: raw.currency || 'BRL',
    customer_email: email,
    customer_name: raw.shipping_address?.name || raw.billing_address?.name || '',
    customer_phone: raw.phone || raw.shipping_address?.phone || null,
    shipping_address: raw.shipping_address ? normalizeShopifyAddress(raw.shipping_address, true) : null,
    billing_address: raw.billing_address ? normalizeShopifyAddress(raw.billing_address, false) : null,
    items,
    notes: raw.note || null,
    created_at: raw.created_at || raw['Created at'] || new Date().toISOString(),
    paid_at: financialStatus === 'paid' ? raw.processed_at || null : null,
    shipped_at: null,
    delivered_at: null,
    tracking_code: null,
    tracking_carrier: null,
  };
}

// Helpers
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits;
}

function mapShopifyStatus(
  financial: string,
  fulfillment: string | null
): NormalizedOrder['status'] {
  if (financial === 'refunded') return 'refunded';
  if (financial === 'voided') return 'cancelled';
  if (fulfillment === 'fulfilled') return 'delivered';
  if (fulfillment === 'partial') return 'shipped';
  if (financial === 'paid') return 'paid';
  return 'pending';
}

function mapShopifyPaymentStatus(financial: string): NormalizedOrder['payment_status'] {
  switch (financial) {
    case 'paid': return 'paid';
    case 'refunded': return 'refunded';
    case 'voided': return 'cancelled';
    case 'pending': return 'pending';
    default: return 'pending';
  }
}

// Mapeamento de campos (para referência e UI)
export const SHOPIFY_FIELD_MAPPING = {
  products: {
    'Title': 'name',
    'Handle': 'slug',
    'Body (HTML)': 'description',
    'Variant Price': 'price',
    'Variant Compare At Price': 'compare_at_price',
    'Cost per item': 'cost_price',
    'Variant SKU': 'sku',
    'Variant Barcode': 'barcode',
    'Variant Weight': 'weight',
    'Variant Inventory Qty': 'stock_quantity',
    'Published': 'status',
    'SEO Title': 'seo_title',
    'SEO Description': 'seo_description',
    'Image Src': 'images',
    'Type': 'categories',
    'Tags': 'tags',
  },
  customers: {
    'Email': 'email',
    'First Name': 'full_name',
    'Last Name': 'full_name',
    'Phone': 'phone',
    'Accepts Marketing': 'accepts_marketing',
    'Tags': 'tags',
    'Note': 'notes',
  },
  orders: {
    'Name': 'order_number',
    'Email': 'customer_email',
    'Financial Status': 'payment_status',
    'Fulfillment Status': 'shipping_status',
    'Subtotal': 'subtotal',
    'Discount Amount': 'discount_total',
    'Shipping': 'shipping_total',
    'Total': 'total',
    'Created at': 'created_at',
  },
};
