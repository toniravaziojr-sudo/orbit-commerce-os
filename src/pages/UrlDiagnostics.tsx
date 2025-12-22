// =============================================
// URL DIAGNOSTICS PANEL - Internal dev tool for URL validation
// Route: /dev/url-diagnostics (protected, dev only)
// =============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ExternalLink, 
  Copy,
  RefreshCw,
  Home,
  Package,
  FolderOpen,
  FileText,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  diagnoseEntityUrl, 
  UrlDiagnostic,
  getPublicHomeUrl,
  getPublicCartUrl,
  getPublicCheckoutUrl,
  getCanonicalStoreBaseUrl,
} from '@/lib/publicUrls';
import { useTenantCanonicalDomain, getTenantCanonicalOrigin } from '@/hooks/useTenantCanonicalDomain';

interface DiagnosticsData {
  home: UrlDiagnostic;
  cart: UrlDiagnostic;
  checkout: UrlDiagnostic;
  products: UrlDiagnostic[];
  categories: UrlDiagnostic[];
  pages: UrlDiagnostic[];
  landingPages: UrlDiagnostic[];
}

function StatusBadge({ status }: { status: UrlDiagnostic['status'] }) {
  switch (status) {
    case 'valid':
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          OK
        </Badge>
      );
    case 'invalid_slug':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Slug inválido
        </Badge>
      );
    case 'missing_slug':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Sem slug
        </Badge>
      );
  }
}

