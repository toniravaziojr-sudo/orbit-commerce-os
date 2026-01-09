// =============================================
// MAPEAMENTO NUVEMSHOP/TIENDANUBE → FORMATO INTERNO
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

import { stripHtmlToText, cleanSku, extractNumericOnly } from '../utils';

// Campos da Nuvemshop (como vêm da API/CSV)
export interface NuvemshopProduct {
  id?: number;
  name?: { pt?: string; es?: string; en?: string } | string;
  description?: { pt?: string; es?: string; en?: string } | string;
  handle?: { pt?: string; es?: string; en?: string } | string;
  published?: boolean;
  free_shipping?: boolean;
  requires_shipping?: boolean;
  canonical_url?: string;
  video_url?: string;
  seo_title?: { pt?: string; es?: string; en?: string } | string;
  seo_description?: { pt?: string; es?: string; en?: string } | string;
  brand?: string;
  created_at?: string;
  updated_at?: string;
  variants?: NuvemshopVariant[];
  images?: NuvemshopImage[];
  categories?: NuvemshopProductCategory[];
  // CSV fields (português)
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Preço'?: string;
  'Preço promocional'?: string;
  'Custo'?: string;
  'SKU'?: string;
  'Código de barras'?: string;
  'Peso (kg)'?: string;
  'Largura (cm)'?: string;
  'Altura (cm)'?: string;
  'Profundidade (cm)'?: string;
  'Estoque'?: string;
  'Ativo'?: string;
  'Destaque'?: string;
  'Imagem principal'?: string;
  'Imagens adicionais'?: string;
  'Categoria'?: string;
  'Tags'?: string;
  'Título SEO'?: string;
  'Descrição SEO'?: string;
}

export interface NuvemshopVariant {
  id?: number;
  image_id?: number;
  promotional_price?: string | number | null;
  price?: string | number;
  compare_at_price?: string | number | null;
  cost?: string | number | null;
  stock_management?: boolean;
  stock?: number | null;
  sku?: string;
  barcode?: string;
  weight?: string | number;
  width?: string | number;
  height?: string | number;
  depth?: string | number;
  values?: NuvemshopVariantValue[];
}

export interface NuvemshopVariantValue {
  pt?: string;
  es?: string;
  en?: string;
}

export interface NuvemshopImage {
  id?: number;
  src?: string;
  position?: number;
  alt?: string[];
}

export interface NuvemshopProductCategory {
  id?: number;
  name?: { pt?: string; es?: string; en?: string } | string;
  handle?: { pt?: string; es?: string; en?: string } | string;
}

export interface NuvemshopCustomer {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  identification?: string; // CPF/CNPJ
  billing_name?: string;
  billing_phone?: string;
  billing_address?: string;
  billing_number?: string;
  billing_floor?: string;
  billing_locality?: string;
  billing_city?: string;
  billing_province?: string;
  billing_zipcode?: string;
  billing_country?: string;
  default_address?: NuvemshopAddress;
  addresses?: NuvemshopAddress[];
  accepts_marketing?: boolean;
  note?: string;
  created_at?: string;
  // CSV fields (português)
  'Nome'?: string;
  'E-mail'?: string;
  'Telefone'?: string;
  'CPF/CNPJ'?: string;
  'Aceita marketing'?: string;
  'Observações'?: string;
  'Data de cadastro'?: string;
}

export interface NuvemshopAddress {
  address?: string;
  number?: string;
  floor?: string;
  locality?: string;
  city?: string;
  province?: string;
  zipcode?: string;
  country?: string;
  phone?: string;
  name?: string;
  default?: boolean;
}

export interface NuvemshopOrder {
  id?: number;
  number?: number;
  status?: string;
  payment_status?: string;
  shipping_status?: string;
  subtotal?: string | number;
  discount?: string | number;
  shipping?: string | number;
  total?: string | number;
  currency?: string;
  language?: string;
  gateway?: string;
  shipping_carrier_name?: string;
  shipping_tracking_number?: string;
  customer?: NuvemshopCustomer;
  shipping_address?: NuvemshopAddress;
  billing_address?: NuvemshopAddress;
  products?: NuvemshopOrderProduct[];
  note?: string;
  created_at?: string;
  paid_at?: string;
  shipped_at?: string;
  // CSV fields (português)
  'Número'?: string;
  'Status'?: string;
  'Status do pagamento'?: string;
  'Status do envio'?: string;
  'Subtotal'?: string;
  'Desconto'?: string;
  'Frete'?: string;
  'Total'?: string;
  'Cliente'?: string;
  'E-mail do cliente'?: string;
  'Telefone do cliente'?: string;
  'Data'?: string;
  'Código de rastreio'?: string;
  'Transportadora'?: string;
}

