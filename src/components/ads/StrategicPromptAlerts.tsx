import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Info, ShieldAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export interface StrategicPromptAlertsProps {
  tenantId: string | undefined | null;
  scope: "global" | "account";
  channel?: string;
  adAccountId?: string;
  prompt: string;
  /** Disparado pelo container quando o usuário salva — força reanálise. */
  analysisTrigger?: number;
}

interface AlertItem {
  key: string;
  severity: "critico" | "atencao" | "informativo";
  source: string;
  excerpt: string;
  risk: string;
  suggestion: string;
}

const SEVERITY_STYLE: Record<AlertItem["severity"], { icon: any; cls: string; label: string }> = {
  critico: { icon: ShieldAlert, cls: "border-destructive/40 bg-destructive/5 text-destructive", label: "Crítico" },
  atencao: { icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400", label: "Atenção" },
  informativo: { icon: Info, cls: "border-primary/30 bg-primary/5 text-foreground/80", label: "Informativo" },
};

const SOURCE_LABEL: Record<string, string> = {
  platform_guideline: "Política da plataforma",
  product_function: "Função do produto",
  product_category: "Categoria regulatória",
  compliance: "Conformidade comercial",
};

export function StrategicPromptAlerts({ tenantId, scope, channel = "", adAccountId = "", prompt, analysisTrigger = 0 }: StrategicPromptAlertsProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzedHash, setAnalyzedHash] = useState<string | null>(null);

  const runAnalyze = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-prompt-conflict-analyze", {
        body: { tenant_id: tenantId, scope, channel, ad_account_id: adAccountId, prompt, action: "analyze" },
      });
      if (!error && data?.success !== false) {
        setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
        setIgnored(Array.isArray(data?.ignored_keys) ? data.ignored_keys : []);
        setAnalyzedHash(data?.prompt_hash ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, scope, channel, adAccountId, prompt]);

  // Carrega ao montar e quando o gatilho de salvamento mudar.
  useEffect(() => {
    runAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, scope, channel, adAccountId, analysisTrigger]);

  const toggleIgnore = async (alertKey: string) => {
    if (!tenantId) return;
    const next = ignored.includes(alertKey) ? ignored.filter((k) => k !== alertKey) : [...ignored, alertKey];
    setIgnored(next); // otimista
    await supabase.functions.invoke("ai-prompt-conflict-analyze", {
      body: { tenant_id: tenantId, scope, channel, ad_account_id: adAccountId, prompt, action: "toggle_ignore", alert_key: alertKey },
    });
  };

  const visible = alerts.filter((a) => !ignored.includes(a.key));
  const hiddenCount = alerts.length - visible.length;

  return (
    <div className="space-y-2">
      <Alert className="border-primary/30 bg-primary/5 py-2">
        <Info className="h-3.5 w-3.5 text-primary" />
        <AlertDescription className="text-[11px] text-foreground/80 flex items-center justify-between gap-2">
          <span>
            Seu prompt estratégico tem <strong>prioridade máxima</strong>. O sistema avisa aqui sobre conflitos com políticas das plataformas ou com o cadastro dos produtos, mas <strong>não bloqueia</strong> — a decisão é sua.
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin shrink-0 text-primary" />}
        </AlertDescription>
      </Alert>

      {visible.map((a) => {
        const sty = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.informativo;
        const Icon = sty.icon;
        return (
          <Alert key={a.key} className={`py-2 ${sty.cls}`}>
            <Icon className="h-3.5 w-3.5" />
            <AlertDescription className="text-[11px]">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="font-semibold">
                    {sty.label} · {SOURCE_LABEL[a.source] ?? a.source}
                  </div>
                  {a.excerpt && (
                    <div className="italic opacity-80">"{a.excerpt}"</div>
                  )}
                  <div>{a.risk}</div>
                  {a.suggestion && (
                    <div className="opacity-80"><strong>Sugestão:</strong> {a.suggestion}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] shrink-0"
                  onClick={() => toggleIgnore(a.key)}
                  title="Ignorar este aviso"
                >
                  <EyeOff className="h-3 w-3 mr-1" /> Ignorar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      })}

      {hiddenCount > 0 && (
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline flex items-center gap-1"
          onClick={() => ignored.slice().forEach(toggleIgnore)}
        >
          <Eye className="h-3 w-3" /> Reexibir {hiddenCount} aviso(s) ignorado(s)
        </button>
      )}

      {!loading && analyzedHash && alerts.length === 0 && prompt.trim().length > 0 && (
        <p className="text-[10px] text-muted-foreground">Nenhum conflito identificado neste prompt.</p>
      )}
    </div>
  );
}
