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

// Campos do Shopify (como vêm da API/CSV) - MAPEAMENTO COMPLETO
export interface ShopifyProduct {
  // API fields
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
  // CSV fields - Headers exatos do Shopify
  'Handle'?: string;
  'Title'?: string;
  'Body (HTML)'?: string;
  'Vendor'?: string;
  'Product Category'?: string;
  'Type'?: string;
  'Tags'?: string;
  'Published'?: string;
  'Variant SKU'?: string;
  'Variant Grams'?: string;
  'Variant Inventory Tracker'?: string;
  'Variant Inventory Qty'?: string;
  'Variant Inventory Policy'?: string;
  'Variant Fulfillment Service'?: string;
  'Variant Price'?: string;
  'Variant Compare At Price'?: string;
  'Variant Requires Shipping'?: string;
  'Variant Taxable'?: string;
  'Variant Barcode'?: string;
  'Image Src'?: string;
  'Image Position'?: string;
  'Image Alt Text'?: string;
  'Gift Card'?: string;
  'SEO Title'?: string;
  'SEO Description'?: string;
  'Google Shopping / Google Product Category'?: string;
  'Cost per item'?: string;
  'Variant Weight Unit'?: string;
  'Variant Tax Code'?: string;
  'Status'?: string;
  'Option1 Name'?: string;
  'Option1 Value'?: string;
  'Option2 Name'?: string;
  'Option2 Value'?: string;
  'Option3 Name'?: string;
  'Option3 Value'?: string;
  // Campos alternativos/normalizados (lowercase)
  [key: string]: any;
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
  // CSV fields - Standard
  'Email'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Phone'?: string;
  'Accepts Marketing'?: string;
  'Tags'?: string;
  'Note'?: string;
  // CSV fields - Alternative formats
  'Customer Email'?: string;
  'E-mail'?: string;
  'Nome'?: string;
  'Nome Completo'?: string;
  'Telefone'?: string;
  'Celular'?: string;
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
  // CSV fields - Standard
  'Name'?: string;
  'Email'?: string;
  'Financial Status'?: string;
  'Fulfillment Status'?: string;
  'Subtotal'?: string;
  'Discount Amount'?: string;
  'Shipping'?: string;
  'Total'?: string;
  'Created at'?: string;
  // CSV fields - Alternative formats
  'Order Number'?: string;
  'Número do Pedido'?: string;
  'Pedido'?: string;
  'Customer Email'?: string;
  'E-mail'?: string;
  'Status'?: string;
  'Payment Status'?: string;
  'Status Pagamento'?: string;
  'Lineitem name'?: string;
  'Lineitem quantity'?: string;
  'Lineitem price'?: string;
  'Lineitem sku'?: string;
}

export interface ShopifyLineItem {
  title?: string;
  variant_title?: string;
  sku?: string;
  quantity?: number;
  price?: string | number;
}

