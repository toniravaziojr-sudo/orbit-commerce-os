// =============================================
// MAPEAMENTO WOOCOMMERCE → FORMATO INTERNO
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

// Campos do WooCommerce (como vêm da API/CSV)
export interface WooCommerceProduct {
  id?: number;
  name?: string;
  slug?: string;
  permalink?: string;
  type?: string;
  status?: string;
  featured?: boolean;
  catalog_visibility?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  on_sale?: boolean;
  purchasable?: boolean;
  total_sales?: number;
  virtual?: boolean;
  downloadable?: boolean;
  tax_status?: string;
  tax_class?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  backorders?: string;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  categories?: { id?: number; name?: string; slug?: string }[];
  tags?: { id?: number; name?: string; slug?: string }[];
  images?: { id?: number; src?: string; name?: string; alt?: string }[];
  attributes?: { id?: number; name?: string; options?: string[] }[];
  variations?: number[];
  // CSV fields (WooCommerce export)
  'ID'?: string;
  'Type'?: string;
  'SKU'?: string;
  'Name'?: string;
  'Published'?: string;
  'Is featured?'?: string;
  'Visibility in catalog'?: string;
  'Short description'?: string;
  'Description'?: string;
  'Sale price'?: string;
  'Regular price'?: string;
  'Categories'?: string;
  'Tags'?: string;
  'Images'?: string;
  'Stock'?: string;
  'Weight (kg)'?: string;
  'Length (cm)'?: string;
  'Width (cm)'?: string;
  'Height (cm)'?: string;
}

export interface WooCommerceCustomer {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
  billing?: WooCommerceAddress;
  shipping?: WooCommerceAddress;
  is_paying_customer?: boolean;
  avatar_url?: string;
  meta_data?: { key: string; value: any }[];
  // CSV fields
  'Email'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Username'?: string;
  'Billing Phone'?: string;
  'Billing Address 1'?: string;
  'Billing City'?: string;
  'Billing State'?: string;
  'Billing Postcode'?: string;
  'Billing Country'?: string;
}

export interface WooCommerceAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface WooCommerceOrder {
  id?: number;
  parent_id?: number;
  number?: string;
  order_key?: string;
  status?: string;
  currency?: string;
  date_created?: string;
  date_modified?: string;
  discount_total?: string;
  shipping_total?: string;
  total?: string;
  total_tax?: string;
  customer_id?: number;
  billing?: WooCommerceAddress;
  shipping?: WooCommerceAddress;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  date_paid?: string;
  date_completed?: string;
  line_items?: WooCommerceLineItem[];
  shipping_lines?: { method_title?: string; total?: string }[];
  customer_note?: string;
  meta_data?: { key: string; value: any }[];
  // CSV fields
  'Order ID'?: string;
  'Order Number'?: string;
  'Order Status'?: string;
  'Order Date'?: string;
  'Customer Email'?: string;
  'Customer Name'?: string;
  'Order Subtotal'?: string;
  'Order Discount'?: string;
  'Order Shipping'?: string;
  'Order Total'?: string;
  'Payment Method'?: string;
}

export interface WooCommerceLineItem {
  id?: number;
  name?: string;
  product_id?: number;
  variation_id?: number;
  quantity?: number;
  tax_class?: string;
  subtotal?: string;
  subtotal_tax?: string;
  total?: string;
  total_tax?: string;
  taxes?: any[];
  meta_data?: { key: string; value: any }[];
  sku?: string;
  price?: number;
}

export interface WooCommerceCategory {
  id?: number;
  name?: string;
  slug?: string;
  parent?: number;
  description?: string;
  display?: string;
  image?: { id?: number; src?: string; alt?: string };
  menu_order?: number;
  count?: number;
  // CSV fields
  'Category ID'?: string;
  'Category Name'?: string;
  'Category Slug'?: string;
  'Category Parent'?: string;
  'Category Description'?: string;
}