export interface NuvemshopOrderProduct {
  product_id?: number;
  variant_id?: number;
  name?: string;
  sku?: string;
  price?: string | number;
  quantity?: number;
}

export interface NuvemshopCategory {
  id?: number;
  name?: { pt?: string; es?: string; en?: string } | string;
  description?: { pt?: string; es?: string; en?: string } | string;
  handle?: { pt?: string; es?: string; en?: string } | string;
  parent?: number | null;
  subcategories?: number[];
  seo_title?: { pt?: string; es?: string; en?: string } | string;
  seo_description?: { pt?: string; es?: string; en?: string } | string;
  created_at?: string;
  updated_at?: string;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Categoria pai'?: string;
  'Ativa'?: string;
}

// Helper para extrair texto de objetos i18n
function getText(value: { pt?: string; es?: string; en?: string } | string | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.pt || value.es || value.en || '';
}

// Funções de normalização
export function normalizeNuvemshopProduct(raw: NuvemshopProduct): NormalizedProduct {
  const name = getText(raw.name) || raw['Nome'] || 'Produto sem nome';
  
  // Convert HTML to plain text
  const rawDescription = getText(raw.description) || raw['Descrição'] || null;
  const description = stripHtmlToText(rawDescription);
  
  const handle = getText(raw.handle) || raw['URL'] || slugify(name);
  
  const variant = raw.variants?.[0];
  const price = parseFloat(
    variant?.price?.toString() || 
    variant?.promotional_price?.toString() || 
    raw['Preço']?.replace(',', '.') || 
    '0'
  );
  const compareAtPrice = parseFloat(
    variant?.compare_at_price?.toString() || 
    raw['Preço promocional']?.replace(',', '.') || 
    '0'
  ) || null;
  const costPrice = parseFloat(
    variant?.cost?.toString() || 
    raw['Custo']?.replace(',', '.') || 
    '0'
  ) || null;
  
  // SKU - clean special chars
  const rawSku = variant?.sku || raw['SKU'] || null;
  const sku = cleanSku(rawSku);
  
  // Barcode - only numbers
  const rawBarcode = variant?.barcode || raw['Código de barras'] || null;
  const barcode = extractNumericOnly(rawBarcode);
  
  const weight = parseFloat(variant?.weight?.toString() || raw['Peso (kg)']?.replace(',', '.') || '0') || null;
  const width = parseFloat(variant?.width?.toString() || raw['Largura (cm)']?.replace(',', '.') || '0') || null;
  const height = parseFloat(variant?.height?.toString() || raw['Altura (cm)']?.replace(',', '.') || '0') || null;
  const depth = parseFloat(variant?.depth?.toString() || raw['Profundidade (cm)']?.replace(',', '.') || '0') || null;
  const stockQuantity = parseInt(variant?.stock?.toString() || raw['Estoque'] || '0', 10);
  
  const isActive = raw.published ?? raw['Ativo']?.toLowerCase() === 'sim';
  const isFeatured = raw['Destaque']?.toLowerCase() === 'sim';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.src || '',
        alt: img.alt?.[0] || null,
        is_primary: idx === 0,
        position: img.position || idx,
      });
    });
  } else {
    if (raw['Imagem principal']) {
      images.push({
        url: raw['Imagem principal'],
        alt: null,
        is_primary: true,
        position: 0,
      });
    }
    if (raw['Imagens adicionais']) {
      const additionalUrls = raw['Imagens adicionais'].split(',').map(u => u.trim());
      additionalUrls.forEach((url, idx) => {
        images.push({
          url,
          alt: null,
          is_primary: false,
          position: idx + 1,
        });
      });
    }
  }
  
  // Variantes
  const variants: NormalizedProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    raw.variants.forEach(v => {
      const options: Record<string, string> = {};
      v.values?.forEach((val, idx) => {
        const optionValue = getText(val);
        if (optionValue) {
          options[`Opção ${idx + 1}`] = optionValue;
        }
      });
      
      variants.push({
        name: Object.values(options).join(' / ') || 'Padrão',
        sku: v.sku || null,
        price: parseFloat(v.price?.toString() || '0'),
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price.toString()) : null,
        stock_quantity: v.stock || null,
        options,
      });
    });
  }
  
  // Categorias
  const categories: string[] = [];
  if (raw.categories && Array.isArray(raw.categories)) {
    raw.categories.forEach(cat => {
      const catHandle = getText(cat.handle) || slugify(getText(cat.name));
      if (catHandle) categories.push(catHandle);
    });
  } else if (raw['Categoria']) {
    const catSlugs = raw['Categoria'].split(',').map(c => slugify(c.trim()));
    categories.push(...catSlugs);
  }
  
  return {
    name,
    slug: handle,
    description,
    short_description: null,
    price,
    compare_at_price: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
    cost_price: costPrice,
    sku,
    barcode,
    weight,
    width,
    height,
    depth,
    stock_quantity: stockQuantity,
    is_featured: isFeatured,
    status: isActive ? 'active' : 'draft',
    seo_title: getText(raw.seo_title) || raw['Título SEO'] || null,
    seo_description: getText(raw.seo_description) || raw['Descrição SEO'] || null,
    images,
    variants,
    categories,
  };
}