// Funções de normalização - MAPEAMENTO COMPLETO
export function normalizeShopifyProduct(raw: ShopifyProduct): NormalizedProduct {
  // Helper para buscar campo case-insensitive
  const getField = (obj: any, ...keys: string[]): any => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      // Try lowercase
      const lowerKey = key.toLowerCase();
      if (obj[lowerKey] !== undefined && obj[lowerKey] !== null && obj[lowerKey] !== '') return obj[lowerKey];
    }
    return undefined;
  };

  // ===== HANDLE/SLUG =====
  const handle = getField(raw, 'handle', 'Handle', 'slug', 'Slug') || '';
  
  // ===== TITLE/NAME (CRÍTICO) =====
  const title = getField(raw, 
    'title', 'Title', 
    'name', 'Name', 
    'nome', 'Nome',
    'produto', 'Produto',
    'Nome do Produto', 'Product Name', 'product_name'
  ) || '';
  
  // ===== DESCRIÇÃO =====
  const description = getField(raw, 
    'body_html', 'Body (HTML)', 
    'description', 'Description', 
    'descrição', 'Descrição',
    'Descrição do Produto'
  ) || null;
  
  // ===== PREÇO (CRÍTICO) =====
  const rawPrice = getField(raw,
    'price', 'Price', 'Preço', 'preço',
    'Variant Price', 'variant_price'
  ) || (raw.variants?.[0]?.price?.toString()) || '0';
  const price = parsePrice(rawPrice);
  
  // ===== PREÇO COMPARAÇÃO =====
  const rawComparePrice = getField(raw,
    'compare_at_price', 'Compare At Price', 
    'Variant Compare At Price', 'variant_compare_at_price',
    'Preço Comparativo', 'De', 'de'
  ) || (raw.variants?.[0]?.compare_at_price?.toString()) || '0';
  const compareAtPrice = parsePrice(rawComparePrice) || null;
  
  // ===== CUSTO =====
  const costPrice = parsePrice(getField(raw, 
    'Cost per item', 'cost_per_item', 'cost_price',
    'Custo', 'custo'
  ) || '0') || null;
  
  // ===== SKU =====
  const sku = getField(raw,
    'sku', 'SKU', 'Sku',
    'Variant SKU', 'variant_sku',
    'codigo', 'Codigo', 'Código', 'código',
    'code', 'Code', 'product_code'
  ) || (raw.variants?.[0]?.sku) || null;
  
  // ===== BARCODE/GTIN =====
  const barcode = getField(raw,
    'barcode', 'Barcode', 
    'Variant Barcode', 'variant_barcode',
    'gtin', 'GTIN', 'EAN', 'ean'
  ) || null;
  
  // ===== PESO =====
  const rawWeight = getField(raw,
    'weight', 'Weight', 'Peso', 'peso',
    'Variant Grams', 'variant_grams',
    'Variant Weight'
  ) || (raw.variants?.[0]?.weight?.toString()) || '0';
  // Shopify Variant Grams está em gramas, converter para kg
  let weight = parseFloat(rawWeight) || null;
  if (weight && (raw['Variant Grams'] || raw['variant_grams'])) {
    weight = weight / 1000; // gramas -> kg
  }
  
  // ===== ESTOQUE =====
  const stockQuantity = parseInt(
    getField(raw,
      'stock_quantity', 'Stock', 'Estoque', 'estoque',
      'Variant Inventory Qty', 'variant_inventory_qty',
      'inventory_quantity', 'Inventory'
    ) || (raw.variants?.[0]?.inventory_quantity?.toString()) || '0', 
    10
  );
  
  // ===== STATUS =====
  const publishedRaw = getField(raw, 'published', 'Published', 'Status', 'status');
  const published = publishedRaw === true || 
    publishedRaw?.toString().toLowerCase() === 'true' || 
    publishedRaw?.toString().toLowerCase() === 'active' ||
    publishedRaw?.toString().toLowerCase() === 'ativo';
  
  // ===== TAGS =====
  const tagsRaw = getField(raw, 'tags', 'Tags') || '';
  const tags = tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
  
  // ===== SEO =====
  const seoTitle = getField(raw, 'SEO Title', 'seo_title', 'SEO Titulo') || null;
  const seoDescription = getField(raw, 'SEO Description', 'seo_description', 'SEO Descrição') || null;
  
  // ===== IMAGENS (CRÍTICO) =====
  const images: NormalizedProductImage[] = [];
  
  // Primeiro: imagens da API (array)
  if (raw.images && Array.isArray(raw.images)) {
    raw.images.forEach((img, idx) => {
      if (img.src) {
        images.push({
          url: img.src,
          alt: img.alt || null,
          is_primary: idx === 0,
          position: img.position || idx,
        });
      }
    });
  }
  
  // Segundo: imagem do CSV (campo único)
  const csvImageUrl = getField(raw, 'Image Src', 'image_src', 'Imagem', 'imagem', 'image_url');
  if (csvImageUrl && !images.find(i => i.url === csvImageUrl)) {
    const imageAlt = getField(raw, 'Image Alt Text', 'image_alt', 'Alt Imagem') || null;
    const imagePosition = parseInt(getField(raw, 'Image Position', 'image_position') || '0', 10);
    images.push({
      url: csvImageUrl,
      alt: imageAlt,
      is_primary: images.length === 0,
      position: imagePosition || images.length,
    });
  }
  
  // ===== VARIANTES =====
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
  
  // Variante do CSV (Option1/2/3)
  const opt1Name = getField(raw, 'Option1 Name', 'option1_name');
  const opt1Value = getField(raw, 'Option1 Value', 'option1_value');
  if (opt1Name && opt1Value) {
    const options: Record<string, string> = {};
    options[opt1Name] = opt1Value;
    
    const opt2Name = getField(raw, 'Option2 Name', 'option2_name');
    const opt2Value = getField(raw, 'Option2 Value', 'option2_value');
    if (opt2Name && opt2Value) options[opt2Name] = opt2Value;
    
    const opt3Name = getField(raw, 'Option3 Name', 'option3_name');
    const opt3Value = getField(raw, 'Option3 Value', 'option3_value');
    if (opt3Name && opt3Value) options[opt3Name] = opt3Value;
    
    // Só adiciona se não existir variante com mesmo SKU
    if (!variants.find(v => v.sku === sku)) {
      variants.push({
        name: opt1Value,
        sku: sku,
        price: price,
        compare_at_price: compareAtPrice,
        stock_quantity: stockQuantity,
        options,
      });
    }
  }
  
  // ===== CATEGORIAS =====
  const productType = getField(raw, 
    'product_type', 'Type', 'Product Category',
    'Categoria', 'categoria', 'Category', 'category'
  ) || '';
  const categories = productType ? [slugify(productType)] : [];
  
  // ===== NOME EFETIVO (nunca vazio) =====
  const effectiveName = title.trim() || handle || 'Produto sem nome';
  
  return {
    name: effectiveName,
    slug: handle || slugify(effectiveName),
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
    seo_title: seoTitle,
    seo_description: seoDescription,
    images,
    variants,
    categories,
  };
}

