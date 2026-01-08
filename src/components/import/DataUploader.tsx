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
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
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

    reader.readAsText(file);
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
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rawRows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      rawRows.push(obj);
    }
  }

  // Check if this is a Shopify product export (has Handle column and multiple rows per product)
  const hasHandle = headers.includes('Handle');
  const hasTitle = headers.includes('Title');
  const hasVariantSKU = headers.includes('Variant SKU');
  
  if (hasHandle && hasTitle && hasVariantSKU) {
    // Group rows by Handle and merge variant data
    return groupShopifyProductRows(rawRows);
  }

  return rawRows;
}

// Group Shopify CSV rows by Handle (products with variants have multiple rows)
function groupShopifyProductRows(rows: any[]): any[] {
  const productMap = new Map<string, any>();

  for (const row of rows) {
    const handle = row['Handle'] || '';
    if (!handle) continue;

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

    // Add variant data if present
    const variantSKU = row['Variant SKU'];
    const variantPrice = row['Variant Price'];
    if (variantSKU || variantPrice) {
      product.variants.push({
        sku: variantSKU || null,
        price: variantPrice || '0',
        compare_at_price: row['Variant Compare At Price'] || null,
        inventory_quantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
        weight: parseFloat(row['Variant Weight'] || '0') || null,
        option1: row['Option1 Value'] || null,
        option2: row['Option2 Value'] || null,
        option3: row['Option3 Value'] || null,
        title: row['Variant Title'] || 'Default',
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

  // Convert Map to array and set first variant as main product data if no direct price
  return Array.from(productMap.values()).map(product => {
    // If product doesn't have direct price/sku, use first variant
    if (!product['Variant Price'] && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      product['Variant Price'] = firstVariant.price;
      product['Variant SKU'] = firstVariant.sku;
      product['Variant Compare At Price'] = firstVariant.compare_at_price;
      product['Variant Inventory Qty'] = firstVariant.inventory_quantity?.toString() || '0';
      product['Variant Weight'] = firstVariant.weight?.toString() || '';
    }
    return product;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
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
