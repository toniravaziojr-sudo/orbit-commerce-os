import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileJson, Globe, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DataUploaderProps {
  platform: string;
  modules: string[];
  onDataLoaded: (data: Record<string, any[]>) => void;
}

export function DataUploader({ platform, modules, onDataLoaded }: DataUploaderProps) {
  const [activeTab, setActiveTab] = useState('file');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedData, setLoadedData] = useState<Record<string, any[]>>({});

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, module: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    
    // Use encoding-aware reading for CSV files (fixes Latin-1 mojibake from Nuvemshop)
    const processFile = async () => {
      try {
        let content: string;
        
        if (file.name.endsWith('.csv')) {
          // Try UTF-8 first, detect and fix mojibake
          content = await file.text();
          const mojibakePatterns = /Ã§|Ã£|Ã¡|Ã©|Ãª|Ã­|Ã³|Ã´|Ãµ|Ãº/g;
          const matches = content.match(mojibakePatterns);
          
          if (matches && matches.length >= 3) {
            console.log(`[DataUploader] Detected ${matches.length} mojibake patterns, re-reading as Latin-1...`);
            try {
              const arrayBuffer = await file.arrayBuffer();
              const decoder = new TextDecoder('iso-8859-1');
              content = decoder.decode(arrayBuffer);
            } catch (e) {
              console.warn('[DataUploader] Failed Latin-1 re-read, using mojibake fix');
              // Fix in-place
              content = content
                .replace(/Ã§/g, 'ç').replace(/Ã£/g, 'ã').replace(/Ã¡/g, 'á')
                .replace(/Ã©/g, 'é').replace(/Ãª/g, 'ê').replace(/Ã­/g, 'í')
                .replace(/Ã³/g, 'ó').replace(/Ã´/g, 'ô').replace(/Ãµ/g, 'õ')
                .replace(/Ãº/g, 'ú').replace(/Ã¼/g, 'ü');
            }
          }
        } else {
          content = await file.text();
        }
        
        let data: any[];

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            data = parsed;
          } else {
            data = parsed.data || parsed.items || parsed.products || parsed.customers || parsed.orders || parsed.categories || [parsed];
          }
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(content);
        } else {
          throw new Error('Formato de arquivo não suportado. Use JSON ou CSV.');
        }

        setLoadedData(prev => {
          const updated = { ...prev, [module]: data };
          onDataLoaded(updated);
          return updated;
        });
      } catch (err: any) {
        setError(err.message);
      }
    };
    
    processFile();
  }, [onDataLoaded]);

  const handleJsonPaste = useCallback(() => {
    setError(null);
    try {
      const parsed = JSON.parse(jsonText);
      
      // Try to auto-detect structure
      const data: Record<string, any[]> = {};
      
      if (Array.isArray(parsed)) {
        // Single array - try to detect type from first item
        if (parsed.length > 0) {
          const first = parsed[0];
          if (first.variants || first.images || first.price !== undefined) {
            data.products = parsed;
          } else if (first.parent_id !== undefined || first.parent_slug) {
            data.categories = parsed;
          } else if (first.email && (first.addresses || first.phone)) {
            data.customers = parsed;
          } else if (first.order_number || first.items) {
            data.orders = parsed;
          }
        }
      } else {
        // Object with keys
        if (parsed.products) data.products = Array.isArray(parsed.products) ? parsed.products : [parsed.products];
        if (parsed.categories) data.categories = Array.isArray(parsed.categories) ? parsed.categories : [parsed.categories];
        if (parsed.customers) data.customers = Array.isArray(parsed.customers) ? parsed.customers : [parsed.customers];
        if (parsed.orders) data.orders = Array.isArray(parsed.orders) ? parsed.orders : [parsed.orders];
      }

      if (Object.keys(data).length === 0) {
        throw new Error('Não foi possível identificar os dados. Verifique o formato.');
      }

      setLoadedData(data);
      onDataLoaded(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [jsonText, onDataLoaded]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Carregar dados de {platform}</h3>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file">
            <Upload className="h-4 w-4 mr-2" />
            Upload de Arquivo
          </TabsTrigger>
          <TabsTrigger value="json">
            <FileJson className="h-4 w-4 mr-2" />
            Colar JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Faça upload de arquivos JSON ou CSV exportados da sua plataforma.
          </p>
          
          {modules.map((module) => (
            <div key={module} className="space-y-2">
              <Label htmlFor={`file-${module}`} className="capitalize">
                {module === 'categories' ? 'Categorias' : 
                 module === 'products' ? 'Produtos' : 
                 module === 'customers' ? 'Clientes' : 'Pedidos'}
                {loadedData[module] && (
                  <span className="ml-2 text-xs text-primary">
                    ({loadedData[module].length} itens carregados)
                  </span>
                )}
              </Label>
              <Input
                id={`file-${module}`}
                type="file"
                accept=".json,.csv"
                onChange={(e) => handleFileUpload(e, module)}
              />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="json" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Cole os dados JSON exportados da API da sua plataforma.
          </p>
          
          <Textarea
            placeholder='{"products": [...], "categories": [...]}'
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
          
          <Button onClick={handleJsonPaste} disabled={!jsonText.trim()}>
            Processar JSON
          </Button>

          {Object.keys(loadedData).length > 0 && (
            <div className="text-sm text-muted-foreground">
              Dados carregados:
              <ul className="list-disc list-inside mt-1">
                {Object.entries(loadedData).map(([key, items]) => (
                  <li key={key} className="capitalize">
                    {key}: {items.length} itens
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function parseCSV(content: string): any[] {
  // Remove BOM if present
  let cleanContent = content.trim();
  if (cleanContent.charCodeAt(0) === 0xFEFF) {
    cleanContent = cleanContent.substring(1);
  }
  
  // Use robust multi-line CSV parser
  const rows = parseCSVRobust(cleanContent);
  if (rows.length < 2) return [];
  
  // First row is headers
  const headers = rows[0].map(h => h.trim().replace(/^\ufeff/, '').replace(/\s+/g, ' '));
  
  console.log(`[parseCSV] Parsed ${rows.length - 1} rows with ${headers.length} columns`);
  
  const rawRows: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length >= headers.length - 1) { // Allow slight mismatch
      const obj: any = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          obj[header] = values[index];
        }
      });
      rawRows.push(obj);
    }
  }

  console.log(`[parseCSV] Created ${rawRows.length} raw row objects`);

  // Check if this is a Shopify product export (has Handle column and multiple rows per product)
  const hasHandle = headers.some(h => h.toLowerCase() === 'handle');
  const hasTitle = headers.some(h => h.toLowerCase() === 'title');
  const hasVariantSKU = headers.some(h => h.toLowerCase().includes('variant') && h.toLowerCase().includes('sku'));
  
  // Check if this is a Shopify order export (has Name column for order number and Lineitem columns)
  const hasOrderName = headers.some(h => h === 'Name' || h.toLowerCase() === 'name');
  const hasLineitemName = headers.some(h => h.toLowerCase().includes('lineitem') && h.toLowerCase().includes('name'));
  const hasFinancialStatus = headers.some(h => h.toLowerCase().includes('financial') && h.toLowerCase().includes('status'));
  
  // Log detection info for debugging
  console.log('[parseCSV] Detection:', { hasHandle, hasTitle, hasVariantSKU, hasOrderName, hasLineitemName, hasFinancialStatus });
  console.log('[parseCSV] Sample headers:', headers.slice(0, 15));
  
  if (hasHandle && hasTitle && hasVariantSKU) {
    // Group rows by Handle and merge variant data
    const grouped = groupShopifyProductRows(rawRows);
    console.log(`[parseCSV] Grouped into ${grouped.length} unique products`);
    return grouped;
  }
  
  // IMPORTANT: Detect order CSV - check for 'Name' column that looks like order numbers (#1001, etc.)
  if (hasOrderName && hasLineitemName && hasFinancialStatus) {
    // Verify that 'Name' column contains order numbers (starts with # or is numeric)
    const sampleName = rawRows[0]?.['Name'] || rawRows[0]?.['name'] || '';
    console.log('[parseCSV] Order detection - sample Name:', sampleName);
    
    // Group rows by order Name and merge line items
    const grouped = groupShopifyOrderRows(rawRows);
    console.log(`[parseCSV] ORDERS: Grouped ${rawRows.length} rows into ${grouped.length} unique orders`);
    return grouped;
  }

  return rawRows;
}

// Robust CSV parser that handles multi-line fields enclosed in quotes
function parseCSVRobust(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  // Detect delimiter from first line (before any quotes)
  const firstLineEnd = content.indexOf('\n');
  const firstLine = firstLineEnd > 0 ? content.substring(0, firstLineEnd) : content;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote - add one quote and skip next
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Regular character inside quotes (including newlines)
        currentField += char;
        i++;
        continue;
      }
    } else {
      // Not inside quotes
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r' && nextChar === '\n') {
        // Windows line ending - end of row
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) { // Skip completely empty rows
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i += 2;
        continue;
      } else if (char === '\n') {
        // Unix line ending - end of row
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f !== '')) { // Skip completely empty rows
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        // Regular character
        currentField += char;
        i++;
        continue;
      }
    }
  }
  
  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }
  
  console.log(`[parseCSVRobust] Parsed ${rows.length} total rows from content`);
  
  return rows;
}

// Group Shopify CSV rows by Handle (products with variants have multiple rows)
function groupShopifyProductRows(rows: any[]): any[] {
  const productMap = new Map<string, any>();

  console.log(`[groupShopifyProductRows] Processing ${rows.length} raw rows...`);

  for (const row of rows) {
    const handle = row['Handle'] || '';
    if (!handle) {
      // Log para debug de linhas sem handle
      console.log('[groupShopifyProductRows] Row without Handle:', Object.keys(row).slice(0, 5));
      continue;
    }

    if (!productMap.has(handle)) {
      // First row for this product - use as base (has the title and main info)
      productMap.set(handle, {
        ...row,
        variants: [],
        images: [],
      });
    }

    const product = productMap.get(handle)!;
    
    // Fill in missing fields from the first row (Shopify only puts Title on first row)
    if (!product['Title'] && row['Title']) {
      product['Title'] = row['Title'];
    }
    if (!product['Body (HTML)'] && row['Body (HTML)']) {
      product['Body (HTML)'] = row['Body (HTML)'];
    }
    if (!product['Vendor'] && row['Vendor']) {
      product['Vendor'] = row['Vendor'];
    }
    if (!product['Type'] && row['Type']) {
      product['Type'] = row['Type'];
    }
    if (!product['Tags'] && row['Tags']) {
      product['Tags'] = row['Tags'];
    }
    if (!product['Published'] && row['Published']) {
      product['Published'] = row['Published'];
    }
    if (!product['SEO Title'] && row['SEO Title']) {
      product['SEO Title'] = row['SEO Title'];
    }
    if (!product['SEO Description'] && row['SEO Description']) {
      product['SEO Description'] = row['SEO Description'];
    }
    if (!product['Status'] && row['Status']) {
      product['Status'] = row['Status'];
    }

    // Add variant data if present
    const variantSKU = row['Variant SKU'];
    const variantPrice = row['Variant Price'];
    if (variantSKU || variantPrice) {
      product.variants.push({
        sku: variantSKU || null,
        price: variantPrice || '0',
        compare_at_price: row['Variant Compare At Price'] || null,
        inventory_quantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
        weight: parseFloat(row['Variant Grams'] || row['Variant Weight'] || '0') || null,
        barcode: row['Variant Barcode'] || null,
        option1: row['Option1 Value'] || null,
        option2: row['Option2 Value'] || null,
        option3: row['Option3 Value'] || null,
        title: [row['Option1 Value'], row['Option2 Value'], row['Option3 Value']]
          .filter(Boolean)
          .join(' / ') || 'Default',
      });
    }

    // Add image if present and not duplicate
    const imageSrc = row['Image Src'];
    if (imageSrc && !product.images.some((img: any) => img.src === imageSrc)) {
      product.images.push({
        src: imageSrc,
        alt: row['Image Alt Text'] || null,
        position: product.images.length,
      });
    }
  }

  console.log(`[groupShopifyProductRows] Found ${productMap.size} unique products by Handle`);

  // Convert Map to array and set first variant as main product data if no direct price
  const results = Array.from(productMap.values()).map(product => {
    // If product doesn't have direct price/sku, use first variant
    if (!product['Variant Price'] && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      product['Variant Price'] = firstVariant.price;
      product['Variant SKU'] = firstVariant.sku;
      product['Variant Compare At Price'] = firstVariant.compare_at_price;
      product['Variant Inventory Qty'] = firstVariant.inventory_quantity?.toString() || '0';
      product['Variant Grams'] = firstVariant.weight?.toString() || '';
      product['Variant Barcode'] = firstVariant.barcode;
    }
    
    return product;
  });
  
  // Log summary
  console.log(`[groupShopifyProductRows] Final: ${results.length} products ready for import`);
  
  return results;
}

// Group Shopify CSV order rows by Name (order number) - orders with multiple items have multiple rows
function groupShopifyOrderRows(rows: any[]): any[] {
  const orderMap = new Map<string, any>();
  let rowsWithoutName = 0;
  let rowsWithLineItems = 0;

  console.log(`[groupShopifyOrderRows] Starting to process ${rows.length} raw rows...`);
  
  // Log first row keys for debugging
  if (rows.length > 0) {
    console.log('[groupShopifyOrderRows] First row keys:', Object.keys(rows[0]).slice(0, 20));
  }

  for (const row of rows) {
    // Try multiple possible column names for order identifier
    const orderName = row['Name'] || row['name'] || row['Order Name'] || row['order_name'] || '';
    
    if (!orderName) {
      rowsWithoutName++;
      if (rowsWithoutName <= 5) {
        console.log('[groupShopifyOrderRows] Row without Name - first 10 keys:', Object.keys(row).slice(0, 10), 'values:', Object.values(row).slice(0, 5));
      }
      continue;
    }

    if (!orderMap.has(orderName)) {
      // First row for this order - use as base
      orderMap.set(orderName, {
        ...row,
        line_items: [],
      });
    }

    const order = orderMap.get(orderName)!;
    
    // Fill in missing fields from subsequent rows (Shopify might leave some empty on the first row)
    const fieldsToFill = [
      'Email', 'email', 'Financial Status', 'Paid at', 'Fulfillment Status', 'Fulfilled at',
      'Currency', 'Subtotal', 'Shipping', 'Taxes', 'Total', 'Discount Code', 'Discount Amount',
      'Shipping Method', 'Created at', 'Payment Method', 'Payment Reference',
      'Shipping Name', 'Shipping Phone', 'Shipping Address1', 'Shipping Address2',
      'Shipping City', 'Shipping Province', 'Shipping Zip', 'Shipping Country',
      'Billing Name', 'Billing Phone', 'Billing Address1', 'Billing Address2',
      'Billing City', 'Billing Province', 'Billing Zip', 'Billing Country',
      'Notes', 'Tracking Number', 'Tracking Company'
    ];
    
    for (const field of fieldsToFill) {
      if (!order[field] && row[field]) {
        order[field] = row[field];
      }
    }

    // Add line item if present (try multiple column name variations)
    const lineitemName = row['Lineitem name'] || row['Lineitem Name'] || row['lineitem_name'] || '';
    const lineitemQty = row['Lineitem quantity'] || row['Lineitem Quantity'] || row['lineitem_quantity'] || '';
    
    if (lineitemName && lineitemQty) {
      rowsWithLineItems++;
      order.line_items.push({
        title: lineitemName,
        sku: row['Lineitem sku'] || row['Lineitem SKU'] || null,
        quantity: parseInt(lineitemQty || '1', 10),
        price: row['Lineitem price'] || row['Lineitem Price'] || '0',
        compare_at_price: row['Lineitem compare at price'] || row['Lineitem Compare At Price'] || null,
        discount: row['Lineitem discount'] || row['Lineitem Discount'] || '0',
        fulfillment_status: row['Lineitem fulfillment status'] || row['Lineitem Fulfillment Status'] || null,
      });
    }
  }

  // Convert Map to array
  const result = Array.from(orderMap.values());
  
  console.log(`[groupShopifyOrderRows] SUMMARY:`);
  console.log(`  - Total raw rows: ${rows.length}`);
  console.log(`  - Rows without Name (skipped): ${rowsWithoutName}`);
  console.log(`  - Rows with line items: ${rowsWithLineItems}`);
  console.log(`  - Unique orders: ${result.length}`);
  
  // Log sample of order names found
  if (result.length > 0) {
    const sampleOrders = result.slice(0, 5).map(o => o['Name'] || o['name']);
    console.log(`  - Sample order names: ${sampleOrders.join(', ')}`);
  }
  
  return result;
}
