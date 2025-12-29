// =============================================
// MAPEAMENTO WIX STORES → FORMATO INTERNO
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

// Campos do Wix Stores (como vêm da API/CSV)
export interface WixProduct {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  additionalInfo?: { title?: string; description?: string }[];
  sku?: string;
  visible?: boolean;
  productType?: string;
  price?: { price?: number; currency?: string; discountedPrice?: number };
  costAndProfitData?: { itemCost?: number };
  ribbon?: string;
  brand?: string;
  weight?: number;
  inventory?: { status?: string; quantity?: number };
  media?: { mainMedia?: WixMedia; items?: WixMedia[] };
  customTextFields?: { title?: string; mandatory?: boolean }[];
  productOptions?: WixProductOption[];
  variants?: WixVariant[];
  collections?: { id?: string; name?: string }[];
  // CSV fields
  handleId?: string;
  fieldType?: string;
  productImageUrl?: string;
  collection?: string;
  surcharge?: string;
  discountMode?: string;
  discountValue?: string;
  cost?: string;
  productOptionName1?: string;
  productOptionType1?: string;
  productOptionDescription1?: string;
  productOptionName2?: string;
  productOptionType2?: string;
  productOptionDescription2?: string;
  additionalInfoTitle1?: string;
  additionalInfoDescription1?: string;
}

export interface WixMedia {
  id?: string;
  url?: string;
  fullUrl?: string;
  mediaType?: string;
  altText?: string;
  title?: string;
}

export interface WixProductOption {
  name?: string;
  optionType?: string;
  choices?: { value?: string; description?: string; inStock?: boolean; visible?: boolean }[];
}

export interface WixVariant {
  id?: string;
  choices?: Record<string, string>;
  sku?: string;
  priceData?: { price?: number; discountedPrice?: number };
  costAndProfitData?: { itemCost?: number };
  weight?: number;
  inventory?: { status?: string; quantity?: number };
}

export interface WixCollection {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  media?: WixMedia;
  visible?: boolean;
  handleId?: string;
  headerImageUrl?: string;
}

export interface WixCustomer {
  id?: string;
  contactId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addresses?: WixAddress[];
  labels?: string[];
  Email?: string;
  'First Name'?: string;
  'Last Name'?: string;
  Phone?: string;
  Country?: string;
  State?: string;
  City?: string;
  Address?: string;
  Zip?: string;
}

export interface WixAddress {
  id?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  subdivision?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  fullName?: { firstName?: string; lastName?: string };
}

export interface WixOrder {
  id?: string;
  number?: number;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  priceSummary?: {
    subtotal?: { amount?: number };
    discount?: { amount?: number };
    shipping?: { amount?: number };
    total?: { amount?: number };
  };
  billingInfo?: { paymentMethod?: string; address?: WixAddress; contactDetails?: { firstName?: string; lastName?: string; phone?: string } };
  shippingInfo?: { shipmentDetails?: { address?: WixAddress; trackingInfo?: { trackingNumber?: string; shippingProvider?: string } } };
  buyerInfo?: { email?: string; firstName?: string; lastName?: string; phone?: string };
  lineItems?: WixLineItem[];
  buyerNote?: string;
  createdDate?: string;
  // CSV fields
  'Order ID'?: string;
  'Order Number'?: string;
  'Date Created'?: string;
  'Status'?: string;
  'Payment Status'?: string;
  'Fulfillment Status'?: string;
  'Customer Email'?: string;
  'Customer Name'?: string;
  'Subtotal'?: string;
  'Discount'?: string;
  'Shipping'?: string;
  'Total'?: string;
  'Payment Method'?: string;
}

export interface WixLineItem {
  id?: string;
  productId?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  price?: { amount?: number };
  totalPrice?: { amount?: number };
  options?: { option?: string; selection?: string }[];
}

