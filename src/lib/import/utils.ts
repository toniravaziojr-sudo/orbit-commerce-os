// =============================================
// VERSION: 2026-02-25 - Added Nuvemshop consolidation + encoding fix
// UTILITÁRIOS COMPARTILHADOS PARA IMPORTAÇÃO
// =============================================

/**
 * Strip HTML tags and convert to plain text
 * Preserves line breaks and text structure
 */
export function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  
  return html
    // Replace <br>, <br/>, </p>, </div>, </li> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '\"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Clean up excessive whitespace and newlines
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim() || null;
}

/**
 * Extract only numeric characters from a string (for SKU, GTIN, barcode)
 */
export function extractNumericOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Clean SKU - remove special chars like quotes
 */
export function cleanSku(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/['"]/g, '').trim() || null;
}

/**
 * Create a URL-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Normalize header for comparison - removes accents and special chars
 * Used to match columns even when encoding is broken (Latin-1 -> UTF-8)
 * CRITICAL: Also handles Mojibake (corrupted multi-byte chars like ç -> Ã§)
 */
export function normalizeHeader(header: string): string {
  if (!header) return '';
  
  // First, try to fix common Mojibake patterns (Latin-1 interpreted as UTF-8)
  let fixed = header
    // Common Mojibake for Portuguese characters
    .replace(/Ã§/g, 'c')   // ç
    .replace(/Ã£/g, 'a')   // ã
    .replace(/Ã¡/g, 'a')   // á
    .replace(/Ã /g, 'a')   // à
    .replace(/Ã¢/g, 'a')   // â
    .replace(/Ã©/g, 'e')   // é
    .replace(/Ãª/g, 'e')   // ê
    .replace(/Ã­/g, 'i')   // í
    .replace(/Ã³/g, 'o')   // ó
    .replace(/Ã´/g, 'o')   // ô
    .replace(/Ãµ/g, 'o')   // õ
    .replace(/Ãº/g, 'u')   // ú
    .replace(/Ã¼/g, 'u')   // ü
    // Remove any remaining corrupted multi-byte sequences
    .replace(/[\x80-\xFF]/g, '');
  
  return fixed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s()]/g, '') // keep only alphanumeric, spaces, parens
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get value from row using flexible column matching
 * Matches columns even with broken encoding or slight naming variations
 * CRITICAL: Handles Latin-1 encoding issues from Nuvemshop exports
 * 
 * Enhanced algorithm:
 * 1. Exact match
 * 2. Normalized match (after fixing Mojibake)
 * 3. Fuzzy match (first N chars match)
 * 4. Contains match (key contains name or vice versa)
 */
export function getColumnValue(row: Record<string, string>, ...columnNames: string[]): string | undefined {
  // First try exact match
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== '') {
      return row[name];
    }
  }
  
  // Build normalized versions
  const normalizedNames = columnNames.map(normalizeHeader);
  
  // Pre-process all row keys
  const rowEntries = Object.entries(row).map(([key, value]) => ({
    key,
    value,
    normalizedKey: normalizeHeader(key),
    keyCore: normalizeHeader(key).replace(/\s+/g, ''),
  }));
  
  // PASS 2: Normalized exact match
  for (const { value, normalizedKey } of rowEntries) {
    if (value === undefined || value === '') continue;
    if (normalizedNames.includes(normalizedKey)) {
      return value;
    }
  }
  
  // PASS 3: Fuzzy match - first 4 chars (handles "Preco" vs "Preço")
  for (const { value, keyCore } of rowEntries) {
    if (value === undefined || value === '') continue;
    if (keyCore.length < 4) continue;
    
    const keyPrefix = keyCore.slice(0, 4);
    
    for (const name of normalizedNames) {
      const nameCore = name.replace(/\s+/g, '');
      if (nameCore.length < 4) continue;
      
      const namePrefix = nameCore.slice(0, 4);
      
      // Match if either starts with the other's prefix
      if (keyPrefix === namePrefix) {
        return value;
      }
    }
  }
  
  // PASS 4: Contains match - for longer column names
  for (const { value, keyCore } of rowEntries) {
    if (value === undefined || value === '') continue;
    if (keyCore.length < 5) continue;
    
    for (const name of normalizedNames) {
      const nameCore = name.replace(/\s+/g, '');
      if (nameCore.length < 5) continue;
      
      // Check if one contains the other (for compound names)
      if (keyCore.includes(nameCore) || nameCore.includes(keyCore)) {
        return value;
      }
    }
  }
  
  return undefined;
}

