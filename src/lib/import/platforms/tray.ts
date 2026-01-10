// =============================================
// MAPEAMENTO TRAY → FORMATO INTERNO
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

// Campos da Tray (como vêm da API/CSV)
export interface TrayProduct {
  id?: number;
  ean?: string;
  name?: string;
  ncm?: string;
  description?: string;
  description_small?: string;
  price?: string | number;
  cost_price?: string | number;
  promotional_price?: string | number;
  start_promotion?: string;
  end_promotion?: string;
  brand?: string;
  model?: string;
  weight?: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  stock?: number;
  category_id?: number;
  available?: number;
  availability?: string;
  reference?: string;
  hot?: number;
  release?: number;
  additional_button?: number;
  related_categories?: number[];
  release_date?: string;
  virtual_product?: number;
  ProductImage?: TrayProductImage[];
  Variant?: TrayVariant[];
  // CSV fields
  'Código'?: string;
  'Nome'?: string;
  'Descrição'?: string;
  'Descrição Curta'?: string;
  'Preço'?: string;
  'Preço Promocional'?: string;
  'Preço de Custo'?: string;
  'Estoque'?: string;
  'Peso'?: string;
  'Largura'?: string;
  'Altura'?: string;
  'Comprimento'?: string;
  'Categoria'?: string;
  'Marca'?: string;
  'EAN'?: string;
  'Referência'?: string;
  'Ativo'?: string;
  'Destaque'?: string;
  'Lançamento'?: string;
  'Imagem Principal'?: string;
  'Imagens Adicionais'?: string;
}

export interface TrayProductImage {
  http?: string;
  https?: string;
  thumbs?: { [key: string]: { http?: string; https?: string } };
}

export interface TrayVariant {
  id?: number;
  ean?: string;
  price?: string | number;
  cost_price?: string | number;
  stock?: number;
  minimum_stock?: number;
  reference?: string;
  weight?: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  start_promotion?: string;
  end_promotion?: string;
  promotional_price?: string | number;
  Sku?: TraySku[];
}

export interface TraySku {
  type?: string;
  value?: string;
}

export interface TrayCustomer {
  id?: number;
  name?: string;
  rg?: string;
  cpf?: string;
  phone?: string;
  cellphone?: string;
  birth_date?: string;
  gender?: string;
  email?: string;
  nickname?: string;
  observation?: string;
  type?: string;
  company_name?: string;
  cnpj?: string;
  state_inscription?: string;
  reseller?: number;
  discount?: number;
  blocked?: number;
  credit_limit?: string | number;
  indicator_id?: number;
  profile_customer_id?: number;
  last_sent_at?: string;
  last_purchase?: string;
  CustomerAddress?: TrayAddress[];
  // CSV fields
  'Nome'?: string;
  'E-mail'?: string;
  'CPF'?: string;
  'CNPJ'?: string;
  'Telefone'?: string;
  'Celular'?: string;
  'Data de Nascimento'?: string;
  'Sexo'?: string;
  'Newsletter'?: string;
  'Observação'?: string;
}

export interface TrayAddress {
  id?: number;
  customer_id?: number;
  recipient?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  type?: number;
  active?: number;
}

export interface TrayOrder {
  id?: number;
  status?: string;
  date?: string;
  hour?: string;
  customer_id?: number;
  partial_total?: string | number;
  taxes?: string | number;
  discount?: string | number;
  point_sale?: string;
  shipment?: string | number;
  shipment_value?: string | number;
  shipment_date?: string;
  delivered?: number;
  store_note?: string;
  customer_note?: string;
  partner_id?: number;
  discount_coupon?: string;
  payment_method_rate?: string | number;
  value_1?: string | number;
  payment_form?: string;
  sending_code?: string;
  sending_date?: string;
  billing_address?: string;
  delivery_time?: string;
  payment_date?: string;
  access_code?: string;
  shipment_integrator?: string;
  modified?: string;
  printed?: number;
  interest?: string | number;
  id_quotation?: string;
  estimated_delivery_date?: string;
  is_traceable?: number;
  Customer?: TrayCustomer;
  ProductsSold?: TrayOrderProduct[];
  MarketplaceOrder?: any;
  // CSV fields
  'Número'?: string;
  'Status'?: string;
  'Data'?: string;
  'Cliente'?: string;
  'E-mail'?: string;
  'Subtotal'?: string;
  'Desconto'?: string;
  'Frete'?: string;
  'Total'?: string;
  'Forma de Pagamento'?: string;
  'Código de Rastreio'?: string;
}

