// =============================================
// MAPEAMENTO LOJA INTEGRADA → FORMATO INTERNO
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

// Campos da Loja Integrada (como vêm da API/CSV)
export interface LojaIntegradaProduct {
  id?: number;
  sku?: string;
  nome?: string;
  slug?: string;
  descricao_completa?: string;
  descricao?: string;
  preco_venda?: number;
  preco_custo?: number;
  preco_promocional?: number;
  peso?: number;
  largura?: number;
  altura?: number;
  profundidade?: number;
  estoque?: number;
  ativo?: boolean;
  destaque?: boolean;
  marca?: string;
  categorias?: LojaIntegradaProductCategory[];
  imagens?: LojaIntegradaImage[];
  variacoes?: LojaIntegradaVariation[];
  seo_title?: string;
  seo_description?: string;
  criado_em?: string;
  atualizado_em?: string;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'Descrição Completa'?: string;
  'Preço'?: string;
  'Preço Promocional'?: string;
  'Preço de Custo'?: string;
  'SKU'?: string;
  'Peso'?: string;
  'Largura'?: string;
  'Altura'?: string;
  'Profundidade'?: string;
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

export interface LojaIntegradaImage {
  id?: number;
  url?: string;
  posicao?: number;
  principal?: boolean;
}

export interface LojaIntegradaVariation {
  id?: number;
  sku?: string;
  preco?: number;
  preco_promocional?: number;
  estoque?: number;
  peso?: number;
  valores?: { tipo?: string; valor?: string }[];
}

export interface LojaIntegradaProductCategory {
  id?: number;
  nome?: string;
  slug?: string;
}

export interface LojaIntegradaCategory {
  id?: number;
  nome?: string;
  slug?: string;
  descricao?: string;
  pai_id?: number | null;
  imagem_url?: string;
  ativo?: boolean;
  seo_title?: string;
  seo_description?: string;
  ordem?: number;
  // CSV fields
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Categoria Pai'?: string;
  'Imagem'?: string;
  'Ativo'?: string;
  'Ordem'?: string;
}

export interface LojaIntegradaCustomer {
  id?: number;
  nome?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  cpf?: string;
  cnpj?: string;
  data_nascimento?: string;
  sexo?: string;
  aceita_newsletter?: boolean;
  observacoes?: string;
  enderecos?: LojaIntegradaAddress[];
  criado_em?: string;
  // CSV fields
  'Nome'?: string;
  'E-mail'?: string;
  'Telefone'?: string;
  'Celular'?: string;
  'CPF'?: string;
  'CNPJ'?: string;
  'Data de Nascimento'?: string;
  'Sexo'?: string;
  'Newsletter'?: string;
  'Observações'?: string;
}

export interface LojaIntegradaAddress {
  id?: number;
  destinatario?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
  principal?: boolean;
}

export interface LojaIntegradaOrder {
  id?: number;
  numero?: string;
  situacao?: string;
  situacao_pagamento?: string;
  situacao_envio?: string;
  valor_subtotal?: number;
  valor_desconto?: number;
  valor_frete?: number;
  valor_total?: number;
  meio_pagamento?: string;
  cliente?: LojaIntegradaCustomer;
  endereco_entrega?: LojaIntegradaAddress;
  endereco_cobranca?: LojaIntegradaAddress;
  itens?: LojaIntegradaOrderItem[];
  observacoes?: string;
  codigo_rastreio?: string;
  transportadora?: string;
  criado_em?: string;
  pago_em?: string;
  enviado_em?: string;
  entregue_em?: string;
  // CSV fields
  'Número'?: string;
  'Situação'?: string;
  'Situação Pagamento'?: string;
  'Situação Envio'?: string;
  'Subtotal'?: string;
  'Desconto'?: string;
  'Frete'?: string;
  'Total'?: string;
  'Cliente'?: string;
  'E-mail Cliente'?: string;
  'Meio de Pagamento'?: string;
  'Código de Rastreio'?: string;
  'Data'?: string;
}

export interface LojaIntegradaOrderItem {
  id?: number;
  produto_id?: number;
  variacao_id?: number;
  nome?: string;
  sku?: string;
  quantidade?: number;
  preco?: number;
  total?: number;
}

// Funções de normalização
export function normalizeLojaIntegradaProduct(raw: LojaIntegradaProduct): NormalizedProduct {
  const name = raw.nome || raw['Nome'] || 'Produto sem nome';
  const slug = raw.slug || slugify(name);
  const description = raw.descricao_completa || raw['Descrição Completa'] || raw.descricao || raw['Descrição'] || null;
  const shortDescription = raw.descricao || raw['Descrição'] || null;
  
  const price = raw.preco_venda ?? parseFloat(raw['Preço']?.replace(',', '.') || '0');
  const promotionalPrice = raw.preco_promocional ?? parseFloat(raw['Preço Promocional']?.replace(',', '.') || '0');
  const costPrice = raw.preco_custo ?? parseFloat(raw['Preço de Custo']?.replace(',', '.') || '0') || null;
  
  const sku = raw.sku || raw['SKU'] || null;
  const weight = raw.peso ?? parseFloat(raw['Peso']?.replace(',', '.') || '0') || null;
  const width = raw.largura ?? parseFloat(raw['Largura']?.replace(',', '.') || '0') || null;
  const height = raw.altura ?? parseFloat(raw['Altura']?.replace(',', '.') || '0') || null;
  const depth = raw.profundidade ?? parseFloat(raw['Profundidade']?.replace(',', '.') || '0') || null;
  const stockQuantity = raw.estoque ?? parseInt(raw['Estoque'] || '0', 10);
  
  const isActive = raw.ativo ?? raw['Ativo']?.toLowerCase() === 'sim';
  const isFeatured = raw.destaque ?? raw['Destaque']?.toLowerCase() === 'sim';
  
  // Imagens
  const images: NormalizedProductImage[] = [];
  if (raw.imagens && Array.isArray(raw.imagens)) {
    raw.imagens.forEach((img, idx) => {
      images.push({
        url: img.url || '',
        alt: null,
        is_primary: img.principal ?? idx === 0,
        position: img.posicao ?? idx,
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
  if (raw.variacoes && Array.isArray(raw.variacoes)) {
    raw.variacoes.forEach(v => {
      const options: Record<string, string> = {};
      v.valores?.forEach(val => {
        if (val.tipo && val.valor) {
          options[val.tipo] = val.valor;
        }
      });
      
      variants.push({
        name: Object.values(options).join(' / ') || 'Padrão',
        sku: v.sku || null,
        price: v.preco || price,
        compare_at_price: v.preco_promocional && v.preco && v.preco > v.preco_promocional ? v.preco : null,
        stock_quantity: v.estoque || null,
        options,
      });
    });
  }
  
  // Categorias
  const categories: string[] = [];
  if (raw.categorias && Array.isArray(raw.categorias)) {
    raw.categorias.forEach(cat => {
      if (cat.slug) categories.push(cat.slug);
      else if (cat.nome) categories.push(slugify(cat.nome));
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
    price: promotionalPrice > 0 ? promotionalPrice : price,
    compare_at_price: promotionalPrice > 0 && price > promotionalPrice ? price : null,
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

export function normalizeLojaIntegradaCategory(raw: LojaIntegradaCategory): NormalizedCategory {
  const name = raw.nome || raw['Nome'] || 'Categoria';
  const slug = raw.slug || raw['URL'] || slugify(name);
  const description = raw.descricao || raw['Descrição'] || null;
  const isActive = raw.ativo ?? raw['Ativo']?.toLowerCase() !== 'não';
  const sortOrder = raw.ordem ?? parseInt(raw['Ordem'] || '0', 10);
  
  return {
    name,
    slug,
    description,
    image_url: raw.imagem_url || raw['Imagem'] || null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: raw['Categoria Pai'] ? slugify(raw['Categoria Pai']) : null,
    seo_title: raw.seo_title || null,
    seo_description: raw.seo_description || null,
    sort_order: sortOrder,
    is_active: isActive,
  };
}

export function normalizeLojaIntegradaCustomer(raw: LojaIntegradaCustomer): NormalizedCustomer {
  const email = raw.email || raw['E-mail'] || '';
  const name = raw.nome || raw['Nome'] || 'Cliente';
  const phone = raw.celular || raw.telefone || raw['Celular'] || raw['Telefone'] || null;
  const cpf = raw.cpf || raw['CPF'] || null;
  const cnpj = raw.cnpj || raw['CNPJ'] || null;
  const birthDate = raw.data_nascimento || raw['Data de Nascimento'] || null;
  const gender = raw.sexo || raw['Sexo'] || null;
  const notes = raw.observacoes || raw['Observações'] || null;
  const acceptsMarketing = raw.aceita_newsletter ?? raw['Newsletter']?.toLowerCase() === 'sim';
  
  const addresses: NormalizedAddress[] = [];
  if (raw.enderecos && Array.isArray(raw.enderecos)) {
    raw.enderecos.forEach((addr, idx) => {
      addresses.push(normalizeLojaIntegradaAddress(addr, addr.principal ?? idx === 0));
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

export function normalizeLojaIntegradaAddress(raw: LojaIntegradaAddress, isDefault: boolean = false): NormalizedAddress {
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: raw.destinatario || 'Destinatário',
    street: raw.endereco || '',
    number: raw.numero || '',
    complement: raw.complemento || null,
    neighborhood: raw.bairro || '',
    city: raw.cidade || '',
    state: raw.estado || '',
    postal_code: (raw.cep || '').replace(/\D/g, ''),
    country: raw.pais || 'BR',
    is_default: isDefault,
  };
}

export function normalizeLojaIntegradaOrder(raw: LojaIntegradaOrder): NormalizedOrder {
  const orderNumber = raw.numero || raw['Número'] || Date.now().toString();
  
  const subtotal = raw.valor_subtotal ?? (parseFloat(raw['Subtotal']?.replace(',', '.') || '0'));
  const discountTotal = raw.valor_desconto ?? (parseFloat(raw['Desconto']?.replace(',', '.') || '0'));
  const shippingTotal = raw.valor_frete ?? (parseFloat(raw['Frete']?.replace(',', '.') || '0'));
  const total = raw.valor_total ?? (parseFloat(raw['Total']?.replace(',', '.') || '0'));
  
  const items: NormalizedOrderItem[] = (raw.itens || []).map(item => ({
    product_name: item.nome || 'Produto',
    product_sku: item.sku || null,
    variant_name: null,
    quantity: item.quantidade || 1,
    unit_price: item.preco || 0,
    total_price: item.total || (item.preco || 0) * (item.quantidade || 1),
  }));
  
  return {
    order_number: orderNumber,
    status: mapLojaIntegradaStatus(raw.situacao || raw['Situação'] || 'pendente'),
    payment_status: mapLojaIntegradaPaymentStatus(raw.situacao_pagamento || raw['Situação Pagamento'] || 'pendente'),
    payment_method: raw.meio_pagamento || raw['Meio de Pagamento'] || null,
    shipping_status: raw.situacao_envio || raw['Situação Envio'] || null,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: 'BRL',
    customer_email: raw.cliente?.email || raw['E-mail Cliente'] || '',
    customer_name: raw.cliente?.nome || raw['Cliente'] || '',
    customer_phone: raw.cliente?.celular || raw.cliente?.telefone || null,
    shipping_address: raw.endereco_entrega ? normalizeLojaIntegradaAddress(raw.endereco_entrega, true) : null,
    billing_address: raw.endereco_cobranca ? normalizeLojaIntegradaAddress(raw.endereco_cobranca, false) : null,
    items,
    notes: raw.observacoes || null,
    created_at: raw.criado_em || raw['Data'] || new Date().toISOString(),
    paid_at: raw.pago_em || null,
    shipped_at: raw.enviado_em || null,
    delivered_at: raw.entregue_em || null,
    tracking_code: raw.codigo_rastreio || raw['Código de Rastreio'] || null,
    tracking_carrier: raw.transportadora || null,
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

function mapLojaIntegradaStatus(status: string): NormalizedOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('entregue') || s.includes('conclu')) return 'delivered';
  if (s.includes('enviado') || s.includes('transito') || s.includes('transit')) return 'shipped';
  if (s.includes('pago') || s.includes('aprovado')) return 'paid';
  if (s.includes('reembolso') || s.includes('estorn')) return 'refunded';
  return 'pending';
}

function mapLojaIntegradaPaymentStatus(status: string): NormalizedOrder['payment_status'] {
  const s = status.toLowerCase();
  if (s.includes('pago') || s.includes('aprovado') || s.includes('confirmado')) return 'paid';
  if (s.includes('cancelado') || s.includes('cancel')) return 'cancelled';
  if (s.includes('reembolso') || s.includes('estorn')) return 'refunded';
  if (s.includes('recusado') || s.includes('negado')) return 'failed';
  return 'pending';
}

export const LOJA_INTEGRADA_FIELD_MAPPING = {
  products: {
    'Nome': 'name',
    'Descrição': 'short_description',
    'Descrição Completa': 'description',
    'Preço': 'price',
    'Preço Promocional': 'compare_at_price',
    'Preço de Custo': 'cost_price',
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
    'Celular': 'phone',
    'CPF': 'cpf',
    'Data de Nascimento': 'birth_date',
    'Sexo': 'gender',
    'Newsletter': 'accepts_marketing',
    'Observações': 'notes',
  },
  orders: {
    'Número': 'order_number',
    'Situação': 'status',
    'Situação Pagamento': 'payment_status',
    'Subtotal': 'subtotal',
    'Desconto': 'discount_total',
    'Frete': 'shipping_total',
    'Total': 'total',
    'Cliente': 'customer_name',
    'E-mail Cliente': 'customer_email',
    'Meio de Pagamento': 'payment_method',
    'Código de Rastreio': 'tracking_code',
    'Data': 'created_at',
  },
  categories: {
    'Nome': 'name',
    'Descrição': 'description',
    'URL': 'slug',
    'Categoria Pai': 'parent_slug',
    'Imagem': 'image_url',
    'Ativo': 'is_active',
    'Ordem': 'sort_order',
  },
};