/**
 * Parse price intelligently - handles multiple formats:
 * - Brazilian: 1.234,56 or 1234,56 or R$ 49,90
 * - American/Export: 1,234.56 or 1234.56 or 823.50
 * - Nuvemshop Export: 49.90 (always dot as decimal, no thousands)
 * - Plain: 823
 * 
 * CRITICAL: Nuvemshop exports prices with dot as decimal (49.90)
 * while display uses comma (R$ 49,90). This function handles both.
 */
export function parseBrazilianPrice(price: string | number | null | undefined): number {
  if (price === null || price === undefined || price === '') return 0;
  if (typeof price === 'number') return price;
  
  // Convert to string and clean
  let cleaned = price.toString()
    .replace(/R\$\s*/gi, '')  // Remove R$
    .replace(/[€$£¥]/g, '')   // Remove other currency symbols
    .replace(/\s+/g, '')      // Remove all whitespace
    .trim();
  
  if (!cleaned) return 0;
  
  // Remove any non-numeric chars except . and , 
  cleaned = cleaned.replace(/[^\d.,\-]/g, '');
  
  if (!cleaned) return 0;
  
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;
  
  // No decimal separators - parse as integer
  if (lastDot === -1 && lastComma === -1) {
    return parseFloat(cleaned) || 0;
  }
  
  // Only dots, no commas
  if (lastComma === -1 && lastDot !== -1) {
    if (dotCount === 1) {
      // Single dot - check if it's decimal or thousand
      const afterDot = cleaned.substring(lastDot + 1);
      if (afterDot.length <= 2) {
        // 823.50, 49.9 - dot is decimal (Nuvemshop export format)
        return parseFloat(cleaned) || 0;
      } else if (afterDot.length === 3) {
        // 1.234 - likely thousand separator, not decimal
        return parseFloat(cleaned.replace('.', '')) || 0;
      }
    } else {
      // Multiple dots: 1.234.567 - thousand separators
      return parseFloat(cleaned.replace(/\./g, '')) || 0;
    }
    return parseFloat(cleaned) || 0;
  }
  
  // Only commas, no dots
  if (lastDot === -1 && lastComma !== -1) {
    const afterComma = cleaned.substring(lastComma + 1);
    if (afterComma.length <= 2 && /^\d+$/.test(afterComma)) {
      // 823,50 or 49,9 - comma is decimal (Brazilian display format)
      return parseFloat(cleaned.replace(',', '.')) || 0;
    } else {
      // 1,234 or 1,234,567 - comma is thousand separator
      return parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  }
  
  // Both separators present - determine which is decimal by position
  if (lastDot > lastComma) {
    // Format: 1,234.56 (dot is decimal) - English format
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // Format: 1.234,56 (comma is decimal) - Brazilian format
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  return parseFloat(cleaned) || 0;
}

/**
 * Normalize phone number - extract only digits
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits;
}

/**
 * Normalize CPF/CNPJ - extract only digits and validate length
 */
export function normalizeCpfCnpj(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

/**
 * Normalize gender to standard format
 */
export function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase();
  if (g === 'm' || g === 'masculino' || g === 'male') return 'male';
  if (g === 'f' || g === 'feminino' || g === 'female') return 'female';
  return null;
}

/**
 * Parse a CSV line handling quoted fields that may contain commas
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push last field
  result.push(current.trim());
  
  return result;
}

/**
 * Remove BOM (Byte Order Mark) from string - common in Excel/Shopify CSV exports
 */
export function removeBOM(content: string): string {
  // Remove UTF-8 BOM (\uFEFF) and UTF-16 BOMs
  return content.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '');
}

/**
 * Parse CSV content into array of objects
 * CRITICAL: Handles BOM, quoted fields with commas, and MULTI-LINE values
 * Shopify CSV exports have descriptions with HTML that span multiple lines
 */
export function parseCSV(content: string): Record<string, string>[] {
  // CRITICAL: Remove BOM before parsing (common in Excel/Shopify exports)
  const cleanContent = removeBOM(content);
  
  // Parse CSV handling multi-line quoted values
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ""
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      // Field separator
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of row (not inside quotes)
      if (char === '\r') i++; // Skip \n in \r\n
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f)) { // Only add non-empty rows
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Push last field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f)) {
      rows.push(currentRow);
    }
  }
  
  if (rows.length < 2) return [];
  
  // First row is headers - clean them
  const headers = rows[0].map((h, idx) => {
    let clean = h.replace(/^"|"$/g, '').trim();
    if (idx === 0) {
      clean = removeBOM(clean);
    }
    return clean;
  });
  
  console.log('[parseCSV] Headers detected:', headers.slice(0, 10).join(', '), headers.length > 10 ? `... (${headers.length} total)` : '');
  
  const data: Record<string, string>[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].map(v => v.replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push(row);
  }
  
  console.log(`[parseCSV] Parsed ${data.length} rows`);
  
  return data;
}

