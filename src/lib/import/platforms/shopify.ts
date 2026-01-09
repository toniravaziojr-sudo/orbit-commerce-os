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

import { stripHtmlToText, cleanSku, extractNumericOnly } from '../utils';

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
  orders_count?: number;
  total_spent?: string | number;
  created_at?: string;
  updated_at?: string;
  verified_email?: boolean;
  // CSV fields - Standard Shopify Customer Export
  'Email'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Phone'?: string;
  'Accepts Marketing'?: string;
  'Tags'?: string;
  'Note'?: string;
  'Orders Count'?: string;
  'Total Spent'?: string;
  'Created At'?: string;
  'Email Verified'?: string;
  // Address fields in CSV (flattened)
  'Company'?: string;
  'Address1'?: string;
  'Address2'?: string;
  'City'?: string;
  'Province'?: string;
  'Province Code'?: string;
  'Country'?: string;
  'Country Code'?: string;
  'Zip'?: string;
  'Default Address Phone'?: string;
  'Default Address Company'?: string;
  'Default Address Address1'?: string;
  'Default Address Address2'?: string;
  'Default Address City'?: string;
  'Default Address Province'?: string;
  'Default Address Province Code'?: string;
  'Default Address Country'?: string;
  'Default Address Country Code'?: string;
  'Default Address Zip'?: string;
  // CSV fields - Alternative formats
  'Customer Email'?: string;
  'E-mail'?: string;
  'Nome'?: string;
  'Nome Completo'?: string;
  'Telefone'?: string;
  'Celular'?: string;
  'CPF'?: string;
  'Data de Nascimento'?: string;
  'Genero'?: string;
  'Sexo'?: string;
  [key: string]: any;
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
  company?: string;
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
  total_tax?: string | number;
  currency?: string;
  created_at?: string;
  processed_at?: string;
  closed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  line_items?: ShopifyLineItem[];
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  note?: string;
  discount_codes?: Array<{ code?: string; amount?: string; type?: string }>;
  shipping_lines?: Array<{ title?: string; price?: string; code?: string }>;
  gateway?: string;
  payment_gateway_names?: string[];
  fulfillments?: Array<{ tracking_number?: string; tracking_company?: string }>;
  // CSV fields - Standard Shopify Orders Export
  'Name'?: string;
  'Email'?: string;
  'Financial Status'?: string;
  'Fulfillment Status'?: string;
  'Fulfilled at'?: string;
  'Accepts Marketing'?: string;
  'Currency'?: string;
  'Subtotal'?: string;
  'Shipping'?: string;
  'Taxes'?: string;
  'Total'?: string;
  'Discount Code'?: string;
  'Discount Amount'?: string;
  'Discount Type'?: string;
  'Shipping Method'?: string;
  'Created at'?: string;
  'Paid at'?: string;
  'Cancelled at'?: string;
  'Cancel Reason'?: string;
  'Notes'?: string;
  'Note Attributes'?: string;
  'Payment Method'?: string;
  'Payment Reference'?: string;
  'Payment Gateway'?: string;
  'Refunded Amount'?: string;
  'Vendor'?: string;
  'Tags'?: string;
  'Risk Level'?: string;
  'Source'?: string;
  // Lineitem fields
  'Lineitem name'?: string;
  'Lineitem quantity'?: string;
  'Lineitem price'?: string;
  'Lineitem sku'?: string;
  'Lineitem discount'?: string;
  'Lineitem compare at price'?: string;
  'Lineitem requires shipping'?: string;
  'Lineitem taxable'?: string;
  'Lineitem fulfillment status'?: string;
  // Shipping address
  'Shipping Name'?: string;
  'Shipping Phone'?: string;
  'Shipping Street'?: string;
  'Shipping Address1'?: string;
  'Shipping Address2'?: string;
  'Shipping City'?: string;
  'Shipping Province'?: string;
  'Shipping Province Code'?: string;
  'Shipping Province Name'?: string;
  'Shipping Zip'?: string;
  'Shipping Country'?: string;
  'Shipping Country Code'?: string;
  'Shipping Company'?: string;
  // Billing address
  'Billing Name'?: string;
  'Billing Phone'?: string;
  'Billing Street'?: string;
  'Billing Address1'?: string;
  'Billing Address2'?: string;
  'Billing City'?: string;
  'Billing Province'?: string;
  'Billing Province Code'?: string;
  'Billing Province Name'?: string;
  'Billing Zip'?: string;
  'Billing Country'?: string;
  'Billing Country Code'?: string;
  'Billing Company'?: string;
  // Tracking
  'Tracking Number'?: string;
  'Tracking Url'?: string;
  'Tracking Company'?: string;
  // CSV fields - Alternative formats
  'Order Number'?: string;
  'Número do Pedido'?: string;
  'Pedido'?: string;
  'Customer Email'?: string;
  'E-mail'?: string;
  'Status'?: string;
  'Payment Status'?: string;
  'Status Pagamento'?: string;
  [key: string]: any;
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
  
  // ===== DESCRIÇÃO (converter HTML para texto puro) =====
  const rawDescription = getField(raw, 
    'body_html', 'Body (HTML)', 
    'description', 'Description', 
    'descrição', 'Descrição',
    'Descrição do Produto'
  ) || null;
  const description = stripHtmlToText(rawDescription);
  
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
  
  // ===== SKU (remover caracteres especiais) =====
  const rawSku = getField(raw,
    'sku', 'SKU', 'Sku',
    'Variant SKU', 'variant_sku',
    'codigo', 'Codigo', 'Código', 'código',
    'code', 'Code', 'product_code'
  ) || (raw.variants?.[0]?.sku) || null;
  const sku = cleanSku(rawSku);
  
  // ===== BARCODE/GTIN (apenas números) =====
  const rawBarcode = getField(raw,
    'barcode', 'Barcode', 
    'Variant Barcode', 'variant_barcode',
    'gtin', 'GTIN', 'EAN', 'ean'
  ) || null;
  const barcode = extractNumericOnly(rawBarcode);
  
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
  // Try multiple email field variations (case-insensitive)
  const email = getFieldValue(raw, ['email', 'Email', 'Customer Email', 'E-mail', 'e-mail'])
    ?.toString().trim().toLowerCase() || '';
  
  // Validate email
  if (!email || !email.includes('@')) {
    console.warn('Skipping customer without valid email:', raw);
    return null;
  }
  
  // Name: try multiple field variations
  const firstName = getFieldValue(raw, ['first_name', 'First Name', 'Nome', 'Primeiro Nome'])?.toString().trim() || '';
  const lastName = getFieldValue(raw, ['last_name', 'Last Name', 'Sobrenome', 'Último Nome'])?.toString().trim() || '';
  let fullName = `${firstName} ${lastName}`.trim();
  
  // Try alternative name fields
  if (!fullName) {
    fullName = getFieldValue(raw, ['Nome Completo', 'full_name', 'name', 'Nome'])?.toString().trim() || 'Cliente';
  }
  
  // Phone: multiple variations
  const phone = getFieldValue(raw, ['phone', 'Phone', 'Telefone', 'Celular', 'Default Address Phone', 'Fone'])?.toString().trim() || null;
  
  // CPF (Brazilian ID)
  const cpf = getFieldValue(raw, ['CPF', 'cpf', 'Documento', 'documento'])?.toString().replace(/\D/g, '') || null;
  
  // Birth date
  const birthDateRaw = getFieldValue(raw, ['birth_date', 'Data de Nascimento', 'birthday', 'Aniversário']);
  const birthDate = birthDateRaw ? parseDate(birthDateRaw.toString()) : null;
  
  // Gender
  const genderRaw = getFieldValue(raw, ['gender', 'Genero', 'Sexo'])?.toString().toLowerCase();
  let gender: string | null = null;
  if (genderRaw) {
    if (['m', 'male', 'masculino', 'homem'].includes(genderRaw)) gender = 'male';
    else if (['f', 'female', 'feminino', 'mulher'].includes(genderRaw)) gender = 'female';
    else gender = genderRaw;
  }
  
  // Marketing opt-in
  const marketingRaw = getFieldValue(raw, ['accepts_marketing', 'Accepts Marketing', 'accepts_email_marketing'])?.toString().toLowerCase();
  const acceptsMarketing = marketingRaw === 'yes' || marketingRaw === 'true' || marketingRaw === 'sim' || marketingRaw === '1';
  
  // Tags
  const tagsRaw = getFieldValue(raw, ['tags', 'Tags'])?.toString() || '';
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  
  // Notes
  const note = getFieldValue(raw, ['note', 'Note', 'Observações', 'Notas'])?.toString().trim() || null;
  
  // Total orders and spent (from Shopify export)
  const totalOrders = parseInt(getFieldValue(raw, ['orders_count', 'Orders Count', 'Total de Pedidos'])?.toString() || '0', 10) || null;
  const totalSpent = parsePrice(getFieldValue(raw, ['total_spent', 'Total Spent', 'Total Gasto'])) || null;
  
  // Build addresses array
  const addresses: NormalizedAddress[] = [];
  
  // Check for default_address object
  if (raw.default_address) {
    addresses.push(normalizeShopifyAddress(raw.default_address, true));
  }
  
  // Check for addresses array
  if (raw.addresses && Array.isArray(raw.addresses)) {
    raw.addresses.forEach((addr, idx) => {
      if (idx === 0 && !raw.default_address) {
        addresses.push(normalizeShopifyAddress(addr, true));
      } else {
        addresses.push(normalizeShopifyAddress(addr, false));
      }
    });
  }
  
  // Check for flattened CSV address fields
  const csvAddress1 = getFieldValue(raw, ['Address1', 'Default Address Address1', 'Endereço', 'Rua']);
  const csvCity = getFieldValue(raw, ['City', 'Default Address City', 'Cidade']);
  
  if (csvAddress1 && csvCity && addresses.length === 0) {
    addresses.push({
      label: 'Principal',
      recipient_name: fullName,
      street: csvAddress1.toString().trim(),
      number: '',
      complement: getFieldValue(raw, ['Address2', 'Default Address Address2', 'Complemento'])?.toString().trim() || null,
      neighborhood: '',
      city: csvCity.toString().trim(),
      state: getFieldValue(raw, ['Province Code', 'Default Address Province Code', 'Province', 'Estado', 'UF'])?.toString().trim() || '',
      postal_code: (getFieldValue(raw, ['Zip', 'Default Address Zip', 'CEP'])?.toString() || '').replace(/\D/g, ''),
      country: getFieldValue(raw, ['Country Code', 'Default Address Country Code', 'Country', 'País'])?.toString().trim() || 'BR',
      is_default: true,
    });
  }
  
  return {
    email,
    full_name: fullName,
    phone: normalizePhone(phone),
    cpf: cpf && cpf.length === 11 ? cpf : null,
    birth_date: birthDate,
    gender,
    accepts_marketing: acceptsMarketing,
    status: 'active',
    addresses,
    tags,
    notes: note,
    // Extended fields for direct import
    total_orders: totalOrders,
    total_spent: totalSpent,
  } as NormalizedCustomer;
}