export function normalizeNuvemshopCategory(raw: NuvemshopCategory): NormalizedCategory {
  const name = getText(raw.name) || raw['Nome'] || 'Categoria';
  const description = getText(raw.description) || raw['Descrição'] || null;
  const handle = getText(raw.handle) || raw['URL'] || slugify(name);
  const isActive = raw['Ativa']?.toLowerCase() !== 'não';
  
  return {
    name,
    slug: handle,
    description,
    image_url: null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: raw['Categoria pai'] ? slugify(raw['Categoria pai']) : null,
    seo_title: getText(raw.seo_title) || null,
    seo_description: getText(raw.seo_description) || null,
    sort_order: 0,
    is_active: isActive,
  };
}

export function normalizeNuvemshopCustomer(raw: NuvemshopCustomer): NormalizedCustomer {
  const email = raw.email || raw['E-mail'] || '';
  const name = raw.name || raw['Nome'] || 'Cliente';
  const phone = raw.phone || raw['Telefone'] || null;
  const cpf = raw.identification || raw['CPF/CNPJ'] || null;
  const acceptsMarketing = raw.accepts_marketing ?? raw['Aceita marketing']?.toLowerCase() === 'sim';
  const notes = raw.note || raw['Observações'] || null;
  
  const addresses: NormalizedAddress[] = [];
  const allAddresses = raw.addresses || (raw.default_address ? [raw.default_address] : []);
  
  allAddresses.forEach((addr, idx) => {
    addresses.push(normalizeNuvemshopAddress(addr, idx === 0));
  });
  
  // Endereço de faturamento (se diferente)
  if (raw.billing_address) {
    addresses.push({
      label: 'Cobrança',
      recipient_name: raw.billing_name || name,
      street: raw.billing_address || '',
      number: raw.billing_number || '',
      complement: raw.billing_floor || null,
      neighborhood: raw.billing_locality || '',
      city: raw.billing_city || '',
      state: raw.billing_province || '',
      postal_code: (raw.billing_zipcode || '').replace(/\D/g, ''),
      country: raw.billing_country || 'BR',
      is_default: false,
    });
  }
  
  return {
    email,
    full_name: name,
    phone: normalizePhone(phone),
    cpf: normalizeCpf(cpf),
    birth_date: null,
    gender: null,
    accepts_marketing: acceptsMarketing,
    status: 'active',
    addresses,
    tags: [],
    notes,
  };
}

export function normalizeNuvemshopAddress(raw: NuvemshopAddress, isDefault: boolean = false): NormalizedAddress {
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: raw.name || 'Destinatário',
    street: raw.address || '',
    number: raw.number || '',
    complement: raw.floor || null,
    neighborhood: raw.locality || '',
    city: raw.city || '',
    state: raw.province || '',
    postal_code: (raw.zipcode || '').replace(/\D/g, ''),
    country: raw.country || 'BR',
    is_default: raw.default ?? isDefault,
  };
}