// Funções de normalização
export function normalizeWixProduct(raw: WixProduct): NormalizedProduct {
  const name = raw.name || 'Produto sem nome';
  const slug = raw.slug || raw.handleId || slugify(name);
  const description = raw.description || null;
  
  const priceValue = raw.price?.price ?? 0;
  const discountedPrice = raw.price?.discountedPrice ?? 0;
  const price = discountedPrice > 0 ? discountedPrice : priceValue;
  const compareAtPrice = discountedPrice > 0 && priceValue > discountedPrice ? priceValue : null;
  const costPrice = raw.costAndProfitData?.itemCost ?? (parseFloat(raw.cost || '0') || null);
  
  const sku = raw.sku || null;
  const weight = typeof raw.weight === 'number' ? raw.weight : (parseFloat(String(raw.weight || '0')) || null);
  const stockQuantity = raw.inventory?.quantity ?? 0;
  
  const isVisible = raw.visible ?? true;
  const isFeatured = !!raw.ribbon;
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.media?.items && Array.isArray(raw.media.items)) {
    raw.media.items.forEach((img, idx) => {
      const url = img.fullUrl || img.url || '';
      if (url && img.mediaType === 'image') {
        images.push({
          url,
          alt: img.altText || img.title || null,
          is_primary: idx === 0,
          position: idx,
        });
      }
    });
  } else if (raw.media?.mainMedia) {
    images.push({
      url: raw.media.mainMedia.fullUrl || raw.media.mainMedia.url || '',
      alt: raw.media.mainMedia.altText || null,
      is_primary: true,
      position: 0,
    });
  } else if (raw['productImageUrl']) {
    const urls = raw['productImageUrl'].split(';').map(u => u.trim());
    urls.forEach((url, idx) => {
      images.push({ url, alt: null, is_primary: idx === 0, position: idx });
    });
  }
  
  // Variantes
  const variants: NormalizedProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    raw.variants.forEach(v => {
      const options: Record<string, string> = v.choices || {};
      
      variants.push({
        name: Object.values(options).join(' / ') || 'Padrão',
        sku: v.sku || null,
        price: v.priceData?.discountedPrice || v.priceData?.price || price,
        compare_at_price: v.priceData?.discountedPrice && v.priceData?.price && v.priceData.price > v.priceData.discountedPrice 
          ? v.priceData.price : null,
        stock_quantity: v.inventory?.quantity || null,
        options,
      });
    });
  }
  
  // Categorias (Collections no Wix)
  const categories: string[] = [];
  if (raw.collections && Array.isArray(raw.collections)) {
    raw.collections.forEach(col => {
      if (col.name) categories.push(slugify(col.name));
    });
  } else if (raw['collection']) {
    const colNames = raw['collection'].split(';').map(c => slugify(c.trim()));
    categories.push(...colNames);
  }
  
  return {
    name,
    slug,
    description,
    short_description: null,
    price,
    compare_at_price: compareAtPrice,
    cost_price: costPrice,
    sku,
    barcode: null,
    weight,
    width: null,
    height: null,
    depth: null,
    stock_quantity: stockQuantity,
    is_featured: isFeatured,
    status: isVisible ? 'active' : 'draft',
    seo_title: null,
    seo_description: null,
    images,
    variants,
    categories,
  };
}

export function normalizeWixCollection(raw: WixCollection): NormalizedCategory {
  const name = raw.name || raw['name'] || 'Coleção';
  const slug = raw.slug || raw['handleId'] || slugify(name);
  const description = raw.description || raw['description'] || null;
  const imageUrl = raw.media?.fullUrl || raw.media?.url || raw['headerImageUrl'] || null;
  
  return {
    name,
    slug,
    description,
    image_url: imageUrl,
    banner_desktop_url: imageUrl,
    banner_mobile_url: null,
    parent_slug: null,
    seo_title: null,
    seo_description: null,
    sort_order: 0,
    is_active: raw.visible !== false,
  };
}

// Alias para compatibilidade
export const normalizeWixCategory = normalizeWixCollection;

