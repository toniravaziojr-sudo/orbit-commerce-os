// =============================================
// MAPEAMENTO YAMPI → FORMATO INTERNO
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

// Campos da Yampi (como vêm da API/CSV)
export interface YampiProduct {
  id?: number;
  sku?: string;
  name?: string;
  slug?: string;
  description?: string;
  short_description?: string;
  price?: number;
  price_compare?: number;
  cost?: number;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  quantity?: number;
  is_active?: boolean;
  is_featured?: boolean;
  brand_id?: number;
  images?: YampiImage[];
  skus?: YampiSku[];
  categories?: YampiProductCategory[];
  seo_title?: string;
  seo_description?: string;
  created_at?: { date: string };
  updated_at?: { date: string };
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'Descrição Curta'?: string;
  'Preço'?: string;
  'Preço Comparativo'?: string;
  'Custo'?: string;
  'SKU'?: string;
  'Peso'?: string;
  'Largura'?: string;
  'Altura'?: string;
  'Profundidade'?: string;
  'Estoque'?: string;
  'Ativo'?: string;
  'Destaque'?: string;
  'Categoria'?: string;
  'Imagem Principal'?: string;
  'Imagens'?: string;
  'Título SEO'?: string;
  'Descrição SEO'?: string;
}

export interface YampiImage {
  id?: number;
  url?: string;
  position?: number;
}

export interface YampiSku {
  id?: number;
  sku?: string;
  ean?: string;
  price?: number;
  price_compare?: number;
  cost?: number;
  quantity?: number;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  variations?: { name: string; value: string }[];
  images?: YampiImage[];
}

export interface YampiProductCategory {
  id?: number;
  name?: string;
  slug?: string;
}

export interface YampiCategory {
  id?: number;
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: number | null;
  image_url?: string;
  is_active?: boolean;
  seo_title?: string;
  seo_description?: string;
  position?: number;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Categoria Pai'?: string;
  'Imagem'?: string;
  'Ativa'?: string;
  'Posição'?: string;
}

export interface YampiCustomer {
  id?: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: { full_number?: string };
  cpf?: string;
  cnpj?: string;
  birth_date?: string;
  gender?: string;
  accepts_marketing?: boolean;
  notes?: string;
  addresses?: { data: YampiAddress[] };
  created_at?: { date: string };
  // CSV fields
  'Nome'?: string;
  'E-mail'?: string;
  'Telefone'?: string;
  'CPF'?: string;
  'CNPJ'?: string;
  'Data de Nascimento'?: string;
  'Sexo'?: string;
  'Newsletter'?: string;
  'Observações'?: string;
}

export interface YampiAddress {
  id?: number;
  receiver?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  is_default?: boolean;
}

export interface YampiOrder {
  id?: number;
  number?: number;
  status?: { alias?: string; name?: string };
  payment_status?: string;
  shipping_status?: string;
  value_products?: number;
  value_discount?: number;
  value_shipment?: number;
  value_total?: number;
  payment_method?: string;
  customer?: YampiCustomer;
  shipping_address?: YampiAddress;
  billing_address?: YampiAddress;
  items?: { data: YampiOrderItem[] };
  notes?: string;
  tracking_code?: string;
  tracking_url?: string;
  shipping_service?: string;
  created_at?: { date: string };
  paid_at?: { date: string };
  shipped_at?: { date: string };
  delivered_at?: { date: string };
  // CSV fields
  'Número'?: string;
  'Status'?: string;
  'Status Pagamento'?: string;
  'Status Envio'?: string;
  'Subtotal'?: string;
  'Desconto'?: string;
  'Frete'?: string;
  'Total'?: string;
  'Cliente'?: string;
  'E-mail Cliente'?: string;
  'Forma de Pagamento'?: string;
  'Código de Rastreio'?: string;
  'Data'?: string;
}