/**
 * Consolidate Shopify CSV rows by Handle
 * Shopify exports multiple rows per product (one per variant/image)
 * This function groups them back into single products
 */
export function consolidateShopifyProducts(rows: Record<string, string>[]): Record<string, any>[] {
  const productMap = new Map<string, any>();
  
  for (const row of rows) {
    const handle = row['Handle'] || row['handle'] || '';
    if (!handle) {
      console.warn('[consolidateShopifyProducts] Row without Handle, skipping');
      continue;
    }
    
    if (!productMap.has(handle)) {
      // First row for this product - use as base
      // CRITICAL: Store base variant info (price/sku/stock) from first row
      productMap.set(handle, {
        ...row,
        _images: [] as string[],
        _imageAlts: new Map<string, string>(),
        _variants: [] as Record<string, string>[],
        _basePrice: row['Variant Price'] || row['Price'] || '',
        _baseSku: row['Variant SKU'] || row['SKU'] || '',
        _baseStock: row['Variant Inventory Qty'] || row['Inventory'] || '0',
        _baseComparePrice: row['Variant Compare At Price'] || row['Compare At Price'] || '',
        _baseBarcode: row['Variant Barcode'] || '',
        _baseGrams: row['Variant Grams'] || '',
      });
    }
    
    const product = productMap.get(handle)!;
    
    // Collect image if present (with alt text)
    const imageSrc = row['Image Src'] || row['image_src'] || '';
    if (imageSrc && !product._images.includes(imageSrc)) {
      product._images.push(imageSrc);
      const imageAlt = row['Image Alt Text'] || '';
      if (imageAlt) {
        product._imageAlts.set(imageSrc, imageAlt);
      }
    }
    
    // Collect variant if it has a distinct Option1 Value or SKU
    const opt1Value = row['Option1 Value'] || '';
    const variantSku = row['Variant SKU'] || '';
    const variantPrice = row['Variant Price'] || '';
    
    // Check if this is a new variant (different Option1 Value or SKU)
    const existingVariant = product._variants.find(
      (v: Record<string, string>) => 
        (v['Option1 Value'] === opt1Value && v['Variant SKU'] === variantSku)
    );
    
    if (!existingVariant && (opt1Value || variantSku || variantPrice)) {
      product._variants.push({
        'Option1 Name': row['Option1 Name'] || '',
        'Option1 Value': opt1Value,
        'Option2 Name': row['Option2 Name'] || '',
        'Option2 Value': row['Option2 Value'] || '',
        'Option3 Name': row['Option3 Name'] || '',
        'Option3 Value': row['Option3 Value'] || '',
        'Variant SKU': variantSku,
        'Variant Price': variantPrice,
        'Variant Compare At Price': row['Variant Compare At Price'] || '',
        'Variant Inventory Qty': row['Variant Inventory Qty'] || '',
        'Variant Barcode': row['Variant Barcode'] || '',
        'Variant Grams': row['Variant Grams'] || '',
      });
    }
    
    // CRITICAL: Use Title from first row that has it (not from image-only rows)
    if (!product['Title'] && row['Title']) {
      product['Title'] = row['Title'];
    }
    if (!product['Body (HTML)'] && row['Body (HTML)']) {
      product['Body (HTML)'] = row['Body (HTML)'];
    }
  }
  
  // Convert back to array, enriching with collected data
  const consolidated: Record<string, any>[] = [];
  
  for (const [handle, product] of productMap) {
    // Create images array for the normalizer
    const images = product._images.map((src: string, idx: number) => ({
      src,
      position: idx,
      alt: product._imageAlts.get(src) || null,
    }));
    
    // Create variants array for the normalizer
    const variants = product._variants.length > 0 
      ? product._variants.map((v: Record<string, string>) => ({
          title: v['Option1 Value'] || 'Default',
          sku: v['Variant SKU'] || null,
          price: v['Variant Price'] || product._basePrice || '0',
          compare_at_price: v['Variant Compare At Price'] || null,
          inventory_quantity: parseInt(v['Variant Inventory Qty'] || '0', 10),
          option1: v['Option1 Value'] || null,
          option2: v['Option2 Value'] || null,
          option3: v['Option3 Value'] || null,
        }))
      : undefined;
    
    // CRITICAL: Ensure base product fields are populated from stored values
    // This is where price/sku/stock were being lost!
    const enrichedProduct = {
      ...product,
      // Ensure these fields are explicitly set (not just inherited from first row)
      'Variant Price': product._basePrice || product['Variant Price'] || '',
      'Variant SKU': product._baseSku || product['Variant SKU'] || '',
      'Variant Inventory Qty': product._baseStock || product['Variant Inventory Qty'] || '0',
      'Variant Compare At Price': product._baseComparePrice || product['Variant Compare At Price'] || '',
      'Variant Barcode': product._baseBarcode || product['Variant Barcode'] || '',
      'Variant Grams': product._baseGrams || product['Variant Grams'] || '',
      // Attach parsed arrays
      images: images.length > 0 ? images : undefined,
      variants: variants,
    };
    
    // Clean up internal fields
    delete enrichedProduct._images;
    delete enrichedProduct._imageAlts;
    delete enrichedProduct._variants;
    delete enrichedProduct._basePrice;
    delete enrichedProduct._baseSku;
    delete enrichedProduct._baseStock;
    delete enrichedProduct._baseComparePrice;
    delete enrichedProduct._baseBarcode;
    delete enrichedProduct._baseGrams;
    
    consolidated.push(enrichedProduct);
  }
  
  console.log(`[consolidateShopifyProducts] Consolidated ${rows.length} rows into ${consolidated.length} products`);
  
  // Debug: Log first product to verify fields
  if (consolidated.length > 0) {
    const first = consolidated[0];
    console.log(`[consolidateShopifyProducts] First product check: Title="${first['Title']}", Price="${first['Variant Price']}", SKU="${first['Variant SKU']}", Images=${first.images?.length || 0}`);
  }
  
  return consolidated;
}