export interface TrayOrderProduct {
  id?: number;
  product_id?: number;
  variant_id?: number;
  name?: string;
  original_name?: string;
  virtual_product?: number;
  ean?: string;
  price?: string | number;
  cost_price?: string | number;
  quantity?: number;
  model?: string;
  reference?: string;
  weight?: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
}

export interface TrayCategory {
  id?: number;
  parent_id?: number;
  name?: string;
  description?: string;
  small_description?: string;
  slug?: string;
  order?: number;
  has_product?: number;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Categoria Pai'?: string;
  'Ordem'?: string;
  'Ativa'?: string;
}

// Funções de normalização
export function normalizeTrayProduct(raw: TrayProduct): NormalizedProduct {
  const name = raw.name || raw['Nome'] || 'Produto sem nome';
  const description = raw.description || raw['Descrição'] || null;
  const shortDescription = raw.description_small || raw['Descrição Curta'] || null;
  
  const price = parseFloat(raw.price?.toString() || raw['Preço']?.replace(',', '.') || '0');
  const promotionalPrice = parseFloat(raw.promotional_price?.toString() || raw['Preço Promocional']?.replace(',', '.') || '0');
  const costPrice = parseFloat(raw.cost_price?.toString() || raw['Preço de Custo']?.replace(',', '.') || '0') || null;
  
  const sku = raw.reference || raw['Referência'] || null;
  const barcode = raw.ean || raw['EAN'] || null;
  const weight = parseFloat(raw.weight?.toString() || raw['Peso']?.replace(',', '.') || '0') || null;
  const width = parseFloat(raw.width?.toString() || raw['Largura']?.replace(',', '.') || '0') || null;
  const height = parseFloat(raw.height?.toString() || raw['Altura']?.replace(',', '.') || '0') || null;
  const depth = parseFloat(raw.length?.toString() || raw['Comprimento']?.replace(',', '.') || '0') || null;
  const stockQuantity = parseInt(raw.stock?.toString() || raw['Estoque'] || '0', 10);
  
  const isActive = raw.available !== 0 && raw['Ativo']?.toLowerCase() !== 'não';
  const isFeatured = raw.hot === 1 || raw['Destaque']?.toLowerCase() === 'sim';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.ProductImage && Array.isArray(raw.ProductImage)) {
    raw.ProductImage.forEach((img, idx) => {
      const url = img.https || img.http || '';
      if (url) {
        images.push({
          url,
          alt: null,
          is_primary: idx === 0,
          position: idx,
        });
      }
    });
  } else if (raw['Imagem Principal']) {
    images.push({
      url: raw['Imagem Principal'],
      alt: null,
      is_primary: true,
      position: 0,
    });
    if (raw['Imagens Adicionais']) {
      const additionalUrls = raw['Imagens Adicionais'].split(',').map(u => u.trim());
      additionalUrls.forEach((url, idx) => {
        images.push({ url, alt: null, is_primary: false, position: idx + 1 });
      });
    }
  }
  
  // Variantes
  const variants: NormalizedProductVariant[] = [];
  if (raw.Variant && Array.isArray(raw.Variant)) {
    raw.Variant.forEach(v => {
      const options: Record<string, string> = {};
      v.Sku?.forEach(sku => {
        if (sku.type && sku.value) {
          options[sku.type] = sku.value;
        }
      });
      
      variants.push({
        name: Object.values(options).join(' / ') || 'Padrão',
        sku: v.reference || null,
        price: parseFloat(v.price?.toString() || '0'),
        compare_at_price: v.promotional_price ? parseFloat(v.promotional_price.toString()) : null,
        stock_quantity: v.stock || null,
        options,
      });
    });
  }
  
  // Categoria
  const categories: string[] = [];
  if (raw['Categoria']) {
    categories.push(slugify(raw['Categoria']));
  }
  
  return {
    name,
    slug: slugify(name),
    description,
    short_description: shortDescription,
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
    seo_title: null,
    seo_description: null,
    images,
    variants,
    categories,
  };
}

