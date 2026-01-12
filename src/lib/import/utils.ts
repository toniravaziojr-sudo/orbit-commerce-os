// =============================================
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
 * Parse Brazilian price format (R$ 49,90 or 49.90)
 */
export function parseBrazilianPrice(price: string | number | null | undefined): number {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  
  // Remove currency symbol and spaces
  const cleaned = price.replace(/[R$\s]/g, '');
  
  // Handle Brazilian format (1.234,56) vs American format (1,234.56)
  // If has comma followed by 2 digits at end, it's Brazilian
  if (/,\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  
  // Otherwise assume standard format
  return parseFloat(cleaned.replace(',', '')) || 0;
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