/**
 * Consolidate Shopify Customer CSV rows by Email
 * Shopify may export multiple rows per customer (one per address)
 * This function groups them by email into single customers
 */
export function consolidateShopifyCustomers(rows: Record<string, string>[]): Record<string, any>[] {
  const customerMap = new Map<string, any>();
  
  for (const row of rows) {
    // Get email - normalize to lowercase
    const rawEmail = row['Email'] || row['email'] || row['Customer Email'] || row['E-mail'] || '';
    const email = rawEmail.toString().toLowerCase().trim();
    
    if (!email) {
      console.warn('[consolidateShopifyCustomers] Row without email, skipping');
      continue;
    }
    
    if (!customerMap.has(email)) {
      // First row for this customer - use as base
      customerMap.set(email, {
        ...row,
        _addresses: [] as Record<string, string>[],
      });
    }
    
    const customer = customerMap.get(email)!;
    
    // Collect address if present (different from first)
    const address1 = row['Address1'] || row['Default Address Address1'] || '';
    const city = row['City'] || row['Default Address City'] || '';
    
    if (address1 && city) {
      // Check if this address is already collected
      const existingAddr = customer._addresses.find(
        (a: Record<string, string>) => 
          a['Address1'] === address1 && a['City'] === city
      );
      
      if (!existingAddr) {
        customer._addresses.push({
          'Address1': address1,
          'Address2': row['Address2'] || row['Default Address Address2'] || '',
          'City': city,
          'Province': row['Province'] || row['Default Address Province'] || '',
          'Province Code': row['Province Code'] || row['Default Address Province Code'] || '',
          'Country': row['Country'] || row['Default Address Country'] || '',
          'Country Code': row['Country Code'] || row['Default Address Country Code'] || '',
          'Zip': row['Zip'] || row['Default Address Zip'] || '',
          'Phone': row['Default Address Phone'] || row['Phone'] || '',
          'Company': row['Company'] || row['Default Address Company'] || '',
        });
      }
    }
    
    // Update fields if they were empty in base row
    if (!customer['First Name'] && row['First Name']) customer['First Name'] = row['First Name'];
    if (!customer['Last Name'] && row['Last Name']) customer['Last Name'] = row['Last Name'];
    if (!customer['Phone'] && row['Phone']) customer['Phone'] = row['Phone'];
  }
  
  // Convert back to array
  const consolidated: Record<string, any>[] = [];
  
  for (const [email, customer] of customerMap) {
    const enrichedCustomer = {
      ...customer,
      addresses: customer._addresses.length > 0 ? customer._addresses : undefined,
    };
    
    delete enrichedCustomer._addresses;
    consolidated.push(enrichedCustomer);
  }
  
  console.log(`[consolidateShopifyCustomers] Consolidated ${rows.length} rows into ${consolidated.length} customers`);
  
  return consolidated;
}

