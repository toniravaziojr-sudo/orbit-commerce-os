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

import { stripHtmlToText, cleanSku, extractNumericOnly, getColumnValue, parseBrazilianPrice, slugify } from '../utils';

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
  // CSV fields (português) - nomes alternativos do export da Nuvemshop
  'Nome'?: string;
  'Descrição'?: string;
  'URL'?: string;
  'Identificador URL'?: string; // Nome alternativo usado no export
  'Preço'?: string;
  'Preço promocional'?: string;
  'Custo'?: string;
  'SKU'?: string;
  'Código de barras'?: string;
  'Peso (kg)'?: string;
  'Largura (cm)'?: string;
  'Altura (cm)'?: string;
  'Profundidade (cm)'?: string;
  'Comprimento (cm)'?: string; // Nome alternativo usado no export
  'Estoque'?: string;
  'Ativo'?: string;
  'Exibir na loja'?: string; // Nome alternativo usado no export
  'Destaque'?: string;
  'Imagem principal'?: string;
  'Imagens adicionais'?: string;
  'Categoria'?: string;
  'Categorias'?: string; // Nome alternativo usado no export (plural)
  'Tags'?: string;
  'Título SEO'?: string;
  'Título para SEO'?: string; // Nome alternativo usado no export
  'Descrição SEO'?: string;
  'Descrição para SEO'?: string; // Nome alternativo usado no export
  'Marca'?: string;
  'Produto Físico'?: string;
  'Frete gratis'?: string;
  'MPN (Cód. Exclusivo Modelo Fabricante)'?: string;
  'Sexo'?: string;
  'Faixa etária'?: string;
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
  // Cast to Record for flexible column access
  const row = raw as unknown as Record<string, string>;
  
  // DEBUG: Log all keys received to diagnose column mapping issues
  const rowKeys = Object.keys(row);
  console.log(`[normalizeNuvemshopProduct] Row keys (first 30): ${rowKeys.slice(0, 30).join(', ')}`);
  
  // Use getColumnValue for encoding-safe column matching
  // CRITICAL: Many aliases to handle Nuvemshop export variations + encoding corruption
  const name = getText(raw.name) || getColumnValue(row, 
    'Nome', 'Nome do produto', 'Nome produto', 'Product Name', 'name', 'Nombre', 'Title', 'Titulo'
  ) || 'Produto sem nome';
  
  // DEBUG: Log what we're finding
  console.log(`[normalizeNuvemshopProduct] Name found: "${name}"`);
  
  // Convert HTML to plain text
  // CRITICAL: Nuvemshop uses "Descrição" with many encoding variations
  const rawDescription = getText(raw.description) || getColumnValue(row, 
    'Descrição', 'Descricao', 'Descriçao', 'Description', 'description', 'Descrio', 
    'Descripción', 'Descripcion', 'Body HTML', 'Body (HTML)', 'HTML Description'
  ) || null;
  const description = stripHtmlToText(rawDescription);
  
  // Handle/slug - aceita múltiplos nomes de coluna
  const handle = getText(raw.handle) || getColumnValue(row, 
    'URL', 'Identificador URL', 'Identificador', 'Handle', 'Slug', 'slug', 
    'URL amigável', 'URL amigavel', 'Permalink', 'Link'
  ) || slugify(name);
  
  const variant = raw.variants?.[0];
  
  // =====================================================
  // CRITICAL: PRICE EXTRACTION - Multiple column aliases
  // Nuvemshop exports with DOT as decimal (49.90)
  // But may corrupt "Preço" to "Preo" or "Preco"
  // =====================================================
  const priceStr = getColumnValue(row, 
    'Preço', 'Preco', 'Preço de venda', 'Preco de venda', 
    'Price', 'price', 'Valor', 'Valor de venda',
    'Preço original', 'Preco original', 'Variant Price',
    'Precio', 'Preo'  // Corrupted encoding fallbacks
  ) || '';
  
  const compareAtPriceStr = getColumnValue(row, 
    'Preço promocional', 'Preco promocional', 'Preço comparativo', 'Preco comparativo',
    'Compare at price', 'compare_at_price', 'Preço antigo', 'Preco antigo',
    'Variant Compare At Price', 'Precio comparativo', 'Preo promocional'
  ) || '';
  
  const costStr = getColumnValue(row, 
    'Custo', 'Cost', 'cost', 'Custo do produto', 'Custo por item',
    'Variant Cost', 'Costo', 'Preço de custo', 'Preco de custo'
  ) || '';
  
  // DEBUG: Log price values found
  console.log(`[normalizeNuvemshopProduct] Price string found: "${priceStr}" | Compare: "${compareAtPriceStr}" | Cost: "${costStr}"`);
  
  // Parse prices - variant takes priority, then CSV column
  const price = parseBrazilianPrice(variant?.price) || parseBrazilianPrice(priceStr) || 0;
  const compareAtPrice = parseBrazilianPrice(variant?.compare_at_price) || parseBrazilianPrice(compareAtPriceStr) || null;
  const costPrice = parseBrazilianPrice(variant?.cost) || parseBrazilianPrice(costStr) || null;
  
  // DEBUG: Log parsed prices
  console.log(`[normalizeNuvemshopProduct] Parsed prices: price=${price}, compare=${compareAtPrice}, cost=${costPrice}`);
  
  // SKU - clean special chars - add more aliases
  const rawSku = variant?.sku || getColumnValue(row, 
    'SKU', 'sku', 'Código', 'Codigo', 'Código SKU', 'Codigo SKU', 
    'Variant SKU', 'Código do produto', 'Codigo do produto', 'Referência', 'Referencia'
  ) || null;
  const sku = cleanSku(rawSku);
  
  // Barcode - only numbers
  const rawBarcode = variant?.barcode || getColumnValue(row, 
    'Código de barras', 'Codigo de barras', 'Barcode', 'barcode', 
    'EAN', 'GTIN', 'UPC', 'ISBN', 'Variant Barcode', 'Cdigo de barras'
  ) || null;
  const barcode = extractNumericOnly(rawBarcode);
  
  // Dimensions - aceita múltiplos nomes de coluna (com e sem acento)
  const weightStr = getColumnValue(row, 
    'Peso (kg)', 'Peso kg', 'Peso', 'Weight', 'weight', 'Peso (g)', 'Variant Grams', 'Grams'
  ) || '';
  const widthStr = getColumnValue(row, 
    'Largura (cm)', 'Largura cm', 'Largura', 'Width', 'width'
  ) || '';
  const heightStr = getColumnValue(row, 
    'Altura (cm)', 'Altura cm', 'Altura', 'Height', 'height'
  ) || '';
  const depthStr = getColumnValue(row, 
    'Profundidade (cm)', 'Comprimento (cm)', 'Comprimento cm', 'Comprimento', 
    'Profundidade', 'Depth', 'depth', 'Length', 'length'
  ) || '';
  const stockStr = getColumnValue(row, 
    'Estoque', 'Stock', 'stock', 'Quantidade', 'Inventory', 'inventory', 
    'Qtd', 'Quantidade em estoque', 'Variant Inventory Qty', 'Qty'
  ) || '0';
  
  const weight = parseBrazilianPrice(variant?.weight) || parseBrazilianPrice(weightStr) || null;
  const width = parseBrazilianPrice(variant?.width) || parseBrazilianPrice(widthStr) || null;
  const height = parseBrazilianPrice(variant?.height) || parseBrazilianPrice(heightStr) || null;
  const depth = parseBrazilianPrice(variant?.depth) || parseBrazilianPrice(depthStr) || null;
  const stockQuantity = parseInt(variant?.stock?.toString() || stockStr, 10) || 0;
  
  // Status - aceita múltiplos nomes de coluna
  const activeValue = getColumnValue(row, 
    'Ativo', 'Exibir na loja', 'Status', 'Published', 'published', 
    'Publicado', 'Visivel', 'Visível', 'Visible', 'Active'
  ) || '';
  const isActive = raw.published ?? (
    activeValue.toLowerCase() === 'sim' || 
    activeValue.toLowerCase() === 'true' || 
    activeValue.toLowerCase() === 'yes' || 
    activeValue.toLowerCase() === 'ativo' ||
    activeValue.toLowerCase() === 'activo' ||
    activeValue === '1'
  );
  const isFeatured = (getColumnValue(row, 'Destaque', 'Featured', 'featured', 'Destacado') || '').toLowerCase() === 'sim';
  
  // Marca
  const brand = getColumnValue(row, 'Marca', 'Brand', 'Fabricante', 'Manufacturer') || raw.brand || null;
  
  // =====================================================
  // IMAGES - Extract from multiple possible columns
  // =====================================================
  const images: NormalizedProductImage[] = [];
  
  // First check for consolidated images from consolidateNuvemshopProducts
  const collectedImages = (raw as any)._collectedImages as string[] | undefined;
  
  if (collectedImages && collectedImages.length > 0) {
    collectedImages.forEach((url, idx) => {
      if (url && url.startsWith('http')) {
        images.push({
          url,
          alt: null,
          is_primary: idx === 0,
          position: idx,
        });
      }
    });
  } else if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      images.push({
        url: img.src || '',
        alt: img.alt?.[0] || null,
        is_primary: idx === 0,
        position: img.position || idx,
      });
    });
  } else {
    // Try CSV columns for images - Nuvemshop uses "URL da imagem 1", "URL da imagem 2", etc.
    const mainImage = getColumnValue(row, 
      'Imagem principal', 'Imagem 1', 'URL da imagem 1', 
      'Image URL', 'Image Src', 'Main Image', 'Foto principal'
    );
    if (mainImage && mainImage.startsWith('http')) {
      images.push({
        url: mainImage,
        alt: null,
        is_primary: true,
        position: 0,
      });
    }
    
    // Check for multiple image columns (URL da imagem 2, 3, 4, etc.)
    for (let i = 2; i <= 15; i++) {
      const imgUrl = getColumnValue(row, `URL da imagem ${i}`, `Imagem ${i}`, `Image ${i}`);
      if (imgUrl && imgUrl.startsWith('http')) {
        images.push({
          url: imgUrl,
          alt: null,
          is_primary: false,
          position: i - 1,
        });
      }
    }
    
    // Also check "Imagens adicionais" (comma-separated URLs)
    const additionalImages = getColumnValue(row, 'Imagens adicionais', 'Additional Images');
    if (additionalImages) {
      const additionalUrls = additionalImages.split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
      additionalUrls.forEach((url, idx) => {
        images.push({
          url,
          alt: null,
          is_primary: false,
          position: images.length,
        });
      });
    }
  }
  
  console.log(`[normalizeNuvemshopProduct] Images found: ${images.length}`);
  
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
        price: parseBrazilianPrice(v.price),
        compare_at_price: v.compare_at_price ? parseBrazilianPrice(v.compare_at_price) : null,
        stock_quantity: v.stock || null,
        options,
      });
    });
  }
  
  // Categorias - aceita múltiplos nomes de coluna (singular e plural)
  const categories: string[] = [];
  if (raw.categories && Array.isArray(raw.categories)) {
    raw.categories.forEach(cat => {
      const catHandle = getText(cat.handle) || slugify(getText(cat.name));
      if (catHandle) categories.push(catHandle);
    });
  } else {
    // Aceita tanto "Categoria" quanto "Categorias"
    const categoryString = getColumnValue(row, 'Categorias', 'Categoria') || '';
    if (categoryString) {
      // Categorias podem estar separadas por vírgula ou " > " (hierarquia Nuvemshop)
      // Ex: "Todos Kits > Kit Banho Poderoso, Queda Leve a Moderada"
      const categoryParts = categoryString.split(',').map(c => c.trim());
      categoryParts.forEach(part => {
        // Se tem hierarquia (">"), pega todas as partes
        if (part.includes('>')) {
          const hierarchy = part.split('>').map(h => h.trim());
          hierarchy.forEach(h => {
            if (h) categories.push(slugify(h));
          });
        } else {
          if (part) categories.push(slugify(part));
        }
      });
    }
  }
  
  // Tags
  const tagsString = getColumnValue(row, 'Tags') || '';
  const tags = tagsString ? tagsString.split(',').map(t => t.trim()).filter(Boolean) : [];
  
  // SEO - aceita múltiplos nomes de coluna (com e sem acento)
  const seoTitle = getText(raw.seo_title) || getColumnValue(row, 'Título SEO', 'Titulo SEO', 'Título para SEO', 'Titulo para SEO') || null;
  const seoDescription = getText(raw.seo_description) || getColumnValue(row, 'Descrição SEO', 'Descricao SEO', 'Descrição para SEO', 'Descricao para SEO') || null;
  
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
    seo_title: seoTitle,
    seo_description: seoDescription,
    images,
    variants,
    categories,
    // Campos extras que podem ser úteis
    brand: brand,
    tags: tags,
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

