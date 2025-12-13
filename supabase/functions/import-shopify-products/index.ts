import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyProduct {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  productCategory: string;
  type: string;
  tags: string;
  published: boolean;
  variantSku: string;
  variantPrice: number;
  variantCompareAtPrice: number | null;
  variantGrams: number;
  variantBarcode: string;
  variantInventoryQty: number;
  seoTitle: string;
  seoDescription: string;
  status: string;
  images: string[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseShopifyCSV(csvContent: string): ShopifyProduct[] {
  const lines = csvContent.split('\n');
  const products: Map<string, ShopifyProduct> = new Map();
  
  // Find header indices
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const indices = {
    handle: headers.indexOf('Handle'),
    title: headers.indexOf('Title'),
    body: headers.indexOf('Body (HTML)'),
    vendor: headers.indexOf('Vendor'),
    productCategory: headers.indexOf('Product Category'),
    type: headers.indexOf('Type'),
    tags: headers.indexOf('Tags'),
    published: headers.indexOf('Published'),
    variantSku: headers.indexOf('Variant SKU'),
    variantGrams: headers.indexOf('Variant Grams'),
    variantInventoryQty: headers.indexOf('Variant Inventory Qty'),
    variantPrice: headers.indexOf('Variant Price'),
    variantCompareAtPrice: headers.indexOf('Variant Compare At Price'),
    variantBarcode: headers.indexOf('Variant Barcode'),
    imageSrc: headers.indexOf('Image Src'),
    imagePosition: headers.indexOf('Image Position'),
    seoTitle: headers.indexOf('SEO Title'),
    seoDescription: headers.indexOf('SEO Description'),
    status: headers.indexOf('Status'),
  };

  console.log('Header indices:', indices);
  
  // Process data lines
  let currentHandle = '';
  let currentLine = '';
  let lineNumber = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Check if this line starts a new product or continues the previous one
    // A new product line starts with a handle (non-empty first column before first comma)
    const firstComma = line.indexOf(',');
    const potentialHandle = line.substring(0, firstComma);
    
    // If the line has proper CSV structure (starts with handle pattern or is continuation)
    if (potentialHandle && !potentialHandle.includes('<') && !potentialHandle.includes('>') && 
        (potentialHandle.match(/^[a-z0-9-]+$/) || potentialHandle === '')) {
      
      // Process previous accumulated line if exists
      if (currentLine) {
        processLine(currentLine, products, indices, lineNumber);
      }
      
      currentLine = line;
      currentHandle = potentialHandle || currentHandle;
      lineNumber = i;
    } else {
      // This is a continuation of a multi-line field
      currentLine += '\n' + line;
    }
  }
  
  // Process last line
  if (currentLine) {
    processLine(currentLine, products, indices, lineNumber);
  }
  
  return Array.from(products.values());
}

function processLine(line: string, products: Map<string, ShopifyProduct>, indices: any, lineNumber: number) {
  try {
    const fields = parseCSVLine(line);
    const handle = fields[indices.handle];
    
    if (!handle) return;
    
    // Check if product already exists (this row might be for additional images/variants)
    if (products.has(handle)) {
      const existingProduct = products.get(handle)!;
      
      // Add additional images
      const imageSrc = fields[indices.imageSrc];
      if (imageSrc && !existingProduct.images.includes(imageSrc)) {
        existingProduct.images.push(imageSrc);
      }
    } else {
      // New product
      const title = fields[indices.title];
      if (!title) return; // Skip rows that are just for images
      
      const variantPrice = parseFloat(fields[indices.variantPrice]?.replace(',', '.') || '0');
      const variantCompareAtPrice = fields[indices.variantCompareAtPrice] 
        ? parseFloat(fields[indices.variantCompareAtPrice].replace(',', '.')) 
        : null;
      
      const product: ShopifyProduct = {
        handle,
        title,
        description: fields[indices.body] || '',
        vendor: fields[indices.vendor] || '',
        productCategory: fields[indices.productCategory] || '',
        type: fields[indices.type] || '',
        tags: fields[indices.tags] || '',
        published: fields[indices.published] === 'true',
        variantSku: fields[indices.variantSku]?.replace(/'/g, '') || handle.toUpperCase(),
        variantPrice: isNaN(variantPrice) ? 0 : variantPrice,
        variantCompareAtPrice: variantCompareAtPrice && !isNaN(variantCompareAtPrice) ? variantCompareAtPrice : null,
        variantGrams: parseFloat(fields[indices.variantGrams] || '0'),
        variantBarcode: fields[indices.variantBarcode]?.replace(/'/g, '') || '',
        variantInventoryQty: parseInt(fields[indices.variantInventoryQty] || '0', 10),
        seoTitle: fields[indices.seoTitle] || '',
        seoDescription: fields[indices.seoDescription] || '',
        status: fields[indices.status] || 'active',
        images: fields[indices.imageSrc] ? [fields[indices.imageSrc]] : [],
      };
      
      products.set(handle, product);
    }
  } catch (error) {
    console.error(`Error processing line ${lineNumber}:`, error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { csvContent, tenantId } = await req.json();
    
    if (!csvContent || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing csvContent or tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting Shopify CSV import for tenant:', tenantId);
    console.log('CSV content length:', csvContent.length);
    
    // Parse CSV
    const shopifyProducts = parseShopifyCSV(csvContent);
    console.log('Parsed products count:', shopifyProducts.length);

    if (shopifyProducts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No products found in CSV' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Import products
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const shopifyProduct of shopifyProducts) {
      try {
        // Check if product already exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('slug', shopifyProduct.handle)
          .maybeSingle();

        if (existingProduct) {
          console.log(`Product ${shopifyProduct.handle} already exists, skipping`);
          continue;
        }

        // Map Shopify status to our status
        const statusMap: Record<string, string> = {
          'active': 'active',
          'draft': 'draft',
          'archived': 'archived',
        };

        // Insert product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            tenant_id: tenantId,
            sku: shopifyProduct.variantSku || shopifyProduct.handle.toUpperCase().replace(/-/g, ''),
            name: shopifyProduct.title,
            slug: shopifyProduct.handle,
            description: shopifyProduct.description,
            price: shopifyProduct.variantPrice,
            compare_at_price: shopifyProduct.variantCompareAtPrice,
            stock_quantity: Math.max(0, shopifyProduct.variantInventoryQty),
            weight: shopifyProduct.variantGrams > 0 ? shopifyProduct.variantGrams / 1000 : null,
            barcode: shopifyProduct.variantBarcode || null,
            seo_title: shopifyProduct.seoTitle || null,
            seo_description: shopifyProduct.seoDescription || null,
            status: statusMap[shopifyProduct.status] || 'active',
            manage_stock: true,
          })
          .select('id')
          .single();

        if (productError) {
          console.error(`Error inserting product ${shopifyProduct.handle}:`, productError);
          results.failed++;
          results.errors.push(`${shopifyProduct.handle}: ${productError.message}`);
          continue;
        }

        // Insert images
        if (newProduct && shopifyProduct.images.length > 0) {
          const imageInserts = shopifyProduct.images.map((url, index) => ({
            product_id: newProduct.id,
            url,
            sort_order: index,
            is_primary: index === 0,
          }));

          const { error: imageError } = await supabase
            .from('product_images')
            .insert(imageInserts);

          if (imageError) {
            console.error(`Error inserting images for ${shopifyProduct.handle}:`, imageError);
          }
        }

        results.success++;
        console.log(`Imported product: ${shopifyProduct.title}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing product ${shopifyProduct.handle}:`, error);
        results.failed++;
        results.errors.push(`${shopifyProduct.handle}: ${errorMessage}`);
      }
    }

    console.log('Import complete:', results);

    return new Response(
      JSON.stringify({
        message: 'Import complete',
        totalParsed: shopifyProducts.length,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