export function normalizeShopifyCustomer(raw: ShopifyCustomer): NormalizedCustomer | null {
  // Try multiple email field variations
  const email = (
    raw.email || 
    raw['Email'] || 
    raw['Customer Email'] || 
    raw['E-mail'] || 
    ''
  ).toString().trim().toLowerCase();
  
  // Validate email
  if (!email || !email.includes('@')) {
    console.warn('Skipping customer without valid email:', raw);
    return null;
  }
  
  const firstName = raw.first_name || raw['First Name'] || '';
  const lastName = raw.last_name || raw['Last Name'] || '';
  let fullName = `${firstName} ${lastName}`.trim();
  
  // Try alternative name fields
  if (!fullName) {
    fullName = raw['Nome'] || raw['Nome Completo'] || 'Cliente';
  }
  
  // Try multiple phone field variations
  const phone = raw.phone || raw['Phone'] || raw['Telefone'] || raw['Celular'] || null;
  
  const acceptsMarketing = raw.accepts_marketing ?? 
    (raw['Accepts Marketing']?.toLowerCase() === 'yes' || raw['Accepts Marketing']?.toLowerCase() === 'true');
  
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

export function normalizeShopifyOrder(raw: ShopifyOrder): NormalizedOrder | null {
  // Try multiple order number field variations
  const orderNumber = (
    raw.name || 
    raw['Name'] || 
    raw['Order Number'] || 
    raw['Número do Pedido'] || 
    raw['Pedido'] ||
    (raw.order_number ? `#${raw.order_number}` : null) ||
    ''
  ).toString();
  
  if (!orderNumber) {
    console.warn('Skipping order without order number:', raw);
    return null;
  }
  
  // Try multiple email field variations
  const email = (
    raw.email || 
    raw['Email'] || 
    raw['Customer Email'] || 
    raw['E-mail'] || 
    ''
  ).toString().trim().toLowerCase();
  
  const financialStatus = raw.financial_status || raw['Financial Status'] || raw['Payment Status'] || raw['Status Pagamento'] || 'pending';
  const fulfillmentStatus = raw.fulfillment_status || raw['Fulfillment Status'] || null;
  
  const subtotal = parseFloat(raw.subtotal_price?.toString() || raw['Subtotal'] || '0') || 0;
  const discountTotal = parseFloat(raw.total_discounts?.toString() || raw['Discount Amount'] || '0') || 0;
  const shippingTotal = parseFloat(
    raw.total_shipping_price_set?.shop_money?.amount || raw['Shipping'] || '0'
  ) || 0;
  const total = parseFloat(raw.total_price?.toString() || raw['Total'] || '0') || subtotal;
  
  // Handle line items from CSV format (single line per item)
  let items: NormalizedOrderItem[] = [];
  
  if (raw.line_items && Array.isArray(raw.line_items) && raw.line_items.length > 0) {
    items = raw.line_items.map(item => ({
      product_name: item.title || 'Produto',
      product_sku: item.sku || null,
      variant_name: item.variant_title || null,
      quantity: item.quantity || 1,
      unit_price: parseFloat(item.price?.toString() || '0'),
      total_price: parseFloat(item.price?.toString() || '0') * (item.quantity || 1),
    }));
  } else if (raw['Lineitem name']) {
    // CSV format with lineitem fields
    items = [{
      product_name: raw['Lineitem name'] || 'Produto',
      product_sku: raw['Lineitem sku'] || null,
      variant_name: null,
      quantity: parseInt(raw['Lineitem quantity'] || '1', 10),
      unit_price: parseFloat(raw['Lineitem price'] || '0'),
      total_price: parseFloat(raw['Lineitem price'] || '0') * parseInt(raw['Lineitem quantity'] || '1', 10),
    }];
  }
  
  return {
    order_number: orderNumber.replace(/^#/, ''),
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
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Parse price string, supporting Brazilian format (R$ 49,90) and international (49.90)
 */
function parsePrice(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  let str = value.toString().trim();
  if (!str) return 0;
  
  // Remove currency symbols and spaces
  str = str.replace(/R\$\s*/gi, '').replace(/\s/g, '');
  
  // Handle Brazilian format: "1.234,56" or "49,90"
  // vs International format: "1,234.56" or "49.90"
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Both present - determine which is decimal separator
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Brazilian: 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // International: 1,234.56 -> 1234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma - check if it's decimal separator
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal: 49,90 -> 49.90
      str = str.replace(',', '.');
    } else {
      // Thousand separator: 1,234 -> 1234
      str = str.replace(/,/g, '');
    }
  }
  // If only dot, parseFloat handles it correctly
  
  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
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