export function normalizeNuvemshopOrder(raw: NuvemshopOrder): NormalizedOrder {
  const orderNumber = raw.number?.toString() || raw['Número'] || Date.now().toString();
  
  const subtotal = parseFloat(raw.subtotal?.toString() || raw['Subtotal']?.replace(',', '.') || '0');
  const discountTotal = parseFloat(raw.discount?.toString() || raw['Desconto']?.replace(',', '.') || '0');
  const shippingTotal = parseFloat(raw.shipping?.toString() || raw['Frete']?.replace(',', '.') || '0');
  const total = parseFloat(raw.total?.toString() || raw['Total']?.replace(',', '.') || '0');
  
  const items: NormalizedOrderItem[] = (raw.products || []).map(item => ({
    product_name: item.name || 'Produto',
    product_sku: item.sku || null,
    variant_name: null,
    quantity: item.quantity || 1,
    unit_price: parseFloat(item.price?.toString() || '0'),
    total_price: parseFloat(item.price?.toString() || '0') * (item.quantity || 1),
  }));
  
  return {
    order_number: orderNumber,
    status: mapNuvemshopStatus(raw.status || raw['Status'] || 'open'),
    payment_status: mapNuvemshopPaymentStatus(raw.payment_status || raw['Status do pagamento'] || 'pending'),
    payment_method: raw.gateway || null,
    shipping_status: raw.shipping_status || raw['Status do envio'] || null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: raw.currency || 'BRL',
    customer_email: raw.customer?.email || raw['E-mail do cliente'] || '',
    customer_name: raw.customer?.name || raw['Cliente'] || '',
    customer_phone: raw.customer?.phone || raw['Telefone do cliente'] || null,
    shipping_address: raw.shipping_address ? normalizeNuvemshopAddress(raw.shipping_address, true) : null,
    billing_address: raw.billing_address ? normalizeNuvemshopAddress(raw.billing_address, false) : null,
    items,
    notes: raw.note || null,
    created_at: raw.created_at || raw['Data'] || new Date().toISOString(),
    paid_at: raw.paid_at || null,
    shipped_at: raw.shipped_at || null,
    delivered_at: null,
    tracking_code: raw.shipping_tracking_number || raw['Código de rastreio'] || null,
    tracking_carrier: raw.shipping_carrier_name || raw['Transportadora'] || null,
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

function normalizeCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

function mapNuvemshopStatus(status: string): NormalizedOrder['status'] {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('cancel')) return 'cancelled';
  if (statusLower.includes('closed') || statusLower.includes('fechado')) return 'delivered';
  if (statusLower.includes('packed') || statusLower.includes('enviado')) return 'shipped';
  if (statusLower.includes('paid') || statusLower.includes('pago')) return 'paid';
  return 'pending';
}

function mapNuvemshopPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('paid') || statusLower.includes('pago') || statusLower.includes('approved')) return 'paid';
  if (statusLower.includes('refund') || statusLower.includes('reembols')) return 'refunded';
  if (statusLower.includes('cancel') || statusLower.includes('void')) return 'cancelled';
  if (statusLower.includes('fail') || statusLower.includes('recusado')) return 'failed';
  return 'pending';
}

// Mapeamento de campos (para referência e UI)
export const NUVEMSHOP_FIELD_MAPPING = {
  products: {
    'Nome': 'name',
    'Descrição': 'description',
    'URL': 'slug',
    'Preço': 'price',
    'Preço promocional': 'compare_at_price',
    'Custo': 'cost_price',
    'SKU': 'sku',
    'Código de barras': 'barcode',
    'Peso (kg)': 'weight',
    'Largura (cm)': 'width',
    'Altura (cm)': 'height',
    'Profundidade (cm)': 'depth',
    'Estoque': 'stock_quantity',
    'Ativo': 'status',
    'Destaque': 'is_featured',
    'Imagem principal': 'images',
    'Categoria': 'categories',
    'Título SEO': 'seo_title',
    'Descrição SEO': 'seo_description',
  },
  customers: {
    'Nome': 'full_name',
    'E-mail': 'email',
    'Telefone': 'phone',
    'CPF/CNPJ': 'cpf',
    'Aceita marketing': 'accepts_marketing',
    'Observações': 'notes',
  },
  orders: {
    'Número': 'order_number',
    'Status': 'status',
    'Status do pagamento': 'payment_status',
    'Status do envio': 'shipping_status',
    'Subtotal': 'subtotal',
    'Desconto': 'discount_total',
    'Frete': 'shipping_total',
    'Total': 'total',
    'Cliente': 'customer_name',
    'E-mail do cliente': 'customer_email',
    'Telefone do cliente': 'customer_phone',
    'Data': 'created_at',
    'Código de rastreio': 'tracking_code',
    'Transportadora': 'tracking_carrier',
  },
  categories: {
    'Nome': 'name',
    'Descrição': 'description',
    'URL': 'slug',
    'Categoria pai': 'parent_slug',
    'Ativa': 'is_active',
  },
};
