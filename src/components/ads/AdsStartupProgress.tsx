// =============================================
// ADS STARTUP PROGRESS
// Shows real-time progress when AI strategist is
// running its initial "start" analysis
// =============================================

import { useState, useEffect, useRef } from "react";
import { Bot, Loader2, CheckCircle2, Database, Brain, Rocket, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  text: string;
  icon: "loading" | "done" | "brain";
  timestamp: Date;
}

interface AdsStartupProgressProps {
  /** Called when the startup finishes so parent can refresh actions */
  onComplete?: () => void;
}

const STAGES = [
  { key: "boot", label: "Iniciando motor estratégico...", pct: 5 },
  { key: "campaigns", label: "Coletando campanhas da conta...", pct: 15 },
  { key: "campaign_insights", label: "Analisando histórico de campanhas...", pct: 25 },
  { key: "adsets", label: "Coletando conjuntos de anúncios...", pct: 35 },
  { key: "adset_insights", label: "Analisando performance dos conjuntos...", pct: 50 },
  { key: "ads", label: "Coletando anúncios individuais...", pct: 60 },
  { key: "ad_insights", label: "Analisando métricas dos anúncios...", pct: 70 },
  { key: "compressing", label: "Comprimindo dados para análise IA...", pct: 80 },
  { key: "ai_thinking", label: "IA analisando conta e gerando plano estratégico...", pct: 88 },
  { key: "saving", label: "Salvando plano e registrando ações...", pct: 95 },
  { key: "done", label: "Análise concluída!", pct: 100 },
];

export function AdsStartupProgress({ onComplete }: AdsStartupProgressProps) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const [isActive, setIsActive] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [completed, setCompleted] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const stageTimerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(0);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Add a log entry
  const addLog = (text: string, icon: LogEntry["icon"] = "loading") => {
    setLogs(prev => [...prev, { id: crypto.randomUUID(), text, icon, timestamp: new Date() }]);
  };

  // Poll for active startup session
  useEffect(() => {
    if (!tenantId) return;

    const checkSession = async () => {
      // Look for a recent strategist_start session
      const { data: sessions } = await supabase
        .from("ads_autopilot_sessions" as any)
        .select("id, trigger_type, duration_ms, actions_planned, actions_executed, created_at")
        .eq("tenant_id", tenantId)
        .in("trigger_type", ["strategist_start"])
        .order("created_at", { ascending: false })
        .limit(1);

      const session = (sessions as any)?.[0];
      if (!session) return;

      const createdAt = new Date(session.created_at).getTime();
      const ageMs = Date.now() - createdAt;

      // Session is "active" if created < 10 min ago and no duration yet
      if (ageMs < 600_000 && session.duration_ms == null) {
        if (!isActive) {
          setIsActive(true);
          startTimeRef.current = createdAt;
          addLog("Motor Estrategista iniciado — análise completa da conta", "loading");
        } else {
          // Fallback: if actions were already planned, the session is done even if duration_ms is null
          if (session.actions_planned > 0) {
            finishProgress(session.actions_planned, session.actions_executed);
          }
        }
      } else if (isActive) {
        // Session completed (duration_ms set OR session is old enough with actions)
        finishProgress(session.actions_planned || 0, session.actions_executed || 0);
      }
    };

    checkSession();
    pollRef.current = setInterval(checkSession, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tenantId, isActive]);

  // Progress stages based on elapsed time
  useEffect(() => {
    if (!isActive || completed) return;

    // Time-based stage progression (simulated based on typical timing)
    const STAGE_TIMES_MS = [
      0,       // boot
      2000,    // campaigns
      5000,    // campaign_insights
      8000,    // adsets
      12000,   // adset_insights
      16000,   // ads
      20000,   // ad_insights
      25000,   // compressing
      30000,   // ai_thinking
      60000,   // saving
      90000,   // done
    ];

    stageTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      let targetStage = 0;
      for (let i = STAGE_TIMES_MS.length - 1; i >= 0; i--) {
        if (elapsed >= STAGE_TIMES_MS[i]) {
          targetStage = i;
          break;
        }
      }

      setCurrentStage(prev => {
        if (targetStage > prev && targetStage < STAGES.length - 1) {
          // Mark previous as done and add new log
          setLogs(prevLogs => {
            const updated = prevLogs.map((l, idx) => 
              idx === prevLogs.length - 1 && l.icon === "loading" 
                ? { ...l, icon: "done" as const }
                : l
            );
            return [...updated, {
              id: crypto.randomUUID(),
              text: STAGES[targetStage].label,
              icon: targetStage === 8 ? "brain" as const : "loading" as const,
              timestamp: new Date(),
            }];
          });
          return targetStage;
        }
        return prev;
      });
    }, 2000);

    return () => { if (stageTimerRef.current) clearInterval(stageTimerRef.current); };
  }, [isActive, completed]);

  const finishProgress = (planned: number, executed: number) => {
    setCompleted(true);
    setCurrentStage(STAGES.length - 1);
    setLogs(prev => {
      const updated = prev.map(l => l.icon === "loading" ? { ...l, icon: "done" as const } : l);
      return [...updated, {
        id: crypto.randomUUID(),
        text: `✅ Análise concluída! ${planned || 0} ações planejadas, ${executed || 0} executadas.`,
        icon: "done" as const,
        timestamp: new Date(),
      }];
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, 5000);
  };

  if (!isActive) return null;

  const progress = STAGES[currentStage]?.pct || 0;
  const stageLabel = STAGES[currentStage]?.label || "";

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
      <CardContent className="py-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            {!completed && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              {completed ? "Análise Estratégica Concluída" : "IA Analisando sua Conta"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {completed ? "Plano estratégico gerado com sucesso" : stageLabel}
            </p>
          </div>
          {!completed && (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {Math.round(progress)}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Live log */}
        <div className="bg-muted/50 rounded-lg border max-h-[180px] overflow-y-auto min-h-0">
          <div className="p-3 space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300">
                {log.icon === "loading" && (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0 mt-0.5" />
                )}
                {log.icon === "done" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                {log.icon === "brain" && (
                  <Brain className="h-3.5 w-3.5 text-primary animate-pulse shrink-0 mt-0.5" />
                )}
                <span className={`${log.icon === "done" ? "text-muted-foreground" : "text-foreground"}`}>
                  {log.text}
                </span>
                <span className="text-muted-foreground/50 ml-auto shrink-0 font-mono">
                  {log.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Tip */}
        {!completed && (
          <p className="text-[11px] text-muted-foreground/70 text-center">
            A IA está analisando o histórico completo da sua conta. Isso pode levar alguns minutos.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
