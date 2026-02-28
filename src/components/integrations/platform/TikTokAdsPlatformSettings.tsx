import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ExternalLink, Eye, EyeOff, Info, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIKTOK_ADS_KEYS = [
  { key: "TIKTOK_APP_ID", label: "App ID", description: "App ID do TikTok Business Developer Portal", sensitive: false },
  { key: "TIKTOK_APP_SECRET", label: "App Secret", description: "App Secret para TikTok Ads API", sensitive: true },
];

export function TikTokAdsPlatformSettings() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["platform-credentials-tiktok-ads"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data, error } = await supabase.functions.invoke("platform-secrets-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro");
      return (data.integrations as any[]).find((i) => i.key === "tiktok_ads_platform") || null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data, error } = await supabase.functions.invoke("platform-credentials-update", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { key, value },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao salvar");
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.key} atualizado`);
      queryClient.invalidateQueries({ queryKey: ["platform-credentials-tiktok-ads"] });
      queryClient.invalidateQueries({ queryKey: ["platform-secrets-status"] });
      setValues((prev) => ({ ...prev, [vars.key]: "" }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renderCredentialCard = ({ key, label, description, sensitive }: typeof TIKTOK_ADS_KEYS[0]) => {
    const isConfigured = credentials?.secrets?.[key];
    const preview = credentials?.previews?.[key] || "";
    const source = credentials?.sources?.[key] || "";

    return (
      <Card key={key}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{label}</CardTitle>
            {isConfigured ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
            )}
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isConfigured && preview && (
            <div className="text-xs text-muted-foreground">
              Valor atual: <code className="bg-muted px-1 rounded">{preview}</code>
              {source && <span className="ml-1">({source === "db" ? "banco" : "env"})</span>}
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={sensitive && !visibleKeys.has(key) ? "password" : "text"}
                placeholder={isConfigured ? "Novo valor (deixe vazio para manter)" : "Cole o valor aqui"}
                value={values[key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              {sensitive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setVisibleKeys((prev) => {
                    const next = new Set(prev);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  })}
                >
                  {visibleKeys.has(key) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
            <Button
              size="sm"
              disabled={!values[key] || saveMutation.isPending}
              onClick={() => saveMutation.mutate({ key, value: values[key] })}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Credenciais para <strong>TikTok Ads</strong> (Pixel, CAPI, Campanhas de anúncios).
          Registre seu app no{" "}
          <a href="https://business-api.tiktok.com/portal/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            Business Developer Portal <ExternalLink className="h-3 w-3" />
          </a>.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {TIKTOK_ADS_KEYS.map(renderCredentialCard)}
      </div>
    </div>
  );
}