/**
 * Consolidate Shopify Order CSV rows by Order Name/Number
 * Shopify exports multiple rows per order (one per line item)
 * This function groups them back into single orders
 */
export function consolidateShopifyOrders(rows: Record<string, string>[]): Record<string, any>[] {
  const orderMap = new Map<string, any>();
  
  for (const row of rows) {
    // Get order name/number
    const orderName = row['Name'] || row['Order Number'] || row['Número do Pedido'] || row['Pedido'] || '';
    
    if (!orderName) {
      console.warn('[consolidateShopifyOrders] Row without order name, skipping');
      continue;
    }
    
    if (!orderMap.has(orderName)) {
      // First row for this order - use as base
      orderMap.set(orderName, {
        ...row,
        _lineItems: [] as Record<string, string>[],
      });
    }
    
    const order = orderMap.get(orderName)!;
    
    // Collect line item if present
    const lineItemName = row['Lineitem name'] || '';
    const lineItemQty = row['Lineitem quantity'] || '';
    const lineItemPrice = row['Lineitem price'] || '';
    
    if (lineItemName || lineItemQty || lineItemPrice) {
      order._lineItems.push({
        'Lineitem name': lineItemName,
        'Lineitem quantity': lineItemQty,
        'Lineitem price': lineItemPrice,
        'Lineitem sku': row['Lineitem sku'] || '',
        'Lineitem discount': row['Lineitem discount'] || '',
        'Lineitem compare at price': row['Lineitem compare at price'] || '',
      });
    }
  }
  
  // Convert back to array
  const consolidated: Record<string, any>[] = [];
  
  for (const [orderName, order] of orderMap) {
    const enrichedOrder = {
      ...order,
      line_items: order._lineItems.length > 0 ? order._lineItems : undefined,
    };
    
    delete enrichedOrder._lineItems;
    consolidated.push(enrichedOrder);
  }
  
  console.log(`[consolidateShopifyOrders] Consolidated ${rows.length} rows into ${consolidated.length} orders`);
  
  return consolidated;
}

/**
 * Detect if text has mojibake (Latin-1 read as UTF-8) and fix it
 * Common in Nuvemshop CSV exports
 * Returns the fixed text if mojibake detected, original otherwise
 */