// Funções de normalização
export function normalizeWooCommerceProduct(raw: WooCommerceProduct): NormalizedProduct {
  const name = raw.name || raw['Name'] || 'Produto sem nome';
  const slug = raw.slug || slugify(name);
  const description = raw.description || raw['Description'] || null;
  const shortDescription = raw.short_description || raw['Short description'] || null;
  
  const regularPrice = parseFloat(raw.regular_price || raw['Regular price'] || '0');
  const salePrice = parseFloat(raw.sale_price || raw['Sale price'] || '0');
  const price = salePrice > 0 ? salePrice : regularPrice;
  const compareAtPrice = salePrice > 0 && regularPrice > salePrice ? regularPrice : null;
  
  const sku = raw.sku || raw['SKU'] || null;
  const weight = parseFloat(raw.weight || raw['Weight (kg)'] || '0') || null;
  const dimensions = raw.dimensions || {};
  const length = parseFloat(dimensions.length || raw['Length (cm)'] || '0') || null;
  const width = parseFloat(dimensions.width || raw['Width (cm)'] || '0') || null;
  const height = parseFloat(dimensions.height || raw['Height (cm)'] || '0') || null;
  const stockQuantity = raw.stock_quantity ?? parseInt(raw['Stock'] || '0', 10);
  
  const published = raw.status === 'publish' || raw['Published'] === '1';
  const featured = raw.featured || raw['Is featured?'] === '1';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.src || '',
        alt: img.alt || img.name || null,
        is_primary: idx === 0,
        position: idx,
      });
    });
  } else if (raw['Images']) {
    const imageUrls = raw['Images'].split(',').map(u => u.trim());
    imageUrls.forEach((url, idx) => {
      images.push({ url, alt: null, is_primary: idx === 0, position: idx });
    });
  }
  
  // Variantes (WooCommerce trata variações separadamente)
  const variants: NormalizedProductVariant[] = [];
  
  // Categorias
  const categories: string[] = [];
  if (raw.categories && Array.isArray(raw.categories)) {
    raw.categories.forEach(cat => {
      if (cat.slug) categories.push(cat.slug);
    });
  } else if (raw['Categories']) {
    const catNames = raw['Categories'].split(',').map(c => slugify(c.trim()));
    categories.push(...catNames);
  }
  
  return {
    name,
    slug,
    description,
    short_description: shortDescription,
    price,
    compare_at_price: compareAtPrice,
    cost_price: null,
    sku,
    barcode: null,
    weight,
    width,
    height,
    depth: length,
    stock_quantity: stockQuantity,
    is_featured: featured,
    status: published ? 'active' : 'draft',
    seo_title: null,
    seo_description: null,
    images,
    variants,
    categories,
  };
}

export function normalizeWooCommerceCategory(raw: WooCommerceCategory): NormalizedCategory {
  const name = raw.name || raw['Category Name'] || 'Categoria';
  const slug = raw.slug || raw['Category Slug'] || slugify(name);
  const description = raw.description || raw['Category Description'] || null;
  const parentSlug = raw['Category Parent'] ? slugify(raw['Category Parent']) : null;
  
  return {
    name,
    slug,
    description,
    image_url: raw.image?.src || null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: parentSlug,
    seo_title: null,
    seo_description: null,
    sort_order: raw.menu_order || 0,
    is_active: true,
  };
}

export function normalizeWooCommerceCustomer(raw: WooCommerceCustomer): NormalizedCustomer {
  const email = raw.email || raw['Email'] || '';
  const firstName = raw.first_name || raw['First Name'] || '';
  const lastName = raw.last_name || raw['Last Name'] || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Cliente';
  
  const billing = raw.billing || {};
  const shipping = raw.shipping || {};
  
  const phone = billing.phone || raw['Billing Phone'] || null;
  
  const addresses: NormalizedAddress[] = [];
  
  // Billing address
  if (billing.address_1 || raw['Billing Address 1']) {
    addresses.push({
      label: 'Cobrança',
      recipient_name: `${billing.first_name || ''} ${billing.last_name || ''}`.trim() || fullName,
      street: billing.address_1 || raw['Billing Address 1'] || '',
      number: '',
      complement: billing.address_2 || null,
      neighborhood: '',
      city: billing.city || raw['Billing City'] || '',
      state: billing.state || raw['Billing State'] || '',
      postal_code: (billing.postcode || raw['Billing Postcode'] || '').replace(/\D/g, ''),
      country: billing.country || raw['Billing Country'] || 'BR',
      is_default: true,
    });
  }
  
  // Shipping address (if different)
  if (shipping.address_1 && shipping.address_1 !== billing.address_1) {
    addresses.push({
      label: 'Entrega',
      recipient_name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || fullName,
      street: shipping.address_1 || '',
      number: '',
      complement: shipping.address_2 || null,
      neighborhood: '',
      city: shipping.city || '',
      state: shipping.state || '',
      postal_code: (shipping.postcode || '').replace(/\D/g, ''),
      country: shipping.country || 'BR',
      is_default: false,
    });
  }
  
  return {
    email,
    full_name: fullName,
    phone: normalizePhone(phone),
    cpf: null,
    birth_date: null,
    gender: null,
    accepts_marketing: true,
    status: 'active',
    addresses,
    tags: [],
    notes: null,
  };
}

