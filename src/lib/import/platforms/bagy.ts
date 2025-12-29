// =============================================
// MAPEAMENTO BAGY → FORMATO INTERNO
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

// Campos da Bagy (como vêm da API/CSV)
export interface BagyProduct {
  id?: string;
  external_id?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  promotional_price?: number;
  cost?: number;
  sku?: string;
  barcode?: string;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  quantity?: number;
  is_active?: boolean;
  is_featured?: boolean;
  brand?: string;
  warranty?: string;
  images?: BagyImage[];
  variations?: BagyVariation[];
  categories?: BagyProductCategory[];
  seo_title?: string;
  seo_description?: string;
  created_at?: string;
  updated_at?: string;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'Preço'?: string;
  'Preço Promocional'?: string;
  'Custo'?: string;
  'SKU'?: string;
  'Código de Barras'?: string;
  'Peso'?: string;
  'Largura'?: string;
  'Altura'?: string;
  'Comprimento'?: string;
  'Estoque'?: string;
  'Ativo'?: string;
  'Destaque'?: string;
  'Marca'?: string;
  'Categoria'?: string;
  'Imagem Principal'?: string;
  'Imagens'?: string;
  'Título SEO'?: string;
  'Descrição SEO'?: string;
}

export interface BagyImage {
  id?: string;
  url?: string;
  position?: number;
  alt?: string;
}

export interface BagyVariation {
  id?: string;
  external_id?: string;
  name?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  promotional_price?: number;
  cost?: number;
  quantity?: number;
  weight?: number;
  options?: { name: string; value: string }[];
}

export interface BagyProductCategory {
  id?: string;
  name?: string;
  slug?: string;
}