export function fixMojibakeText(text: string): string {
  // Common mojibake patterns: ç→Ã§, ã→Ã£, é→Ã©, etc.
  const mojibakePatterns = [
    /Ã§/g, /Ã£/g, /Ã¡/g, /Ã©/g, /Ãª/g, /Ã­/g, /Ã³/g, /Ã´/g, /Ãµ/g, /Ãº/g, /Ã¼/g,
    /Ã‡/g, /Ãƒ/g, /Ã‰/g, /Ã"/g,
  ];
  
  // Count mojibake occurrences
  let mojibakeCount = 0;
  for (const pattern of mojibakePatterns) {
    const matches = text.match(pattern);
    if (matches) mojibakeCount += matches.length;
  }
  
  // If very few mojibake patterns, likely not a encoding issue
  if (mojibakeCount < 3) return text;
  
  console.log(`[fixMojibakeText] Detected ${mojibakeCount} mojibake patterns, attempting fix...`);
  
  // Fix common mojibake replacements (Latin-1 → UTF-8 corruption)
  const fixed = text
    // Lowercase accented
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã /g, 'à')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã¼/g, 'ü')
    // Uppercase accented
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ãƒ/g, 'Ã')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã€/g, 'À')
    .replace(/Ã‚/g, 'Â')
    .replace(/ÃŠ/g, 'Ê')
    .replace(/ÃŒ/g, 'Ì')
    .replace(/Ã'/g, 'Ò')
    .replace(/Ã"/g, 'Ô')
    .replace(/Ã•/g, 'Õ')
    .replace(/Ã™/g, 'Ù')
    .replace(/Ã›/g, 'Û');
  
  console.log(`[fixMojibakeText] Fixed mojibake encoding`);
  return fixed;
}

/**
 * Read file with encoding auto-detection
 * Tries UTF-8 first, if mojibake detected re-reads as Latin-1
 */
export async function readFileWithEncoding(file: File): Promise<string> {
  // First try UTF-8 (default)
  let text = await file.text();
  
  // Check for mojibake patterns
  const mojibakePatterns = /Ã§|Ã£|Ã¡|Ã©|Ãª|Ã­|Ã³|Ã´|Ãµ|Ãº/g;
  const matches = text.match(mojibakePatterns);
  
  if (matches && matches.length >= 3) {
    console.log(`[readFileWithEncoding] Detected ${matches.length} mojibake patterns, re-reading as Latin-1...`);
    
    // Re-read with Latin-1 encoding
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('iso-8859-1');
      text = decoder.decode(arrayBuffer);
      console.log('[readFileWithEncoding] Re-read file as Latin-1 successfully');
    } catch (e) {
      console.warn('[readFileWithEncoding] Failed to re-read as Latin-1, using mojibake fix instead');
      text = fixMojibakeText(text);
    }
  }
  
  return text;
}

/**
 * Consolidate Nuvemshop CSV rows by "Identificador URL" or "URL"
 * Nuvemshop exports multiple rows per product (one per variant), similar to Shopify
 * This function groups them back into single products with variants
 */