export function normalizeWooCommerceOrder(raw: WooCommerceOrder): NormalizedOrder {
  const orderNumber = raw.number || raw['Order Number'] || raw['Order ID'] || Date.now().toString();
  
  const subtotal = parseFloat(raw['Order Subtotal']?.replace(',', '.') || '0');
  const discountTotal = parseFloat(raw.discount_total || raw['Order Discount']?.replace(',', '.') || '0');
  const shippingTotal = parseFloat(raw.shipping_total || raw['Order Shipping']?.replace(',', '.') || '0');
  const total = parseFloat(raw.total || raw['Order Total']?.replace(',', '.') || '0');
  
  const items: NormalizedOrderItem[] = (raw.line_items || []).map(item => ({
    product_name: item.name || 'Produto',
    product_sku: item.sku || null,
    variant_name: null,
    quantity: item.quantity || 1,
    unit_price: item.price || parseFloat(item.subtotal || '0') / (item.quantity || 1),
    total_price: parseFloat(item.total || item.subtotal || '0'),
  }));
  
  const billing = raw.billing || {};
  const shipping = raw.shipping || {};
  
  return {
    order_number: orderNumber,
    status: mapWooCommerceStatus(raw.status || raw['Order Status'] || 'pending'),
    payment_status: mapWooCommercePaymentStatus(raw.status || raw['Order Status'] || 'pending'),
    payment_method: raw.payment_method_title || raw['Payment Method'] || null,
    shipping_status: null,
    subtotal: subtotal || total - shippingTotal + discountTotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: raw.currency || 'BRL',
    customer_email: billing.email || raw['Customer Email'] || '',
    customer_name: raw['Customer Name'] || `${billing.first_name || ''} ${billing.last_name || ''}`.trim(),
    customer_phone: billing.phone || null,
    shipping_address: shipping.address_1 ? normalizeWooCommerceAddress(shipping, false) : null,
    billing_address: billing.address_1 ? normalizeWooCommerceAddress(billing, true) : null,
    items,
    notes: raw.customer_note || null,
    created_at: raw.date_created || raw['Order Date'] || new Date().toISOString(),
    paid_at: raw.date_paid || null,
    shipped_at: null,
    delivered_at: raw.date_completed || null,
    tracking_code: null,
    tracking_carrier: null,
  };
}

function normalizeWooCommerceAddress(raw: WooCommerceAddress, isDefault: boolean): NormalizedAddress {
  return {
    label: isDefault ? 'Principal' : 'Entrega',
    recipient_name: `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Destinatário',
    street: raw.address_1 || '',
    number: '',
    complement: raw.address_2 || null,
    neighborhood: '',
    city: raw.city || '',
    state: raw.state || '',
    postal_code: (raw.postcode || '').replace(/\D/g, ''),
    country: raw.country || 'BR',
    is_default: isDefault,
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

function mapWooCommerceStatus(status: string): NormalizedOrder['status'] {
  const s = status.toLowerCase().replace('wc-', '');
  switch (s) {
    case 'completed': return 'delivered';
    case 'processing': return 'paid';
    case 'on-hold': return 'pending';
    case 'cancelled': return 'cancelled';
    case 'refunded': return 'refunded';
    case 'failed': return 'cancelled';
    default: return 'pending';
  }
}

function mapWooCommercePaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toLowerCase().replace('wc-', '');
  switch (s) {
    case 'completed':
    case 'processing': return 'paid';
    case 'refunded': return 'refunded';
    case 'cancelled':
    case 'failed': return 'failed';
    default: return 'pending';
  }
}

export const WOOCOMMERCE_FIELD_MAPPING = {
  products: {
    'Name': 'name',
    'Description': 'description',
    'Short description': 'short_description',
    'Regular price': 'price',
    'Sale price': 'compare_at_price',
    'SKU': 'sku',
    'Weight (kg)': 'weight',
    'Width (cm)': 'width',
    'Height (cm)': 'height',
    'Length (cm)': 'depth',
    'Stock': 'stock_quantity',
    'Published': 'status',
    'Is featured?': 'is_featured',
    'Categories': 'categories',
    'Images': 'images',
  },
  customers: {
    'Email': 'email',
    'First Name': 'full_name',
    'Last Name': 'full_name',
    'Billing Phone': 'phone',
  },
  orders: {
    'Order Number': 'order_number',
    'Order Status': 'status',
    'Order Date': 'created_at',
    'Customer Email': 'customer_email',
    'Customer Name': 'customer_name',
    'Order Subtotal': 'subtotal',
    'Order Discount': 'discount_total',
    'Order Shipping': 'shipping_total',
    'Order Total': 'total',
    'Payment Method': 'payment_method',
  },
  categories: {
    'Category Name': 'name',
    'Category Slug': 'slug',
    'Category Description': 'description',
    'Category Parent': 'parent_slug',
  },
};