export function normalizeTrayCategory(raw: TrayCategory): NormalizedCategory {
  const name = raw.name || raw['Nome'] || 'Categoria';
  const description = raw.description || raw['Descrição'] || null;
  const slug = raw.slug || raw['URL'] || slugify(name);
  const isActive = raw['Ativa']?.toLowerCase() !== 'não';
  const sortOrder = parseInt(raw.order?.toString() || raw['Ordem'] || '0', 10);
  
  return {
    name,
    slug,
    description,
    image_url: null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: raw['Categoria Pai'] ? slugify(raw['Categoria Pai']) : null,
    seo_title: null,
    seo_description: null,
    sort_order: sortOrder,
    is_active: isActive,
  };
}

export function normalizeTrayCustomer(raw: TrayCustomer): NormalizedCustomer {
  const email = raw.email || raw['E-mail'] || '';
  const name = raw.name || raw['Nome'] || 'Cliente';
  const phone = raw.cellphone || raw.phone || raw['Celular'] || raw['Telefone'] || null;
  const cpf = raw.cpf || raw['CPF'] || null;
  const cnpj = raw.cnpj || raw['CNPJ'] || null;
  const birthDate = raw.birth_date || raw['Data de Nascimento'] || null;
  const gender = raw.gender || raw['Sexo'] || null;
  const notes = raw.observation || raw['Observação'] || null;
  
  const addresses: NormalizedAddress[] = [];
  if (raw.CustomerAddress && Array.isArray(raw.CustomerAddress)) {
    raw.CustomerAddress.forEach((addr, idx) => {
      addresses.push(normalizeTrayAddress(addr, idx === 0));
    });
  }
  
  return {
    email,
    full_name: name,
    phone: normalizePhone(phone),
    cpf: normalizeCpfCnpj(cpf || cnpj),
    birth_date: birthDate,
    gender: normalizeGender(gender),
    accepts_marketing: raw['Newsletter']?.toLowerCase() === 'sim',
    status: raw.blocked === 1 ? 'inactive' : 'active',
    addresses,
    tags: [],
    notes,
  };
}

export function normalizeTrayAddress(raw: TrayAddress, isDefault: boolean = false): NormalizedAddress {
  return {
    label: raw.type === 1 ? 'Cobrança' : 'Entrega',
    recipient_name: raw.recipient || 'Destinatário',
    street: raw.address || '',
    number: raw.number || '',
    complement: raw.complement || null,
    neighborhood: raw.neighborhood || '',
    city: raw.city || '',
    state: raw.state || '',
    postal_code: (raw.zip_code || '').replace(/\D/g, ''),
    country: raw.country || 'BR',
    is_default: isDefault,
  };
}

