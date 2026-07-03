import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, FileText, Store, FolderTree,
  BookOpen, Sparkles, ShieldCheck, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// ---------- Types (contrato de calc_seo_health) ----------
type FactorKey = "products" | "categories" | "storefront_pages" | "landing_pages" | "blog_posts" | "foundation";

interface SeoFactor {
  key: FactorKey;
  weight: number;
  score: number;
  total?: number;
  ok?: number;
  noindex_informational?: number;
  signals?: {
    favicon: boolean;
    default_seo_title: boolean;
    default_seo_description: boolean;
    primary_verified_domain: boolean;
    active_ssl: boolean;
  };
}

interface SeoCounts {
  products: { total: number; ok: number };
  categories: { total: number; ok: number };
  storefront_pages: { total: number; ok: number };
  landing_pages: { total: number; ok: number; noindex_informational: number };
  blog_posts: { total: number; ok: number };
}

interface SeoPending { key: string; count: number }

interface SeoHealth {
  tenant_id: string;
  score: number;
  factors: SeoFactor[];
  counts: SeoCounts;
  pending: SeoPending[];
  computed_at: string;
}

// ---------- Meta por fator/pendência ----------
const FACTOR_META: Record<FactorKey, { label: string; icon: React.ElementType; moduleHref: string; moduleLabel: string }> = {
  products:         { label: "Produtos",           icon: Store,      moduleHref: "/products",   moduleLabel: "Abrir Produtos" },
  categories:       { label: "Categorias",         icon: FolderTree, moduleHref: "/categories", moduleLabel: "Abrir Categorias" },
  storefront_pages: { label: "Páginas da Loja",    icon: FileText,   moduleHref: "/pages",      moduleLabel: "Abrir Páginas" },
  landing_pages:    { label: "Landing Pages",      icon: Sparkles,   moduleHref: "/pages",      moduleLabel: "Abrir Páginas" },
  blog_posts:       { label: "Blog",               icon: BookOpen,   moduleHref: "/blog",       moduleLabel: "Abrir Blog" },
  foundation:       { label: "Fundação técnica",   icon: ShieldCheck, moduleHref: "/storefront", moduleLabel: "Abrir Configurações da Loja" },
};

const PENDING_META: Record<string, { label: string; viewName?: string; moduleHref: string; moduleLabel: string }> = {
  products_missing_seo:      { label: "Produtos sem SEO",         viewName: "v_seo_coverage_products",         moduleHref: "/products",   moduleLabel: "Abrir Produtos" },
  categories_missing_seo:    { label: "Categorias sem SEO",       viewName: "v_seo_coverage_categories",       moduleHref: "/categories", moduleLabel: "Abrir Categorias" },
  pages_missing_seo:         { label: "Páginas da loja sem SEO",  viewName: "v_seo_coverage_storefront_pages", moduleHref: "/pages",      moduleLabel: "Abrir Páginas" },
  landing_pages_missing_seo: { label: "Landing pages sem SEO",    viewName: "v_seo_coverage_landing_pages",    moduleHref: "/pages",      moduleLabel: "Abrir Páginas" },
  blog_posts_missing_seo:    { label: "Posts de blog sem SEO",    viewName: "v_seo_coverage_blog_posts",       moduleHref: "/blog",       moduleLabel: "Abrir Blog" },
  duplicate_titles:          { label: "Títulos duplicados",       moduleHref: "/products",   moduleLabel: "Revisar no módulo" },
};

const FOUNDATION_LABELS: Record<keyof NonNullable<SeoFactor["signals"]>, { label: string; href: string }> = {
  favicon:                 { label: "Favicon configurado",             href: "/storefront" },
  default_seo_title:       { label: "SEO padrão — título",             href: "/storefront" },
  default_seo_description: { label: "SEO padrão — descrição",          href: "/storefront" },
  primary_verified_domain: { label: "Domínio primário verificado",     href: "/settings/domains" },
  active_ssl:              { label: "SSL ativo no domínio",            href: "/settings/domains" },
};

function scoreColor(n: number) {
  if (n >= 80) return "text-success";
  if (n >= 50) return "text-warning";
  return "text-destructive";
}

function scoreBadgeVariant(n: number): "default" | "secondary" | "destructive" {
  if (n >= 80) return "default";
  if (n >= 50) return "secondary";
  return "destructive";
}

export default function StorefrontSeoCenter() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["seo-health", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error("no-tenant");
      const { data, error } = await supabase.rpc("calc_seo_health" as never, { p_tenant_id: tenantId } as never);
      if (error) throw error;
      return data as unknown as SeoHealth;
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  const factorsByKey = useMemo(() => {
    const m = new Map<FactorKey, SeoFactor>();
    (data?.factors ?? []).forEach((f) => m.set(f.key, f));
    return m;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Central de SEO da Loja"
        description="Índice interno do Comando Central — leitura direta dos seus dados, sem chamadas externas."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching || !tenantId}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Atualizar painel
          </Button>
        }
      />

      {isLoading && <SkeletonState />}
      {isError && (
        <QueryErrorState
          title="Não foi possível carregar a Central de SEO"
          message="Tente novamente em instantes. Se persistir, verifique se você tem acesso a esta loja."
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          <ScoreCard score={data.score} computedAt={data.computed_at} />
          <FactorsGrid factors={data.factors} counts={data.counts} />
          <FoundationCard signals={factorsByKey.get("foundation")?.signals} />
          <PendingList pending={data.pending} tenantId={data.tenant_id} />
          <LandingInfo counts={data.counts} />
          <FooterNote />
        </>
      )}
    </div>
  );
}

// ---------- Sub-componentes ----------

function SkeletonState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    </div>
  );
}