export function normalizeShopifyAddress(raw: ShopifyAddress, isDefault: boolean = false): NormalizedAddress {
  const name = raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Destinatário';
  
  // Try to extract number from address1 (Brazilian format: "Rua X, 123")
  let street = raw.address1 || '';
  let number = '';
  
  // Pattern: "Street Name, 123" or "Street Name 123"
  const numberMatch = street.match(/,?\s*(\d+)\s*$/);
  if (numberMatch) {
    number = numberMatch[1];
    street = street.replace(/,?\s*\d+\s*$/, '').trim();
  }
  
  return {
    label: isDefault ? 'Principal' : 'Endereço',
    recipient_name: name,
    street,
    number,
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
  const fulfillmentStatus = raw.fulfillment_status || raw['Fulfillment Status'] || raw['Fulfilled at'] ? 'fulfilled' : null;
  
  // Parse monetary values
  const subtotal = parsePrice(raw.subtotal_price || raw['Subtotal']);
  const discountTotal = parsePrice(raw.total_discounts || raw['Discount Amount']);
  const shippingTotal = parsePrice(raw.total_shipping_price_set?.shop_money?.amount || raw['Shipping']);
  const taxTotal = parsePrice(raw.total_tax || raw['Taxes']);
  const total = parsePrice(raw.total_price || raw['Total']) || subtotal;
  
  // Payment info
  const paymentGateway = raw.gateway || raw['Payment Gateway'] || raw['Payment Method'] || null;
  const paymentRef = raw['Payment Reference'] || null;
  
  // Discount info
  const discountCode = raw.discount_codes?.[0]?.code || raw['Discount Code'] || null;
  const discountType = raw.discount_codes?.[0]?.type || raw['Discount Type'] || null;
  
  // Shipping info
  const shippingMethod = raw.shipping_lines?.[0]?.title || raw['Shipping Method'] || null;
  const shippingServiceCode = raw.shipping_lines?.[0]?.code || null;
  
  // Tracking info
  const trackingCode = raw.fulfillments?.[0]?.tracking_number || raw['Tracking Number'] || null;
  const trackingCarrier = raw.fulfillments?.[0]?.tracking_company || raw['Tracking Company'] || null;
  
  // Dates
  const createdAt = raw.created_at || raw['Created at'] || new Date().toISOString();
  const paidAt = raw.processed_at || raw['Paid at'] || (financialStatus === 'paid' ? createdAt : null);
  const cancelledAt = raw.cancelled_at || raw['Cancelled at'] || null;
  const cancelReason = raw.cancel_reason || raw['Cancel Reason'] || null;
  const fulfilledAt = raw['Fulfilled at'] || null;
  
  // Notes
  const notes = raw.note || raw['Notes'] || null;
  const noteAttributes = raw['Note Attributes'] || null;
  
  // Handle line items from CSV format (single line per item)
  let items: NormalizedOrderItem[] = [];
  
  if (raw.line_items && Array.isArray(raw.line_items) && raw.line_items.length > 0) {
    items = raw.line_items.map(item => ({
      product_name: item.title || 'Produto',
      product_sku: item.sku || null,
      variant_name: item.variant_title || null,
      quantity: item.quantity || 1,
      unit_price: parsePrice(item.price),
      total_price: parsePrice(item.price) * (item.quantity || 1),
    }));
  } else if (raw['Lineitem name']) {
    // CSV format with lineitem fields
    const qty = parseInt(raw['Lineitem quantity'] || '1', 10);
    const price = parsePrice(raw['Lineitem price']);
    items = [{
      product_name: raw['Lineitem name'] || 'Produto',
      product_sku: raw['Lineitem sku'] || null,
      variant_name: null,
      quantity: qty,
      unit_price: price,
      total_price: price * qty,
    }];
  }
  
  // Customer info from shipping/billing address
  let customerName = raw.shipping_address?.name || raw.billing_address?.name || '';
  let customerPhone = raw.phone || raw.shipping_address?.phone || raw.billing_address?.phone || null;
  
  // Try CSV shipping fields
  if (!customerName) {
    customerName = raw['Shipping Name'] || raw['Billing Name'] || '';
  }
  if (!customerPhone) {
    customerPhone = raw['Shipping Phone'] || raw['Billing Phone'] || null;
  }
  
  // Build shipping address from raw or CSV fields
  let shippingAddress: NormalizedAddress | null = null;
  if (raw.shipping_address) {
    shippingAddress = normalizeShopifyAddress(raw.shipping_address, true);
  } else if (raw['Shipping City'] || raw['Shipping Address1']) {
    shippingAddress = {
      label: 'Entrega',
      recipient_name: raw['Shipping Name'] || customerName,
      street: raw['Shipping Address1'] || raw['Shipping Street'] || '',
      number: '',
      complement: raw['Shipping Address2'] || null,
      neighborhood: '',
      city: raw['Shipping City'] || '',
      state: raw['Shipping Province Code'] || raw['Shipping Province'] || '',
      postal_code: (raw['Shipping Zip'] || '').replace(/\D/g, ''),
      country: raw['Shipping Country Code'] || raw['Shipping Country'] || 'BR',
      is_default: true,
    };
  }
  
  // Build billing address from raw or CSV fields
  let billingAddress: NormalizedAddress | null = null;
  if (raw.billing_address) {
    billingAddress = normalizeShopifyAddress(raw.billing_address, false);
  } else if (raw['Billing City'] || raw['Billing Address1']) {
    billingAddress = {
      label: 'Cobrança',
      recipient_name: raw['Billing Name'] || customerName,
      street: raw['Billing Address1'] || raw['Billing Street'] || '',
      number: '',
      complement: raw['Billing Address2'] || null,
      neighborhood: '',
      city: raw['Billing City'] || '',
      state: raw['Billing Province Code'] || raw['Billing Province'] || '',
      postal_code: (raw['Billing Zip'] || '').replace(/\D/g, ''),
      country: raw['Billing Country Code'] || raw['Billing Country'] || 'BR',
      is_default: false,
    };
  }
  
  return {
    order_number: orderNumber.replace(/^#/, ''),
    status: mapShopifyStatus(financialStatus, fulfillmentStatus),
    payment_status: mapShopifyPaymentStatus(financialStatus),
    payment_method: paymentGateway,
    shipping_status: fulfillmentStatus,
    subtotal,
    discount_total: discountTotal,
    shipping_total: shippingTotal,
    total,
    currency: raw.currency || raw['Currency'] || 'BRL',
    customer_email: email,
    customer_name: customerName,
    customer_phone: normalizePhone(customerPhone),
    shipping_address: shippingAddress,
    billing_address: billingAddress,
    items,
    notes: noteAttributes ? `${notes || ''}\n${noteAttributes}`.trim() : notes,
    created_at: createdAt,
    paid_at: paidAt,
    shipped_at: fulfilledAt,
    delivered_at: null,
    tracking_code: trackingCode,
    tracking_carrier: trackingCarrier,
    // Extended fields for direct import
    tax_total: taxTotal,
    discount_code: discountCode,
    discount_type: discountType,
    shipping_service_code: shippingServiceCode,
    shipping_service_name: shippingMethod,
    cancelled_at: cancelledAt,
    cancellation_reason: cancelReason,
    payment_gateway: paymentGateway,
    payment_gateway_id: paymentRef,
  } as NormalizedOrder;
}

// Helpers

/**
 * Get field value from raw object, trying multiple field names (case-insensitive)
 */
function getFieldValue(raw: Record<string, any>, fieldNames: string[]): any {
  for (const field of fieldNames) {
    if (raw[field] !== undefined && raw[field] !== null && raw[field] !== '') {
      return raw[field];
    }
    // Try lowercase
    const lower = field.toLowerCase();
    for (const key of Object.keys(raw)) {
      if (key.toLowerCase() === lower && raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
        return raw[key];
      }
    }
  }
  return undefined;
}

/**
 * Parse date string to ISO format
 */
function parseDate(value: string): string | null {
  if (!value) return null;
  
  // Try common formats
  const trimmed = value.trim();
  
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.split('T')[0];
  }
  
  // BR format: DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  
  // US format: MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    // If month > 12, it's probably BR format
    if (month <= 12) {
      return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
    }
  }
  
  // Try Date.parse as fallback
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  
  return null;
}

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