export function normalizeTrayOrder(raw: TrayOrder): NormalizedOrder {
  const orderNumber = raw.id?.toString() || raw['Número'] || Date.now().toString();
  
  const subtotal = parseFloat(raw.partial_total?.toString() || raw['Subtotal']?.replace(',', '.') || '0');
  const discountTotal = parseFloat(raw.discount?.toString() || raw['Desconto']?.replace(',', '.') || '0');
  const shippingTotal = parseFloat(raw.shipment_value?.toString() || raw['Frete']?.replace(',', '.') || '0');
  const total = parseFloat(raw.value_1?.toString() || raw['Total']?.replace(',', '.') || '0') || 
                (subtotal - discountTotal + shippingTotal);
  
  const items: NormalizedOrderItem[] = (raw.ProductsSold || []).map(item => ({
    product_name: item.name || item.original_name || 'Produto',
    product_sku: item.reference || null,
    variant_name: null,
    quantity: item.quantity || 1,
    unit_price: parseFloat(item.price?.toString() || '0'),
    total_price: parseFloat(item.price?.toString() || '0') * (item.quantity || 1),
  }));
  
  return {
    order_number: orderNumber,
    status: mapTrayStatus(raw.status || raw['Status'] || ''),
    payment_status: mapTrayPaymentStatus(raw.status || raw['Status'] || ''),
    payment_method: raw.payment_form || raw['Forma de Pagamento'] || null,
    shipping_status: raw.delivered === 1 ? 'delivered' : null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: 'BRL',
    customer_email: raw.Customer?.email || raw['E-mail'] || '',
    customer_name: raw.Customer?.name || raw['Cliente'] || '',
    customer_phone: raw.Customer?.cellphone || raw.Customer?.phone || null,
    shipping_address: null,
    billing_address: null,
    items,
    notes: raw.customer_note || raw.store_note || null,
    created_at: raw.date ? `${raw.date}T${raw.hour || '00:00:00'}` : new Date().toISOString(),
    paid_at: raw.payment_date || null,
    shipped_at: raw.sending_date || null,
    delivered_at: null,
    tracking_code: raw.sending_code || raw['Código de Rastreio'] || null,
    tracking_carrier: raw.shipment_integrator || null,
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

function mapTrayStatus(status: string): NormalizedOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('entregue') || s.includes('delivered')) return 'delivered';
  if (s.includes('enviado') || s.includes('shipped') || s.includes('transporte')) return 'shipped';
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado')) return 'paid';
  return 'pending';
}

function mapTrayPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toLowerCase();
  if (s.includes('pago') || s.includes('paid') || s.includes('aprovado')) return 'paid';
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('estornado') || s.includes('refund')) return 'refunded';
  return 'pending';
}