export interface YampiOrderItem {
  id?: number;
  sku_id?: number;
  product_id?: number;
  name?: string;
  sku?: string;
  quantity?: number;
  price?: number;
  total?: number;
}

// Funções de normalização
export function normalizeYampiProduct(raw: YampiProduct): NormalizedProduct {
  const name = raw.name || raw['Nome'] || 'Produto sem nome';
  const slug = raw.slug || slugify(name);
  const description = raw.description || raw['Descrição'] || null;
  const shortDescription = raw.short_description || raw['Descrição Curta'] || null;
  
  const price = raw.price ?? parseFloat(raw['Preço']?.replace(',', '.') || '0');
  const priceCompare = raw.price_compare ?? parseFloat(raw['Preço Comparativo']?.replace(',', '.') || '0');
  const costPrice = raw.cost ?? parseFloat(raw['Custo']?.replace(',', '.') || '0') || null;
  
  const sku = raw.sku || raw['SKU'] || null;
  const weight = raw.weight ?? parseFloat(raw['Peso']?.replace(',', '.') || '0') || null;
  const width = raw.width ?? parseFloat(raw['Largura']?.replace(',', '.') || '0') || null;
  const height = raw.height ?? parseFloat(raw['Altura']?.replace(',', '.') || '0') || null;
  const depth = raw.depth ?? parseFloat(raw['Profundidade']?.replace(',', '.') || '0') || null;
  const stockQuantity = raw.quantity ?? parseInt(raw['Estoque'] || '0', 10);
  
  const isActive = raw.is_active ?? raw['Ativo']?.toLowerCase() === 'sim';
  const isFeatured = raw.is_featured ?? raw['Destaque']?.toLowerCase() === 'sim';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.url || '',
        alt: null,
        is_primary: idx === 0,
        position: img.position ?? idx,
      });
    });
  } else {
    if (raw['Imagem Principal']) {
      images.push({ url: raw['Imagem Principal'], alt: null, is_primary: true, position: 0 });
    }
    if (raw['Imagens']) {
      const urls = raw['Imagens'].split(',').map(u => u.trim());
      urls.forEach((url, idx) => {
        images.push({ url, alt: null, is_primary: false, position: idx + 1 });
      });
    }
  }
  
  // Variantes (SKUs na Yampi)
  const variants: NormalizedProductVariant[] = [];
  if (raw.skus && Array.isArray(raw.skus)) {
    raw.skus.forEach(sku => {
      const options: Record<string, string> = {};
      sku.variations?.forEach(v => {
        options[v.name] = v.value;
      });
      
      variants.push({
        name: Object.values(options).join(' / ') || 'Padrão',
        sku: sku.sku || null,
        price: sku.price || price,
        compare_at_price: sku.price_compare && sku.price_compare > (sku.price || price) ? sku.price_compare : null,
        stock_quantity: sku.quantity || null,
        options,
      });
    });
  }
  
  // Categorias
  const categories: string[] = [];
  if (raw.categories && Array.isArray(raw.categories)) {
    raw.categories.forEach(cat => {
      if (cat.slug) categories.push(cat.slug);
      else if (cat.name) categories.push(slugify(cat.name));
    });
  } else if (raw['Categoria']) {
    const catSlugs = raw['Categoria'].split(',').map(c => slugify(c.trim()));
    categories.push(...catSlugs);
  }
  
  return {
    name,
    slug,
    description,
    short_description: shortDescription,
    price,
    compare_at_price: priceCompare > price ? priceCompare : null,
    cost_price: costPrice,
    sku,
    barcode: null,
    weight,
    width,
    height,
    depth,
    stock_quantity: stockQuantity,
    is_featured: isFeatured,
    status: isActive ? 'active' : 'draft',
    seo_title: raw.seo_title || raw['Título SEO'] || null,
    seo_description: raw.seo_description || raw['Descrição SEO'] || null,
    images,
    variants,
    categories,
  };
}