function EntityIcon({ type }: { type: string }) {
  switch (type) {
    case 'home': return <Home className="h-4 w-4" />;
    case 'product': return <Package className="h-4 w-4" />;
    case 'category': return <FolderOpen className="h-4 w-4" />;
    case 'page': return <FileText className="h-4 w-4" />;
    case 'landing': return <Rocket className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function DiagnosticRow({ diagnostic, canonicalOrigin }: { diagnostic: UrlDiagnostic; canonicalOrigin: string }) {
  const copyUrl = () => {
    if (diagnostic.publicUrl) {
      // Use canonical origin (custom domain or platform subdomain), NOT window.location.origin
      navigator.clipboard.writeText(canonicalOrigin + diagnostic.publicUrl);
      toast.success('URL copiada!');
    }
  };

  const openUrl = () => {
    if (diagnostic.publicUrl) {
      // Open using canonical origin
      window.open(canonicalOrigin + diagnostic.publicUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <EntityIcon type={diagnostic.entityType} />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{diagnostic.entityName}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {diagnostic.publicUrl ? `${canonicalOrigin}${diagnostic.publicUrl}` : diagnostic.entitySlug || '(sem URL)'}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <StatusBadge status={diagnostic.status} />
        
        {diagnostic.publicUrl && (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={copyUrl}
              title="Copiar URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={openUrl}
              title="Abrir URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function UrlDiagnostics() {
  const { currentTenant } = useAuth();
  const [search, setSearch] = useState('');
  
  // Get the canonical domain for this tenant
  const { domain: customDomain } = useTenantCanonicalDomain(currentTenant?.id);
  
  // Compute the canonical origin (custom domain or platform subdomain)
  const canonicalOrigin = getTenantCanonicalOrigin(customDomain, currentTenant?.slug);

  const { data: diagnostics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['url-diagnostics', currentTenant?.id],
    queryFn: async (): Promise<DiagnosticsData | null> => {
      if (!currentTenant) return null;

      const tenantSlug = currentTenant.slug;

      // Fetch all entities
      const [productsRes, categoriesRes, pagesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug, status')
          .eq('tenant_id', currentTenant.id)
          .order('name')
          .limit(100),
        supabase
          .from('categories')
          .select('id, name, slug, is_active')
          .eq('tenant_id', currentTenant.id)
          .order('name')
          .limit(100),
        supabase
          .from('store_pages')
          .select('id, title, slug, type, is_published')
          .eq('tenant_id', currentTenant.id)
          .order('title')
          .limit(100),
      ]);

      // Generate diagnostics for each entity
      const products = (productsRes.data || []).map(p => 
        diagnoseEntityUrl(tenantSlug, 'product', p.name, p.slug)
      );

      const categories = (categoriesRes.data || []).map(c => 
        diagnoseEntityUrl(tenantSlug, 'category', c.name, c.slug)
      );

      const institutionalPages = (pagesRes.data || [])
        .filter(p => p.type !== 'landing_page')
        .map(p => diagnoseEntityUrl(tenantSlug, 'page', p.title, p.slug));

      const landingPages = (pagesRes.data || [])
        .filter(p => p.type === 'landing_page')
        .map(p => diagnoseEntityUrl(tenantSlug, 'landing', p.title, p.slug));

      return {
        home: {
          entityType: 'home',
          entityName: 'Página Inicial',
          publicUrl: getPublicHomeUrl(tenantSlug),
          previewUrl: getPublicHomeUrl(tenantSlug, true),
          status: 'valid',
        },
        cart: {
          entityType: 'cart',
          entityName: 'Carrinho',
          publicUrl: getPublicCartUrl(tenantSlug),
          previewUrl: getPublicCartUrl(tenantSlug, true),
          status: 'valid',
        },
        checkout: {
          entityType: 'checkout',
          entityName: 'Checkout',
          publicUrl: getPublicCheckoutUrl(tenantSlug),
          previewUrl: getPublicCheckoutUrl(tenantSlug, true),
          status: 'valid',
        },
        products,
        categories,
        pages: institutionalPages,
        landingPages,
      };
    },
    enabled: !!currentTenant,
  });

  // Filter diagnostics by search
  const filterDiagnostics = (items: UrlDiagnostic[]) => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(
      item => 
        item.entityName.toLowerCase().includes(searchLower) ||
        item.entitySlug?.toLowerCase().includes(searchLower) ||
        item.publicUrl?.toLowerCase().includes(searchLower)
    );
  };

  // Count issues
  const countIssues = (items: UrlDiagnostic[]) => 
    items.filter(i => i.status !== 'valid').length;

  const totalIssues = diagnostics
    ? countIssues(diagnostics.products) + 
      countIssues(diagnostics.categories) + 
      countIssues(diagnostics.pages) + 
      countIssues(diagnostics.landingPages)
    : 0;

  if (!currentTenant) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Selecione um tenant para visualizar diagnósticos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico de URLs</h1>
          <p className="text-muted-foreground">
            Validação de todas as URLs públicas do storefront
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {diagnostics ? 
                (diagnostics.products.length + diagnostics.categories.length + 
                 diagnostics.pages.length + diagnostics.landingPages.length + 3 - totalIssues) 
                : 0}
            </div>
            <p className="text-sm text-muted-foreground">URLs válidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${totalIssues > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {totalIssues}
            </div>
            <p className="text-sm text-muted-foreground">Problemas encontrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{diagnostics?.products.length || 0}</div>
            <p className="text-sm text-muted-foreground">Produtos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{diagnostics?.categories.length || 0}</div>
            <p className="text-sm text-muted-foreground">Categorias</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div>
        <Input
          placeholder="Buscar por nome, slug ou URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : diagnostics ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* System Pages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Páginas do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <DiagnosticRow diagnostic={diagnostics.home} canonicalOrigin={canonicalOrigin} />
              <DiagnosticRow diagnostic={diagnostics.cart} canonicalOrigin={canonicalOrigin} />
              <DiagnosticRow diagnostic={diagnostics.checkout} canonicalOrigin={canonicalOrigin} />
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Produtos</CardTitle>
                {countIssues(diagnostics.products) > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                    {countIssues(diagnostics.products)} problemas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
              {filterDiagnostics(diagnostics.products).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {diagnostics.products.length === 0 ? 'Nenhum produto' : 'Nenhum resultado'}
                </p>
              ) : (
                filterDiagnostics(diagnostics.products).map((d, i) => (
                  <DiagnosticRow key={i} diagnostic={d} canonicalOrigin={canonicalOrigin} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Categorias</CardTitle>
                {countIssues(diagnostics.categories) > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                    {countIssues(diagnostics.categories)} problemas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
              {filterDiagnostics(diagnostics.categories).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {diagnostics.categories.length === 0 ? 'Nenhuma categoria' : 'Nenhum resultado'}
                </p>
              ) : (
                filterDiagnostics(diagnostics.categories).map((d, i) => (
                  <DiagnosticRow key={i} diagnostic={d} canonicalOrigin={canonicalOrigin} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Institutional Pages */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Páginas Institucionais</CardTitle>
                {countIssues(diagnostics.pages) > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                    {countIssues(diagnostics.pages)} problemas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
              {filterDiagnostics(diagnostics.pages).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {diagnostics.pages.length === 0 ? 'Nenhuma página' : 'Nenhum resultado'}
                </p>
              ) : (
                filterDiagnostics(diagnostics.pages).map((d, i) => (
                  <DiagnosticRow key={i} diagnostic={d} canonicalOrigin={canonicalOrigin} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Landing Pages */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Landing Pages</CardTitle>
                {countIssues(diagnostics.landingPages) > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                    {countIssues(diagnostics.landingPages)} problemas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
              {filterDiagnostics(diagnostics.landingPages).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {diagnostics.landingPages.length === 0 ? 'Nenhuma landing page' : 'Nenhum resultado'}
                </p>
              ) : (
                filterDiagnostics(diagnostics.landingPages).map((d, i) => (
                  <DiagnosticRow key={i} diagnostic={d} canonicalOrigin={canonicalOrigin} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
