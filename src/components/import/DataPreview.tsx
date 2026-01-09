import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, XCircle, CheckCircle2 } from 'lucide-react';

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

interface ValidationIssue {
  field: string;
  count: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  affectedItems?: string[];
}

function validateProducts(items: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // CRITICAL: Products without name are ERRORS (will not be imported)
  const withoutName = items.filter(p => {
    const name = (p.name || p.title || '').toString().trim();
    return !name || name === 'Produto sem nome' || name === 'Produto importado';
  });
  if (withoutName.length > 0) {
    issues.push({
      field: 'name',
      count: withoutName.length,
      message: `${withoutName.length} produto(s) SEM NOME - NÃO serão importados`,
      severity: 'error',
      affectedItems: withoutName.slice(0, 5).map(p => p.sku || p.slug || 'sem identificador'),
    });
  }
  
  const withoutSku = items.filter(p => !p.sku).length;
  if (withoutSku > 0) {
    issues.push({
      field: 'sku',
      count: withoutSku,
      message: `${withoutSku} produto(s) sem SKU - será gerado automaticamente`,
      severity: 'info',
    });
  }
  
  const withoutPrice = items.filter(p => !p.price || p.price <= 0).length;
  if (withoutPrice > 0) {
    issues.push({
      field: 'price',
      count: withoutPrice,
      message: `${withoutPrice} produto(s) sem preço ou preço zero`,
      severity: 'warning',
    });
  }

  // Count valid products
  const validCount = items.length - withoutName.length;
  if (validCount > 0) {
    issues.unshift({
      field: 'valid',
      count: validCount,
      message: `${validCount} produto(s) válidos serão importados`,
      severity: 'info',
    });
  }
  
  return issues;
}

function validateCustomers(items: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const withoutEmail = items.filter(c => !c.email || !c.email.includes('@'));
  if (withoutEmail.length > 0) {
    issues.push({
      field: 'email',
      count: withoutEmail.length,
      message: `${withoutEmail.length} cliente(s) sem email válido - NÃO serão importados`,
      severity: 'error',
      affectedItems: withoutEmail.slice(0, 5).map(c => c.full_name || 'sem nome'),
    });
  }

  const validCount = items.length - withoutEmail.length;
  if (validCount > 0) {
    issues.unshift({
      field: 'valid',
      count: validCount,
      message: `${validCount} cliente(s) válidos serão importados`,
      severity: 'info',
    });
  }
  
  return issues;
}

function validateOrders(items: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const withoutOrderNumber = items.filter(o => !o.order_number);
  if (withoutOrderNumber.length > 0) {
    issues.push({
      field: 'order_number',
      count: withoutOrderNumber.length,
      message: `${withoutOrderNumber.length} pedido(s) sem número - NÃO serão importados`,
      severity: 'error',
    });
  }

  const validCount = items.length - withoutOrderNumber.length;
  if (validCount > 0) {
    issues.unshift({
      field: 'valid',
      count: validCount,
      message: `${validCount} pedido(s) válidos serão importados`,
      severity: 'info',
    });
  }
  
  return issues;
}

export function DataPreview({ data, modules }: DataPreviewProps) {
  const availableModules = modules.filter(m => data[m]?.length > 0);
  const [activeTab, setActiveTab] = useState(availableModules[0] || 'products');

  const validationIssues = useMemo(() => {
    const issues: Record<string, ValidationIssue[]> = {};
    
    if (data.products?.length > 0) {
      issues.products = validateProducts(data.products);
    }
    if (data.customers?.length > 0) {
      issues.customers = validateCustomers(data.customers);
    }
    if (data.orders?.length > 0) {
      issues.orders = validateOrders(data.orders);
    }
    
    return issues;
  }, [data]);

  if (availableModules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado carregado para visualização.
      </div>
    );
  }

  const currentIssues = validationIssues[activeTab] || [];

  // Check if there are blocking errors
  const hasErrors = currentIssues.some(i => i.severity === 'error');
  const hasWarnings = currentIssues.some(i => i.severity === 'warning');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Prévia dos dados normalizados</h3>

      {currentIssues.length > 0 && (
        <div className="space-y-2">
          {currentIssues.map((issue, idx) => (
            <Alert 
              key={idx} 
              variant={issue.severity === 'error' ? 'destructive' : 'default'}
              className={issue.severity === 'info' && issue.field === 'valid' ? 'border-green-500/50 bg-green-500/5' : ''}
            >
              {issue.severity === 'error' ? (
                <XCircle className="h-4 w-4" />
              ) : issue.severity === 'warning' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : issue.field === 'valid' ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              <AlertTitle className="text-sm">
                {issue.severity === 'error' ? 'Erro - Itens não serão importados' : 
                 issue.severity === 'warning' ? 'Atenção' : 
                 issue.field === 'valid' ? 'Prontos para importar' : 'Informação'}
              </AlertTitle>
              <AlertDescription className="text-sm">
                {issue.message}
                {issue.affectedItems && issue.affectedItems.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Exemplos: {issue.affectedItems.join(', ')}
                  </div>
                )}
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
              {validationIssues[module]?.some(i => i.severity === 'error') && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
              {!validationIssues[module]?.some(i => i.severity === 'error') && 
               validationIssues[module]?.some(i => i.severity === 'warning') && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-500" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableModules.map((module) => {
          const moduleIssues = validationIssues[module] || [];
          const validItem = moduleIssues.find(i => i.field === 'valid');
          const validCount = validItem?.count || data[module].length;
          
          return (
            <TabsContent key={module} value={module}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>
                      {validCount} {moduleLabels[module]?.toLowerCase() || module} serão importados
                    </span>
                    {validCount < data[module].length && (
                      <Badge variant="destructive" className="text-xs">
                        {data[module].length - validCount} com erro
                      </Badge>
                    )}
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
          );
        })}
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