function ScoreCard({ score, computedAt }: { score: number; computedAt: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 sm:flex-row sm:justify-between sm:gap-6">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4", scoreColor(score))}
            style={{ borderColor: "currentColor" }}
          >
            <span className={cn("text-4xl font-bold tabular-nums", scoreColor(score))}>{score}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Índice de Saúde SEO</h2>
            <p className="text-sm text-muted-foreground">Índice interno do Comando Central</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculado em {new Date(computedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          </div>
        </div>
        <Badge variant={scoreBadgeVariant(score)} className="text-sm">
          {score >= 80 ? "Saudável" : score >= 50 ? "Atenção" : "Crítico"}
        </Badge>
      </CardContent>
    </Card>
  );
}

function FactorsGrid({ factors, counts }: { factors: SeoFactor[]; counts: SeoCounts }) {
  const editorial: FactorKey[] = ["products", "categories", "storefront_pages", "landing_pages", "blog_posts"];
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Cobertura por entidade</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {editorial.map((k) => {
          const f = factors.find((x) => x.key === k);
          const meta = FACTOR_META[k];
          const c = (counts as unknown as Record<string, { total: number; ok: number }>)[k] ?? { total: 0, ok: 0 };
          const pct = c.total > 0 ? Math.round((c.ok / c.total) * 100) : 100;
          const Icon = meta.icon;
          return (
            <Card key={k}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {meta.label}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">Peso {f?.weight ?? 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-2xl font-bold tabular-nums", scoreColor(pct))}>{pct}%</span>
                  <span className="text-xs text-muted-foreground">
                    {c.ok}/{c.total} com SEO OK
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full transition-all", pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive")}
                    style={{ width: `${pct}%` }} />
                </div>
                {k === "landing_pages" && (counts.landing_pages.noindex_informational ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {counts.landing_pages.noindex_informational} LP(s) com no_index — informativo, não conta como pendência.
                  </p>
                )}
                <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                  <Link to={meta.moduleHref}>
                    {meta.moduleLabel}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function FoundationCard({ signals }: { signals?: SeoFactor["signals"] }) {
  if (!signals) return null;
  const entries = Object.entries(signals) as Array<[keyof NonNullable<SeoFactor["signals"]>, boolean]>;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Fundação técnica
        </CardTitle>
        <CardDescription>Configurações mínimas da loja que sustentam o SEO orgânico.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {entries.map(([k, ok]) => {
            const meta = FOUNDATION_LABELS[k];
            return (
              <li key={k} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  {ok
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="text-sm">{meta.label}</span>
                </div>
                {!ok && (
                  <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                    <Link to={meta.href}>Corrigir <ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function PendingList({ pending, tenantId }: { pending: SeoPending[]; tenantId: string }) {
  if (!pending || pending.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nenhuma pendência editorial"
        description="Todas as entidades indexáveis estão com título e descrição preenchidos."
      />
    );
  }
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Pendências acionáveis</h3>
      <div className="space-y-2">
        {pending.map((p) => (
          <PendingRow key={p.key} pending={p} tenantId={tenantId} />
        ))}
      </div>
    </section>
  );
}

function PendingRow({ pending, tenantId }: { pending: SeoPending; tenantId: string }) {
  const meta = PENDING_META[pending.key] ?? { label: pending.key, moduleHref: "/", moduleLabel: "Abrir módulo" };
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <div>
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{pending.count} item(ns) para revisar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meta.viewName && (
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Ver itens
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to={meta.moduleHref}>
              {meta.moduleLabel}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
      {open && meta.viewName && (
        <div className="border-t px-4 py-3">
          <DrillDown viewName={meta.viewName} tenantId={tenantId} totalCount={pending.count} />
        </div>
      )}
    </Card>
  );
}

function DrillDown({ viewName, tenantId, totalCount }: { viewName: string; tenantId: string; totalCount: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["seo-drilldown", viewName, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(viewName as never)
        .select("id, slug, has_title, has_description")
        .eq("tenant_id", tenantId)
        .or("has_title.eq.false,has_description.eq.false")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; slug: string; has_title: boolean; has_description: boolean }>;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (isError) return <p className="text-xs text-destructive">Não foi possível carregar os itens.</p>;
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">Nenhum item retornado.</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm">
        {data.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-muted/10 px-2 py-1">
            <span className="truncate font-mono text-xs">{row.slug || row.id}</span>
            <span className="flex gap-1">
              {!row.has_title && <Badge variant="destructive" className="text-[10px]">sem título</Badge>}
              {!row.has_description && <Badge variant="destructive" className="text-[10px]">sem descrição</Badge>}
            </span>
          </li>
        ))}
      </ul>
      {totalCount > data.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando os primeiros {data.length} de {totalCount}. Abra o módulo para ver todos.
        </p>
      )}
    </div>
  );
}

function LandingInfo({ counts }: { counts: SeoCounts }) {
  const noindex = counts.landing_pages?.noindex_informational ?? 0;
  if (noindex === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Landing pages não indexáveis
        </CardTitle>
        <CardDescription>Informativo — LPs com no_index não entram no cálculo editorial e permanecem separadas do SEO orgânico.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          <strong className="tabular-nums">{noindex}</strong> landing page(s) com <code className="rounded bg-muted px-1 py-0.5 text-xs">no_index</code>.
        </p>
      </CardContent>
    </Card>
  );
}

function FooterNote() {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Este painel é somente leitura. Nenhuma chamada externa (IA, Google Search Console, sitemap, robots ou Worker) é feita ao abrir ou ao atualizar.
          Correções são feitas nos módulos originais de cada entidade.
        </p>
      </div>
    </div>
  );
}