export const TRAY_FIELD_MAPPING = {
  products: {
    // Nome do produto
    'Nome': 'name',
    'name': 'name',
    'Produto': 'name',
    // Descrição
    'Descrição': 'description',
    'Descrição Completa': 'description',
    'description': 'description',
    // Descrição curta
    'Descrição Curta': 'short_description',
    'Descrição Simples': 'short_description',
    'Breve Descrição': 'short_description',
    'description_small': 'short_description',
    // Preço
    'Preço': 'price',
    'Preço (normal)': 'price',
    'price': 'price',
    // Preço promocional
    'Preço Promocional': 'compare_at_price',
    'Preço da Oferta': 'compare_at_price',
    'promotional_price': 'compare_at_price',
    // Custo
    'Preço de Custo': 'cost_price',
    'Custo': 'cost_price',
    'cost_price': 'cost_price',
    // SKU/Referência
    'Referência': 'sku',
    'Código do Produto': 'sku',
    'Código': 'sku',
    'reference': 'sku',
    // Código de barras
    'EAN': 'barcode',
    'GTIN': 'barcode',
    'Código de Barras': 'barcode',
    'ean': 'barcode',
    // Dimensões
    'Peso': 'weight',
    'Peso do Produto': 'weight',
    'weight': 'weight',
    'Largura': 'width',
    'width': 'width',
    'Altura': 'height',
    'height': 'height',
    'Comprimento': 'depth',
    'Profundidade': 'depth',
    'length': 'depth',
    // Estoque
    'Estoque': 'stock_quantity',
    'Estoque Atual': 'stock_quantity',
    'stock': 'stock_quantity',
    // Status
    'Ativo': 'status',
    'Disponível': 'status',
    'available': 'status',
    // Destaque
    'Destaque': 'is_featured',
    'hot': 'is_featured',
    // Lançamento
    'Lançamento': 'is_new',
    'release': 'is_new',
    // Categoria
    'Categoria': 'categories',
    'category_id': 'categories',
    // Marca
    'Marca': 'brand',
    'brand': 'brand',
    // Imagens
    'Imagem Principal': 'images',
    'Imagens Adicionais': 'images',
    // NCM
    'NCM': 'ncm',
    'ncm': 'ncm',
  },
  customers: {
    // Nome
    'Nome': 'full_name',
    'Nome do cliente': 'full_name',
    'name': 'full_name',
    // Email
    'E-mail': 'email',
    'Email': 'email',
    'email': 'email',
    // Documentos
    'CPF': 'cpf',
    'cpf': 'cpf',
    'CNPJ': 'cnpj',
    'cnpj': 'cnpj',
    'RG': 'rg',
    'rg': 'rg',
    'Inscrição Estadual': 'state_inscription',
    'IE': 'state_inscription',
    'state_inscription': 'state_inscription',
    // Razão Social
    'Razão Social': 'company_name',
    'Razão social': 'company_name',
    'company_name': 'company_name',
    // Tipo
    'Tipo': 'person_type',
    'type': 'person_type',
    // Telefone
    'Telefone': 'phone',
    'phone': 'phone',
    'Celular': 'cellphone',
    'cellphone': 'cellphone',
    // Nascimento
    'Data de Nascimento': 'birth_date',
    'birth_date': 'birth_date',
    // Gênero
    'Sexo': 'gender',
    'Gênero': 'gender',
    'gender': 'gender',
    // Newsletter
    'Newsletter': 'accepts_marketing',
    'Aceita marketing': 'accepts_marketing',
    // Observações
    'Observação': 'notes',
    'Observações': 'notes',
    'observation': 'notes',
  },
  orders: {
    // Número do pedido
    'Número': 'order_number',
    'Pedido': 'order_number',
    'id': 'order_number',
    // Status
    'Status': 'status',
    'Status pedido': 'status',
    'status': 'status',
    // Data
    'Data': 'created_at',
    'Data do pedido': 'created_at',
    'date': 'created_at',
    'Hora': 'created_at_time',
    'hour': 'created_at_time',
    // Cliente
    'Cliente': 'customer_name',
    'Nome do cliente': 'customer_name',
    'Destinatário': 'shipping_recipient',
    // Email
    'E-mail': 'customer_email',
    'E-mail do cliente': 'customer_email',
    // Telefone
    'Telefone': 'customer_phone',
    'Celular': 'customer_phone',
    // CPF/CNPJ
    'CPF': 'customer_cpf',
    'CNPJ': 'customer_cnpj',
    // Valores
    'Subtotal': 'subtotal',
    'Subtotal produtos': 'subtotal',
    'partial_total': 'subtotal',
    'Desconto': 'discount_total',
    'discount': 'discount_total',
    'Frete': 'shipping_total',
    'Frete valor': 'shipping_total',
    'shipment_value': 'shipping_total',
    'Frete tipo': 'shipping_method',
    'shipment': 'shipping_method',
    'Impostos': 'taxes_total',
    'taxes': 'taxes_total',
    'Total': 'total',
    'value_1': 'total',
    // Pagamento
    'Forma de Pagamento': 'payment_method',
    'Pagamento tipo': 'payment_method',
    'payment_form': 'payment_method',
    'Pagamento data': 'paid_at',
    'payment_date': 'paid_at',
    'Valor pagamento': 'payment_amount',
    // Cupom
    'Cupom de desconto': 'discount_code',
    'discount_coupon': 'discount_code',
    // Envio
    'Código de Rastreio': 'tracking_code',
    'Envio código': 'tracking_code',
    'sending_code': 'tracking_code',
    'Envio data': 'shipped_at',
    'sending_date': 'shipped_at',
    'Prazo máximo de envio': 'shipping_deadline',
    'Data estimada de entrega': 'estimated_delivery_at',
    'estimated_delivery_date': 'estimated_delivery_at',
    // Canal
    'Canal de venda': 'source',
    'point_sale': 'source',
    // Marketplace
    'Parceiro': 'marketplace',
    'partner_id': 'marketplace',
    'Vendedor ML': 'marketplace_seller',
    'Valor comissão': 'marketplace_commission',
    // Notas
    'Obs. cliente': 'notes',
    'customer_note': 'notes',
    'Obs. loja': 'notes_internal',
    'store_note': 'notes_internal',
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
    'Ordem': 'sort_order',
    'order': 'sort_order',
    'Ativa': 'is_active',
    'has_product': 'has_products',
  },
};
