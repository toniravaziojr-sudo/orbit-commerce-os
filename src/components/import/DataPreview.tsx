import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';

interface DataPreviewProps {
  data: Record<string, any[]>;
  modules: string[];
}

const moduleLabels: Record<string, string> = {
  categories: 'Categorias',
  products: 'Produtos',
  customers: 'Clientes',
  orders: 'Pedidos',
};

interface ValidationWarning {
  field: string;
  count: number;
  message: string;
  severity: 'warning' | 'info';
}

function validateProducts(items: any[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  
  const withoutSku = items.filter(p => !p.sku).length;
  if (withoutSku > 0) {
    warnings.push({
      field: 'sku',
      count: withoutSku,
      message: `${withoutSku} produto(s) sem SKU - será gerado automaticamente`,
      severity: 'info',
    });
  }
  
  const withoutName = items.filter(p => !p.name || p.name === 'Produto sem nome').length;
  if (withoutName > 0) {
    warnings.push({
      field: 'name',
      count: withoutName,
      message: `${withoutName} produto(s) sem nome válido`,
      severity: 'warning',
    });
  }
  
  const withoutPrice = items.filter(p => !p.price || p.price <= 0).length;
  if (withoutPrice > 0) {
    warnings.push({
      field: 'price',
      count: withoutPrice,
      message: `${withoutPrice} produto(s) sem preço definido`,
      severity: 'warning',
    });
  }
  
  return warnings;
}

function validateCustomers(items: any[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  
  const withoutEmail = items.filter(c => !c.email || !c.email.includes('@')).length;
  if (withoutEmail > 0) {
    warnings.push({
      field: 'email',
      count: withoutEmail,
      message: `${withoutEmail} cliente(s) sem email válido - serão ignorados`,
      severity: 'warning',
    });
  }
  
  return warnings;
}

function validateOrders(items: any[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  
  const withoutOrderNumber = items.filter(o => !o.order_number).length;
  if (withoutOrderNumber > 0) {
    warnings.push({
      field: 'order_number',
      count: withoutOrderNumber,
      message: `${withoutOrderNumber} pedido(s) sem número - serão ignorados`,
      severity: 'warning',
    });
  }
  
  return warnings;
}

export function DataPreview({ data, modules }: DataPreviewProps) {
  const availableModules = modules.filter(m => data[m]?.length > 0);
  const [activeTab, setActiveTab] = useState(availableModules[0] || 'products');

  const validationWarnings = useMemo(() => {
    const warnings: Record<string, ValidationWarning[]> = {};
    
    if (data.products?.length > 0) {
      warnings.products = validateProducts(data.products);
    }
    if (data.customers?.length > 0) {
      warnings.customers = validateCustomers(data.customers);
    }
    if (data.orders?.length > 0) {
      warnings.orders = validateOrders(data.orders);
    }
    
    return warnings;
  }, [data]);

  if (availableModules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado carregado para visualização.
      </div>
    );
  }

  const currentWarnings = validationWarnings[activeTab] || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Prévia dos dados normalizados</h3>

      {currentWarnings.length > 0 && (
        <div className="space-y-2">
          {currentWarnings.map((warning, idx) => (
            <Alert key={idx} variant={warning.severity === 'warning' ? 'destructive' : 'default'}>
              {warning.severity === 'warning' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm">
                {warning.severity === 'warning' ? 'Atenção' : 'Informação'}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {warning.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {availableModules.map((module) => (
            <TabsTrigger key={module} value={module} className="relative">
              {moduleLabels[module] || module}
              <Badge variant="secondary" className="ml-2">
                {data[module].length}
              </Badge>
              {validationWarnings[module]?.some(w => w.severity === 'warning') && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableModules.map((module) => (
          <TabsContent key={module} value={module}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {data[module].length} {moduleLabels[module]?.toLowerCase() || module} serão importados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {module === 'products' && <ProductsPreview items={data[module]} />}
                  {module === 'categories' && <CategoriesPreview items={data[module]} />}
                  {module === 'customers' && <CustomersPreview items={data[module]} />}
                  {module === 'orders' && <OrdersPreview items={data[module]} />}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProductsPreview({ items }: { items: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead>Estoque</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 20).map((item, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.sku || '-'}</TableCell>
            <TableCell>
              {item.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </TableCell>
            <TableCell>{item.stock_quantity ?? '-'}</TableCell>
            <TableCell>
              <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                {item.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CategoriesPreview({ items }: { items: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Categoria Pai</TableHead>
          <TableHead>Ativa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 20).map((item, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.slug}</TableCell>
            <TableCell>{item.parent_slug || '-'}</TableCell>
            <TableCell>
              <Badge variant={item.is_active ? 'default' : 'secondary'}>
                {item.is_active ? 'Sim' : 'Não'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CustomersPreview({ items }: { items: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Endereços</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 20).map((item, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{item.full_name}</TableCell>
            <TableCell>{item.email}</TableCell>
            <TableCell>{item.phone || '-'}</TableCell>
            <TableCell>{item.addresses?.length || 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersPreview({ items }: { items: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.slice(0, 20).map((item, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{item.order_number}</TableCell>
            <TableCell>{item.customer_name}</TableCell>
            <TableCell>
              {item.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{item.status}</Badge>
            </TableCell>
            <TableCell>
              {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