export function normalizeYampiCategory(raw: YampiCategory): NormalizedCategory {
  const name = raw.name || raw['Nome'] || 'Categoria';
  const slug = raw.slug || raw['URL'] || slugify(name);
  const description = raw.description || raw['Descrição'] || null;
  const isActive = raw.is_active ?? raw['Ativa']?.toLowerCase() !== 'não';
  const position = raw.position ?? parseInt(raw['Posição'] || '0', 10);
  
  return {
    name,
    slug,
    description,
    image_url: raw.image_url || raw['Imagem'] || null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: raw['Categoria Pai'] ? slugify(raw['Categoria Pai']) : null,
    seo_title: raw.seo_title || null,
    seo_description: raw.seo_description || null,
    sort_order: position,
    is_active: isActive,
  };
}

export function normalizeYampiCustomer(raw: YampiCustomer): NormalizedCustomer {
  const email = raw.email || raw['E-mail'] || '';
  const firstName = raw.first_name || '';
  const lastName = raw.last_name || '';
  const name = raw.name || raw['Nome'] || `${firstName} ${lastName}`.trim() || 'Cliente';
  const phone = raw.phone?.full_number || raw['Telefone'] || null;
  const cpf = raw.cpf || raw['CPF'] || null;
  const cnpj = raw.cnpj || raw['CNPJ'] || null;
  const birthDate = raw.birth_date || raw['Data de Nascimento'] || null;
  const gender = raw.gender || raw['Sexo'] || null;
  const notes = raw.notes || raw['Observações'] || null;
  const acceptsMarketing = raw.accepts_marketing ?? raw['Newsletter']?.toLowerCase() === 'sim';
  
  const addresses: NormalizedAddress[] = [];
  const addressList = raw.addresses?.data || [];
  addressList.forEach((addr, idx) => {
    addresses.push(normalizeYampiAddress(addr, addr.is_default ?? idx === 0));
  });
  
  return {
    email,
    full_name: name,
    phone: normalizePhone(phone),
    cpf: normalizeCpfCnpj(cpf || cnpj),
    birth_date: birthDate,
    gender: normalizeGender(gender),
    accepts_marketing: acceptsMarketing,
    status: 'active',
    addresses,
    tags: [],
    notes,
  };
}

export function normalizeYampiAddress(raw: YampiAddress, isDefault: boolean = false): NormalizedAddress {
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: raw.receiver || 'Destinatário',
    street: raw.street || '',
    number: raw.number || '',
    complement: raw.complement || null,
    neighborhood: raw.neighborhood || '',
    city: raw.city || '',
    state: raw.state || '',
    postal_code: (raw.zipcode || '').replace(/\D/g, ''),
    country: raw.country || 'BR',
    is_default: isDefault,
  };
}