export function consolidateNuvemshopProducts(rows: Record<string, string>[]): Record<string, any>[] {
  if (rows.length === 0) return [];
  
  const productMap = new Map<string, any>();
  
  // Determine which column is the grouping key
  const sampleRow = rows[0];
  const groupKey = findNuvemshopGroupKey(sampleRow);
  
  if (!groupKey) {
    console.log('[consolidateNuvemshopProducts] No grouping key found, returning rows as-is');
    return rows;
  }
  
  console.log(`[consolidateNuvemshopProducts] Using grouping key: "${groupKey}"`);
  
  for (const row of rows) {
    const key = (row[groupKey] || '').trim().toLowerCase();
    if (!key) {
      console.warn('[consolidateNuvemshopProducts] Row without grouping key, skipping');
      continue;
    }
    
    if (!productMap.has(key)) {
      // First row for this product - use as base
      productMap.set(key, {
        ...row,
        _variants: [] as Record<string, string>[],
        _images: [] as string[],
      });
    }
    
    const product = productMap.get(key)!;
    
    // Collect variant data from this row
    const variantData: Record<string, string> = {};
    let hasVariantInfo = false;
    
    // Look for variant-specific columns (Variação 1, Variação 2, Variação 3, Cor, Tamanho, etc.)
    for (const [colKey, colVal] of Object.entries(row)) {
      const normalizedCol = colKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        normalizedCol.includes('variacao') || 
        normalizedCol.includes('variação') ||
        normalizedCol.includes('variacion') ||
        normalizedCol.match(/^(cor|tamanho|size|color|material)$/i)
      ) {
        if (colVal && colVal.trim()) {
          variantData[colKey] = colVal.trim();
          hasVariantInfo = true;
        }
      }
    }
    
    // Also check price/sku/stock for this variant row
    for (const colKey of Object.keys(row)) {
      const normalizedCol = colKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        normalizedCol.includes('preco') || normalizedCol.includes('precio') || normalizedCol === 'price' ||
        normalizedCol === 'sku' || 
        normalizedCol.includes('estoque') || normalizedCol === 'stock' ||
        normalizedCol.includes('codigo de barras') || normalizedCol === 'barcode' ||
        normalizedCol.includes('peso') || normalizedCol === 'weight'
      ) {
        variantData[colKey] = row[colKey] || '';
      }
    }
    
    // If this row has different variant info than the base, add as variant
    if (hasVariantInfo) {
      const existingVariant = product._variants.find(
        (v: Record<string, string>) => {
          // Check if all variant option values match
          for (const [vk, vv] of Object.entries(variantData)) {
            if (vk.toLowerCase().includes('variação') || vk.toLowerCase().includes('variacao')) {
              if (v[vk] !== vv) return false;
            }
          }
          return true;
        }
      );
      
      if (!existingVariant) {
        product._variants.push(variantData);
      }
    }
    
    // Collect images from this row
    for (let i = 1; i <= 15; i++) {
      for (const imgCol of [`URL da imagem ${i}`, `Imagem ${i}`, `Image ${i}`]) {
        const imgUrl = row[imgCol];
        if (imgUrl && imgUrl.startsWith('http') && !product._images.includes(imgUrl)) {
          product._images.push(imgUrl);
        }
      }
    }
    // Also check main image and additional
    const mainImg = row['Imagem principal'] || row['Main Image'] || '';
    if (mainImg && mainImg.startsWith('http') && !product._images.includes(mainImg)) {
      product._images.unshift(mainImg); // Main image first
    }
    
    // Fill in missing base fields from subsequent rows
    const nameCol = findColumnByNormalized(row, ['nome', 'nome do produto', 'name', 'title']);
    if (nameCol && row[nameCol] && !product[nameCol]) {
      product[nameCol] = row[nameCol];
    }
    
    const descCol = findColumnByNormalized(row, ['descricao', 'description']);
    if (descCol && row[descCol] && !product[descCol]) {
      product[descCol] = row[descCol];
    }
  }
  
  // Convert back to array
  const consolidated: Record<string, any>[] = [];
  
  for (const [key, product] of productMap) {
    const enrichedProduct = { ...product };
    
    // Keep variant and image info for the normalizer
    if (product._images.length > 0) {
      enrichedProduct._collectedImages = product._images;
    }
    if (product._variants.length > 0) {
      enrichedProduct._collectedVariants = product._variants;
    }
    
    delete enrichedProduct._variants;
    delete enrichedProduct._images;
    
    consolidated.push(enrichedProduct);
  }
  
  console.log(`[consolidateNuvemshopProducts] Consolidated ${rows.length} rows into ${consolidated.length} products`);
  
  if (consolidated.length > 0) {
    const first = consolidated[0];
    const nameKey = findColumnByNormalized(first, ['nome', 'nome do produto', 'name']);
    console.log(`[consolidateNuvemshopProducts] First product: "${nameKey ? first[nameKey] : 'unknown'}", variants: ${first._collectedVariants?.length || 0}, images: ${first._collectedImages?.length || 0}`);
  }
  
  return consolidated;
}

/**
 * Find the grouping key column for Nuvemshop CSVs
 */
function findNuvemshopGroupKey(row: Record<string, string>): string | null {
  const candidates = [
    'Identificador URL', 'URL', 'Handle', 'Slug', 'slug',
    'Identificador', 'Link', 'Permalink',
  ];
  
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return candidate;
  }
  
  // Try normalized matching
  for (const [key] of Object.entries(row)) {
    const normalized = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized === 'identificador url' || normalized === 'url' || normalized === 'handle') {
      return key;
    }
  }
  
  return null;
}

/**
 * Find a column by normalized name match
 */
function findColumnByNormalized(row: Record<string, string>, names: string[]): string | null {
  for (const [key] of Object.entries(row)) {
    const normalized = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (names.includes(normalized)) return key;
  }
  return null;
}