export function normalizeWixCustomer(raw: WixCustomer): NormalizedCustomer {
  const email = raw.email || raw['Email'] || '';
  const firstName = raw.firstName || raw['First Name'] || '';
  const lastName = raw.lastName || raw['Last Name'] || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Cliente';
  const phone = raw.phone || raw['Phone'] || null;
  
  const addresses: NormalizedAddress[] = [];
  if (raw.addresses && Array.isArray(raw.addresses)) {
    raw.addresses.forEach((addr, idx) => {
      addresses.push(normalizeWixAddress(addr, idx === 0));
    });
  } else if (raw['Address']) {
    addresses.push({
      label: 'Principal',
      recipient_name: fullName,
      street: raw['Address'] || '',
      number: '',
      complement: null,
      neighborhood: '',
      city: raw['City'] || '',
      state: raw['State'] || '',
      postal_code: (raw['Zip'] || '').replace(/\D/g, ''),
      country: raw['Country'] || 'BR',
      is_default: true,
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
    tags: raw.labels || [],
    notes: null,
  };
}

export function normalizeWixAddress(raw: WixAddress, isDefault: boolean = false): NormalizedAddress {
  const fullName = raw.fullName 
    ? `${raw.fullName.firstName || ''} ${raw.fullName.lastName || ''}`.trim()
    : 'Destinatário';
    
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: fullName,
    street: raw.addressLine1 || '',
    number: '',
    complement: raw.addressLine2 || null,
    neighborhood: '',
    city: raw.city || '',
    state: raw.subdivision || '',
    postal_code: (raw.postalCode || '').replace(/\D/g, ''),
    country: raw.country || 'BR',
    is_default: isDefault,
  };
}

export function normalizeWixOrder(raw: WixOrder): NormalizedOrder {
  const orderNumber = raw.number?.toString() || raw['Order Number'] || raw['Order ID'] || Date.now().toString();
  
  const subtotal = raw.priceSummary?.subtotal?.amount ?? parseFloat(raw['Subtotal']?.replace(',', '.') || '0');
  const discountTotal = raw.priceSummary?.discount?.amount ?? parseFloat(raw['Discount']?.replace(',', '.') || '0');
  const shippingTotal = raw.priceSummary?.shipping?.amount ?? parseFloat(raw['Shipping']?.replace(',', '.') || '0');
  const total = raw.priceSummary?.total?.amount ?? parseFloat(raw['Total']?.replace(',', '.') || '0');
  
  const items: NormalizedOrderItem[] = (raw.lineItems || []).map(item => ({
    product_name: item.name || 'Produto',
    product_sku: item.sku || null,
    variant_name: item.options?.map(o => o.selection).join(' / ') || null,
    quantity: item.quantity || 1,
    unit_price: item.price?.amount || 0,
    total_price: item.totalPrice?.amount || (item.price?.amount || 0) * (item.quantity || 1),
  }));
  
  const buyerInfo = raw.buyerInfo || {};
  const customerName = raw['Customer Name'] || 
    `${buyerInfo.firstName || ''} ${buyerInfo.lastName || ''}`.trim();
  
  const shippingAddress = raw.shippingInfo?.shipmentDetails?.address;
  const trackingInfo = raw.shippingInfo?.shipmentDetails?.trackingInfo;
  
  return {
    order_number: orderNumber,
    status: mapWixStatus(raw.status || raw['Status'] || 'PENDING'),
    payment_status: mapWixPaymentStatus(raw.paymentStatus || raw['Payment Status'] || 'PENDING'),
    payment_method: raw.billingInfo?.paymentMethod || raw['Payment Method'] || null,
    shipping_status: raw.fulfillmentStatus || raw['Fulfillment Status'] || null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: 'BRL',
    customer_email: buyerInfo.email || raw['Customer Email'] || '',
    customer_name: customerName,
    customer_phone: buyerInfo.phone || raw.billingInfo?.contactDetails?.phone || null,
    shipping_address: shippingAddress ? normalizeWixAddress(shippingAddress, true) : null,
    billing_address: raw.billingInfo?.address ? normalizeWixAddress(raw.billingInfo.address, false) : null,
    items,
    notes: raw.buyerNote || null,
    created_at: raw.createdDate || raw['Date Created'] || new Date().toISOString(),
    paid_at: null,
    shipped_at: null,
    delivered_at: null,
    tracking_code: trackingInfo?.trackingNumber || null,
    tracking_carrier: trackingInfo?.shippingProvider || null,
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

function mapWixStatus(status: string): NormalizedOrder['status'] {
  const s = status.toUpperCase();
  switch (s) {
    case 'FULFILLED':
    case 'COMPLETED': return 'delivered';
    case 'PARTIALLY_FULFILLED': return 'shipped';
    case 'CANCELED':
    case 'CANCELLED': return 'cancelled';
    case 'APPROVED':
    case 'PAID': return 'paid';
    default: return 'pending';
  }
}

function mapWixPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toUpperCase();
  switch (s) {
    case 'PAID':
    case 'CAPTURED': return 'paid';
    case 'REFUNDED': return 'refunded';
    case 'CANCELED':
    case 'CANCELLED':
    case 'VOIDED': return 'cancelled';
    case 'DECLINED':
    case 'FAILED': return 'failed';
    default: return 'pending';
  }
}

export const WIX_FIELD_MAPPING = {
  products: {
    'name': 'name',
    'handleId': 'slug',
    'description': 'description',
    'price': 'price',
    'cost': 'cost_price',
    'sku': 'sku',
    'weight': 'weight',
    'inventory': 'stock_quantity',
    'visible': 'status',
    'ribbon': 'is_featured',
    'collection': 'categories',
    'productImageUrl': 'images',
  },
  customers: {
    'Email': 'email',
    'First Name': 'full_name',
    'Last Name': 'full_name',
    'Phone': 'phone',
    'City': 'addresses',
    'State': 'addresses',
    'Address': 'addresses',
    'Zip': 'addresses',
  },
  orders: {
    'Order Number': 'order_number',
    'Status': 'status',
    'Payment Status': 'payment_status',
    'Date Created': 'created_at',
    'Customer Email': 'customer_email',
    'Customer Name': 'customer_name',
    'Subtotal': 'subtotal',
    'Discount': 'discount_total',
    'Shipping': 'shipping_total',
    'Total': 'total',
    'Payment Method': 'payment_method',
  },
  categories: {
    'name': 'name',
    'handleId': 'slug',
    'description': 'description',
    'headerImageUrl': 'image_url',
  },
};