export function normalizeYampiOrder(raw: YampiOrder): NormalizedOrder {
  const orderNumber = raw.number?.toString() || raw['Número'] || Date.now().toString();
  
  const subtotal = raw.value_products ?? (parseFloat(raw['Subtotal']?.replace(',', '.') || '0'));
  const discountTotal = raw.value_discount ?? (parseFloat(raw['Desconto']?.replace(',', '.') || '0'));
  const shippingTotal = raw.value_shipment ?? (parseFloat(raw['Frete']?.replace(',', '.') || '0'));
  const total = raw.value_total ?? (parseFloat(raw['Total']?.replace(',', '.') || '0'));
  
  const itemsList = raw.items?.data || [];
  const items: NormalizedOrderItem[] = itemsList.map(item => ({
    product_name: item.name || 'Produto',
    product_sku: item.sku || null,
    variant_name: null,
    quantity: item.quantity || 1,
    unit_price: item.price || 0,
    total_price: item.total || (item.price || 0) * (item.quantity || 1),
  }));
  
  const statusAlias = raw.status?.alias || raw['Status'] || 'pending';
  
  return {
    order_number: orderNumber,
    status: mapYampiStatus(statusAlias),
    payment_status: mapYampiPaymentStatus(raw.payment_status || raw['Status Pagamento'] || 'pending'),
    payment_method: raw.payment_method || raw['Forma de Pagamento'] || null,
    shipping_status: raw.shipping_status || raw['Status Envio'] || null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: 'BRL',
    customer_email: raw.customer?.email || raw['E-mail Cliente'] || '',
    customer_name: raw.customer?.name || raw['Cliente'] || '',
    customer_phone: raw.customer?.phone?.full_number || null,
    shipping_address: raw.shipping_address ? normalizeYampiAddress(raw.shipping_address, true) : null,
    billing_address: raw.billing_address ? normalizeYampiAddress(raw.billing_address, false) : null,
    items,
    notes: raw.notes || null,
    created_at: raw.created_at?.date || raw['Data'] || new Date().toISOString(),
    paid_at: raw.paid_at?.date || null,
    shipped_at: raw.shipped_at?.date || null,
    delivered_at: raw.delivered_at?.date || null,
    tracking_code: raw.tracking_code || raw['Código de Rastreio'] || null,
    tracking_carrier: raw.shipping_service || null,
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

function normalizeCpfCnpj(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

function normalizeGender(gender: string | null): string | null {
  if (!gender) return null;
  const g = gender.toLowerCase();
  if (g === 'm' || g === 'masculino' || g === 'male') return 'male';
  if (g === 'f' || g === 'feminino' || g === 'female') return 'female';
  return null;
}

function mapYampiStatus(status: string): NormalizedOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('entregue') || s.includes('delivered') || s.includes('completed')) return 'delivered';
  if (s.includes('enviado') || s.includes('shipped') || s.includes('transit')) return 'shipped';
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado') || s.includes('approved')) return 'paid';
  if (s.includes('reembolso') || s.includes('refund')) return 'refunded';
  return 'pending';
}

function mapYampiPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toLowerCase();
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado') || s.includes('approved')) return 'paid';
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('reembolso') || s.includes('refund')) return 'refunded';
  if (s.includes('recusado') || s.includes('fail') || s.includes('declined')) return 'failed';
  return 'pending';
}

export const YAMPI_FIELD_MAPPING = {
  products: {
    'Nome': 'name',
    'Descrição': 'description',
    'Descrição Curta': 'short_description',
    'Preço': 'price',
    'Preço Comparativo': 'compare_at_price',
    'Custo': 'cost_price',
    'SKU': 'sku',
    'Peso': 'weight',
    'Largura': 'width',
    'Altura': 'height',
    'Profundidade': 'depth',
    'Estoque': 'stock_quantity',
    'Ativo': 'status',
    'Destaque': 'is_featured',
    'Categoria': 'categories',
    'Imagem Principal': 'images',
    'Título SEO': 'seo_title',
    'Descrição SEO': 'seo_description',
  },
  customers: {
    'Nome': 'full_name',
    'E-mail': 'email',
    'Telefone': 'phone',
    'CPF': 'cpf',
    'Data de Nascimento': 'birth_date',
    'Sexo': 'gender',
    'Newsletter': 'accepts_marketing',
    'Observações': 'notes',
  },
  orders: {
    'Número': 'order_number',
    'Status': 'status',
    'Status Pagamento': 'payment_status',
    'Subtotal': 'subtotal',
    'Desconto': 'discount_total',
    'Frete': 'shipping_total',
    'Total': 'total',
    'Cliente': 'customer_name',
    'E-mail Cliente': 'customer_email',
    'Forma de Pagamento': 'payment_method',
    'Código de Rastreio': 'tracking_code',
    'Data': 'created_at',
  },
  categories: {
    'Nome': 'name',
    'Descrição': 'description',
    'URL': 'slug',
    'Categoria Pai': 'parent_slug',
    'Imagem': 'image_url',
    'Ativa': 'is_active',
    'Posição': 'sort_order',
  },
};