// Helpers - using imported slugify from utils

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
// Inclui nomes alternativos usados pelo export da Nuvemshop
export const NUVEMSHOP_FIELD_MAPPING = {
  products: {
    // Campo: [Nome primário, ...nomes alternativos]
    'Nome': 'name',
    'Descrição': 'description',
    'URL': 'slug',
    'Identificador URL': 'slug', // Alternativo
    'Preço': 'price',
    'Preço promocional': 'compare_at_price',
    'Custo': 'cost_price',
    'SKU': 'sku',
    'Código de barras': 'barcode',
    'Peso (kg)': 'weight',
    'Largura (cm)': 'width',
    'Altura (cm)': 'height',
    'Profundidade (cm)': 'depth',
    'Comprimento (cm)': 'depth', // Alternativo para profundidade
    'Estoque': 'stock_quantity',
    'Ativo': 'status',
    'Exibir na loja': 'status', // Alternativo
    'Destaque': 'is_featured',
    'Imagem principal': 'images',
    'Imagens adicionais': 'images',
    'Categoria': 'categories',
    'Categorias': 'categories', // Alternativo (plural)
    'Tags': 'tags',
    'Título SEO': 'seo_title',
    'Título para SEO': 'seo_title', // Alternativo
    'Descrição SEO': 'seo_description',
    'Descrição para SEO': 'seo_description', // Alternativo
    'Marca': 'brand',
    'Produto Físico': 'requires_shipping',
    'Frete gratis': 'free_shipping',
    'MPN (Cód. Exclusivo Modelo Fabricante)': 'mpn',
    'Sexo': 'gender',
    'Faixa etária': 'age_range',
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
    'Identificador URL': 'slug', // Alternativo
    'Categoria pai': 'parent_slug',
    'Ativa': 'is_active',
    'Exibir na loja': 'is_active', // Alternativo
  },
};

// Lista de nomes alternativos de colunas que o export da Nuvemshop pode usar
export const NUVEMSHOP_COLUMN_ALIASES: Record<string, string> = {
  'Identificador URL': 'URL',
  'Comprimento (cm)': 'Profundidade (cm)',
  'Exibir na loja': 'Ativo',
  'Categorias': 'Categoria',
  'Título para SEO': 'Título SEO',
  'Descrição para SEO': 'Descrição SEO',
};