export interface BagyCategory {
  id?: string;
  external_id?: string;
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: string | null;
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

export interface BagyCustomer {
  id?: string;
  external_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  birth_date?: string;
  gender?: string;
  newsletter?: boolean;
  notes?: string;
  addresses?: BagyAddress[];
  created_at?: string;
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

export interface BagyAddress {
  id?: string;
  name?: string;
  recipient?: string;
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

export interface BagyOrder {
  id?: string;
  number?: string;
  external_id?: string;
  status?: string;
  payment_status?: string;
  shipping_status?: string;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  total?: number;
  payment_method?: string;
  customer?: BagyCustomer;
  shipping_address?: BagyAddress;
  billing_address?: BagyAddress;
  items?: BagyOrderItem[];
  notes?: string;
  tracking_code?: string;
  tracking_url?: string;
  shipping_company?: string;
  created_at?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
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

export interface BagyOrderItem {
  id?: string;
  product_id?: string;
  variation_id?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  price?: number;
  total?: number;
}

// Funções de normalização
export function normalizeBagyProduct(raw: BagyProduct): NormalizedProduct {
  const name = raw.name || raw['Nome'] || 'Produto sem nome';
  const slug = raw.slug || slugify(name);
  const description = raw.description || raw['Descrição'] || null;
  
  const price = raw.price ?? parseFloat(raw['Preço']?.replace(',', '.') || '0');
  const promotionalPrice = raw.promotional_price ?? parseFloat(raw['Preço Promocional']?.replace(',', '.') || '0');
  const costPrice = raw.cost ?? parseFloat(raw['Custo']?.replace(',', '.') || '0') || null;
  
  const sku = raw.sku || raw['SKU'] || null;
  const barcode = raw.barcode || raw['Código de Barras'] || null;
  const weight = raw.weight ?? parseFloat(raw['Peso']?.replace(',', '.') || '0') || null;
  const width = raw.width ?? parseFloat(raw['Largura']?.replace(',', '.') || '0') || null;
  const height = raw.height ?? parseFloat(raw['Altura']?.replace(',', '.') || '0') || null;
  const depth = raw.length ?? parseFloat(raw['Comprimento']?.replace(',', '.') || '0') || null;
  const stockQuantity = raw.quantity ?? parseInt(raw['Estoque'] || '0', 10);
  
  const isActive = raw.is_active ?? raw['Ativo']?.toLowerCase() === 'sim';
  const isFeatured = raw.is_featured ?? raw['Destaque']?.toLowerCase() === 'sim';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.url || '',
        alt: img.alt || null,
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
  
  // Variantes
  const variants: NormalizedProductVariant[] = [];
  if (raw.variations && Array.isArray(raw.variations)) {
    raw.variations.forEach(v => {
      const options: Record<string, string> = {};
      v.options?.forEach(opt => {
        options[opt.name] = opt.value;
      });
      
      variants.push({
        name: v.name || Object.values(options).join(' / ') || 'Padrão',
        sku: v.sku || null,
        price: v.price || price,
        compare_at_price: v.promotional_price && v.price && v.price > v.promotional_price ? v.price : null,
        stock_quantity: v.quantity || null,
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
    short_description: null,
    price: promotionalPrice > 0 ? promotionalPrice : price,
    compare_at_price: promotionalPrice > 0 && price > promotionalPrice ? price : null,
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
    seo_title: raw.seo_title || raw['Título SEO'] || null,
    seo_description: raw.seo_description || raw['Descrição SEO'] || null,
    images,
    variants,
    categories,
  };
}

export function normalizeBagyCategory(raw: BagyCategory): NormalizedCategory {
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

export function normalizeBagyCustomer(raw: BagyCustomer): NormalizedCustomer {
  const email = raw.email || raw['E-mail'] || '';
  const name = raw.name || raw['Nome'] || 'Cliente';
  const phone = raw.phone || raw['Telefone'] || null;
  const cpf = raw.cpf || raw['CPF'] || null;
  const cnpj = raw.cnpj || raw['CNPJ'] || null;
  const birthDate = raw.birth_date || raw['Data de Nascimento'] || null;
  const gender = raw.gender || raw['Sexo'] || null;
  const notes = raw.notes || raw['Observações'] || null;
  const acceptsMarketing = raw.newsletter ?? raw['Newsletter']?.toLowerCase() === 'sim';
  
  const addresses: NormalizedAddress[] = [];
  if (raw.addresses && Array.isArray(raw.addresses)) {
    raw.addresses.forEach((addr, idx) => {
      addresses.push(normalizeBagyAddress(addr, addr.is_default ?? idx === 0));
    });
  }
  
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

export function normalizeBagyAddress(raw: BagyAddress, isDefault: boolean = false): NormalizedAddress {
  return {
    label: raw.name || (isDefault ? 'Principal' : 'Endereço'),
    recipient_name: raw.recipient || 'Destinatário',
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

export function normalizeBagyOrder(raw: BagyOrder): NormalizedOrder {
  const orderNumber = raw.number || raw['Número'] || Date.now().toString();
  
  const subtotal = raw.subtotal ?? (parseFloat(raw['Subtotal']?.replace(',', '.') || '0'));
  const discountTotal = raw.discount ?? (parseFloat(raw['Desconto']?.replace(',', '.') || '0'));
  const shippingTotal = raw.shipping ?? (parseFloat(raw['Frete']?.replace(',', '.') || '0'));
  const total = raw.total ?? (parseFloat(raw['Total']?.replace(',', '.') || '0'));
  
  const items: NormalizedOrderItem[] = (raw.items || []).map(item => ({
    product_name: item.name || 'Produto',
    product_sku: item.sku || null,
    variant_name: null,
    quantity: item.quantity || 1,
    unit_price: item.price || 0,
    total_price: item.total || (item.price || 0) * (item.quantity || 1),
  }));
  
  return {
    order_number: orderNumber,
    status: mapBagyStatus(raw.status || raw['Status'] || 'pending'),
    payment_status: mapBagyPaymentStatus(raw.payment_status || raw['Status Pagamento'] || 'pending'),
    payment_method: raw.payment_method || raw['Forma de Pagamento'] || null,
    shipping_status: raw.shipping_status || raw['Status Envio'] || null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: 'BRL',
    customer_email: raw.customer?.email || raw['E-mail Cliente'] || '',
    customer_name: raw.customer?.name || raw['Cliente'] || '',
    customer_phone: raw.customer?.phone || null,
    shipping_address: raw.shipping_address ? normalizeBagyAddress(raw.shipping_address, true) : null,
    billing_address: raw.billing_address ? normalizeBagyAddress(raw.billing_address, false) : null,
    items,
    notes: raw.notes || null,
    created_at: raw.created_at || raw['Data'] || new Date().toISOString(),
    paid_at: raw.paid_at || null,
    shipped_at: raw.shipped_at || null,
    delivered_at: raw.delivered_at || null,
    tracking_code: raw.tracking_code || raw['Código de Rastreio'] || null,
    tracking_carrier: raw.shipping_company || null,
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

function mapBagyStatus(status: string): NormalizedOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('entregue') || s.includes('delivered')) return 'delivered';
  if (s.includes('enviado') || s.includes('shipped')) return 'shipped';
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado')) return 'paid';
  if (s.includes('reembolso') || s.includes('refund')) return 'refunded';
  return 'pending';
}

function mapBagyPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toLowerCase();
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado')) return 'paid';
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('reembolso') || s.includes('refund')) return 'refunded';
  if (s.includes('recusado') || s.includes('fail')) return 'failed';
  return 'pending';
}

export const BAGY_FIELD_MAPPING = {
  products: {
    'Nome': 'name',
    'Descrição': 'description',
    'Preço': 'price',
    'Preço Promocional': 'compare_at_price',
    'Custo': 'cost_price',
    'SKU': 'sku',
    'Código de Barras': 'barcode',
    'Peso': 'weight',
    'Largura': 'width',
    'Altura': 'height',
    'Comprimento': 'depth',
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
