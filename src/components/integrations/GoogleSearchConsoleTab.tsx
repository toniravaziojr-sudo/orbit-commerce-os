import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search, RefreshCw, Loader2, Globe, TrendingUp, TrendingDown,
  MousePointerClick, Eye, ArrowUpDown, AlertCircle, ExternalLink,
  BarChart3,
} from "lucide-react";
import { useGoogleSearchConsole } from "@/hooks/useGoogleSearchConsole";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";

const DATE_RANGES = [
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 28 dias", days: 28 },
  { label: "Últimos 90 dias", days: 90 },
];

export function GoogleSearchConsoleTab() {
  const { currentTenant } = useAuth();
  const googleConn = useGoogleConnection();
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [rangeDays, setRangeDays] = useState(28);
  const [searchQuery, setSearchQuery] = useState("");

  const dateRange = {
    startDate: format(subDays(new Date(), rangeDays), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  };

  const { summaryQuery, dataQuery, sitesQuery, syncMutation } = useGoogleSearchConsole(
    selectedSite || undefined,
    selectedSite ? dateRange : undefined
  );

  const hasSearchScope = googleConn.isConnected && googleConn.connection?.scope_packs?.includes("search_console");

  if (!hasSearchScope) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Globe className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">Google Search Console</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Conecte o Google com o escopo Search Console para visualizar dados de desempenho orgânico do seu site.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sites = sitesQuery.data || [];
  const summary = summaryQuery.data;
  const rows = dataQuery.data?.rows || [];

  // Auto-select first site
  if (sites.length > 0 && !selectedSite) {
    setSelectedSite(sites[0]?.siteUrl || sites[0]);
  }

  const filteredRows = rows.filter((row: any) =>
    !searchQuery || row.keys?.[0]?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = summary ? [
    {
      label: "Cliques",
      value: summary.clicks?.toLocaleString("pt-BR") ?? "—",
      icon: MousePointerClick,
      color: "text-blue-600",
    },
    {
      label: "Impressões",
      value: summary.impressions?.toLocaleString("pt-BR") ?? "—",
      icon: Eye,
      color: "text-purple-600",
    },
    {
      label: "CTR Médio",
      value: summary.ctr != null ? `${(summary.ctr * 100).toFixed(1)}%` : "—",
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      label: "Posição Média",
      value: summary.position != null ? summary.position.toFixed(1) : "—",
      icon: ArrowUpDown,
      color: "text-orange-600",
    },
  ] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Google Search Console</CardTitle>
                <p className="text-sm text-muted-foreground">Desempenho orgânico do seu site no Google</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(rangeDays)} onValueChange={(v) => setRangeDays(Number(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((r) => (
                    <SelectItem key={r.days} value={String(r.days)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate({ siteUrl: selectedSite, dateRange })}
                disabled={syncMutation.isPending || !selectedSite}
              >
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sincronizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Site selector */}
          {sites.length > 1 && (
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site: any) => {
                  const url = site?.siteUrl || site;
                  return (
                    <SelectItem key={url} value={url}>
                      <span className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" /> {url}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Summary cards */}
          {summaryQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s) => (
                <Card key={s.label} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-xl font-bold">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : selectedSite ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum dado disponível para o período selecionado. Tente sincronizar os dados.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Query table */}
          {selectedSite && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar consulta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {dataQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRows.length > 0 ? (
                <div className="border rounded-lg overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consulta</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">Posição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.slice(0, 100).map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium max-w-[300px] truncate">
                            {row.keys?.[0] || "—"}
                          </TableCell>
                          <TableCell className="text-right">{row.clicks?.toLocaleString("pt-BR") ?? 0}</TableCell>
                          <TableCell className="text-right">{row.impressions?.toLocaleString("pt-BR") ?? 0}</TableCell>
                          <TableCell className="text-right">
                            {row.ctr != null ? `${(row.ctr * 100).toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={row.position <= 10 ? "text-green-600 font-medium" : row.position <= 20 ? "text-yellow-600" : "text-muted-foreground"}>
                              {row.position?.toFixed(1) ?? "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : !dataQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma consulta encontrada</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
