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

import { 
  stripHtmlToText, 
  extractNumericOnly, 
  normalizePhone, 
  normalizeCpfCnpj, 
  normalizeGender 
} from '../utils';

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
  
  // Get raw descriptions from source
  const rawDescription = raw.description || raw['Descrição'] || null;
  const rawShortDescription = raw.short_description || raw['Descrição Curta'] || null;
  
  // Convert HTML to plain text
  // If there's no short_description, use the full description converted to plain text
  // If there IS short_description, keep both (short as-is, full converted)
  const descriptionPlain = stripHtmlToText(rawDescription);
  const shortDescriptionPlain = stripHtmlToText(rawShortDescription);
  
  // Final description: if source only has one field, use it as the full description
  const description = descriptionPlain;
  const shortDescription = shortDescriptionPlain;
  
  const price = raw.price ?? parseFloat(raw['Preço']?.replace(',', '.') || '0');
  const priceCompare = raw.price_compare ?? parseFloat(raw['Preço Comparativo']?.replace(',', '.') || '0');
  const costPrice = raw.cost !== undefined ? raw.cost : (parseFloat(raw['Custo']?.replace(',', '.') || '0') || null);
  
  // SKU can be alphanumeric, just clean special chars
  const rawSku = raw.sku || raw['SKU'] || null;
  const sku = rawSku ? rawSku.replace(/['"]/g, '').trim() : null;
  
  // Get barcode/GTIN from SKU data (Yampi stores EAN in SKU variants)
  let barcode: string | null = null;
  if (raw.skus && Array.isArray(raw.skus) && raw.skus.length > 0) {
    const firstSkuEan = raw.skus[0]?.ean;
    if (firstSkuEan) {
      barcode = extractNumericOnly(firstSkuEan);
    }
  }
  
  const weight = raw.weight !== undefined ? raw.weight : (parseFloat(raw['Peso']?.replace(',', '.') || '0') || null);
  const width = raw.width !== undefined ? raw.width : (parseFloat(raw['Largura']?.replace(',', '.') || '0') || null);
  const height = raw.height !== undefined ? raw.height : (parseFloat(raw['Altura']?.replace(',', '.') || '0') || null);
  const depth = raw.depth !== undefined ? raw.depth : (parseFloat(raw['Profundidade']?.replace(',', '.') || '0') || null);
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
    // Nome
    'Nome': 'name',
    'Nome do produto': 'name',
    'name': 'name',
    // Descrição
    'Descrição': 'description',
    'Descrição completa': 'description',
    'description': 'description',
    // Descrição curta
    'Descrição Curta': 'short_description',
    'short_description': 'short_description',
    // Especificações técnicas
    'Especificações técnicas': 'technical_specs',
    'specifications': 'technical_specs',
    // Preço
    'Preço': 'price',
    'Preço de venda': 'price',
    'price': 'price',
    // Preço comparativo
    'Preço Comparativo': 'compare_at_price',
    'Preço promocional': 'compare_at_price',
    'price_compare': 'compare_at_price',
    // Custo
    'Custo': 'cost_price',
    'Preço de custo': 'cost_price',
    'cost': 'cost_price',
    // SKU
    'SKU': 'sku',
    'Código SKU': 'sku',
    'sku': 'sku',
    // Código de barras
    'EAN': 'barcode',
    'GTIN': 'barcode',
    'ean': 'barcode',
    // Dimensões
    'Peso': 'weight',
    'Peso do produto': 'weight',
    'Peso (kg)': 'weight',
    'weight': 'weight',
    'Largura': 'width',
    'Largura (cm)': 'width',
    'width': 'width',
    'Altura': 'height',
    'Altura (cm)': 'height',
    'height': 'height',
    'Profundidade': 'depth',
    'Comprimento': 'depth',
    'Comprimento (cm)': 'depth',
    'depth': 'depth',
    // Estoque
    'Estoque': 'stock_quantity',
    'Quantidade em estoque': 'stock_quantity',
    'quantity': 'stock_quantity',
    // Estoque mínimo
    'Estoque mínimo': 'min_stock',
    'min_quantity': 'min_stock',
    // Gerenciar estoque
    'Estoque gerenciado pelo sistema': 'manage_stock',
    // Ação quando esgotado
    'O que fazer quando o produto estiver com estoque zerado': 'out_of_stock_action',
    // Status
    'Ativo': 'status',
    'Produto ativo': 'status',
    'is_active': 'status',
    // Disponível
    'Produto disponível para a venda': 'is_available',
    'Disponibilidade em estoque': 'availability_text',
    // Destaque
    'Destaque': 'is_featured',
    'is_featured': 'is_featured',
    // Lançamento
    'Produto lançamento': 'is_new',
    // Marca
    'Marca': 'brand',
    'Código da marca': 'brand_id',
    'brand_id': 'brand_id',
    // Categoria
    'Categoria': 'categories',
    'Códigos das categorias': 'category_ids',
    'categories': 'categories',
    // Imagens
    'Imagem Principal': 'images',
    'URL do youtube': 'video_url',
    // SEO
    'Título SEO': 'seo_title',
    'Título da página': 'seo_title',
    'seo_title': 'seo_title',
    'Descrição SEO': 'seo_description',
    'Descrição da página': 'seo_description',
    'seo_description': 'seo_description',
    // Tags
    'Termos para pesquisa': 'tags',
    'Palavras-chave da página': 'seo_keywords',
    // Slug
    'Slug do produto': 'slug',
    'slug': 'slug',
  },
  customers: {
    // Nome
    'Nome': 'full_name',
    'name': 'full_name',
    'first_name': 'first_name',
    'last_name': 'last_name',
    // Email
    'E-mail': 'email',
    'Email': 'email',
    'email': 'email',
    // Telefone
    'Telefone': 'phone',
    'Tel. fixo': 'phone',
    'phone': 'phone',
    'Celular': 'cellphone',
    'cellphone': 'cellphone',
    // Documentos
    'CPF': 'cpf',
    'cpf': 'cpf',
    'CNPJ': 'cnpj',
    'cnpj': 'cnpj',
    'RG': 'rg',
    'rg': 'rg',
    'IE': 'state_inscription',
    'Inscrição Estadual': 'state_inscription',
    // Razão Social
    'Razão social': 'company_name',
    'company_name': 'company_name',
    // Tipo
    'Tipo': 'person_type',
    'type': 'person_type',
    // Nascimento
    'Data de Nascimento': 'birth_date',
    'Data de nascimento': 'birth_date',
    'birth_date': 'birth_date',
    // Gênero
    'Sexo': 'gender',
    'gender': 'gender',
    // Newsletter
    'Newsletter': 'accepts_marketing',
    'accepts_marketing': 'accepts_marketing',
    // Observações
    'Observações': 'notes',
    'notes': 'notes',
    // Pedidos
    'N˚ de pedidos': 'total_orders',
    'Total de pedidos': 'total_spent',
    'orders_count': 'total_orders',
    // Última compra
    'Última compra': 'last_order_date',
    'Total da última compra': 'last_order_total',
    // Código
    'Código': 'external_id',
    'id': 'external_id',
  },
  orders: {
    // Número
    'Número': 'order_number',
    'number': 'order_number',
    // Status
    'Status': 'status',
    'status': 'status',
    // Status pagamento
    'Status Pagamento': 'payment_status',
    'payment_status': 'payment_status',
    // Status envio
    'Status Envio': 'shipping_status',
    'shipping_status': 'shipping_status',
    // Valores
    'Subtotal': 'subtotal',
    'value_products': 'subtotal',
    'Desconto': 'discount_total',
    'value_discount': 'discount_total',
    'Frete': 'shipping_total',
    'value_shipment': 'shipping_total',
    'Total': 'total',
    'value_total': 'total',
    // Cliente
    'Cliente': 'customer_name',
    'customer_name': 'customer_name',
    'E-mail Cliente': 'customer_email',
    'customer_email': 'customer_email',
    // Pagamento
    'Forma de Pagamento': 'payment_method',
    'payment_method': 'payment_method',
    // Rastreio
    'Código de Rastreio': 'tracking_code',
    'tracking_code': 'tracking_code',
    'URL de Rastreio': 'tracking_url',
    'tracking_url': 'tracking_url',
    'Transportadora': 'tracking_carrier',
    'shipping_service': 'tracking_carrier',
    // Data
    'Data': 'created_at',
    'created_at': 'created_at',
    // Notas
    'Observações': 'notes',
    'notes': 'notes',
  },
  categories: {
    'Nome': 'name',
    'name': 'name',
    'Descrição': 'description',
    'description': 'description',
    'URL': 'slug',
    'slug': 'slug',
    'Categoria Pai': 'parent_slug',
    'parent_id': 'parent_slug',
    'Imagem': 'image_url',
    'image_url': 'image_url',
    'Ativa': 'is_active',
    'is_active': 'is_active',
    'Posição': 'sort_order',
    'position': 'sort_order',
  },
};
