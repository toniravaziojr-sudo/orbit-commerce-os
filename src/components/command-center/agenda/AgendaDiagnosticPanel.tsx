import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Terminal, RefreshCw, ArrowUpDown, MessageCircle, Bot } from "lucide-react";
import { ptBR } from "date-fns/locale";

import { formatDayMonthTimeBR } from "@/lib/date-";

interface CommandLogEntry {
  id: string;
  direction: string;
  from_phone: string | null;
  content: string | null;
  intent: string | null;
  action_taken: string | null;
  status: string;
  error_message: string | null;
  correlation_id: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  received: { label: "Recebido", variant: "outline" },
  interpreted: { label: "Interpretado", variant: "secondary" },
  awaiting_confirmation: { label: "Aguardando", variant: "default" },
  executed: { label: "Executado", variant: "secondary" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  expired: { label: "Expirado", variant: "destructive" },
  failed: { label: "Falhou", variant: "destructive" },
};

export function AgendaDiagnosticPanel() {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  const [logs, setLogs] = useState<CommandLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchLogs = async () => {
    if (!currentTenantId) return;
    setIsLoading(true);

    let query = supabase
      .from("agenda_command_log")
      .select("id, direction, from_phone, content, intent, action_taken, status, error_message, correlation_id, created_at")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setLogs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [currentTenantId, statusFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            Diagnóstico da Agenda
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="received">Recebido</SelectItem>
                <SelectItem value="executed">Executado</SelectItem>
                <SelectItem value="awaiting_confirmation">Aguardando</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum comando registrado ainda. Quando o admin enviar mensagens via WhatsApp, os logs aparecerão aqui.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => {
                const statusCfg = STATUS_CONFIG[log.status] || { label: log.status, variant: "outline" as const };
                const isInbound = log.direction === "inbound";
                
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="mt-0.5">
                      {isInbound ? (
                        <MessageCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusCfg.variant} className="text-[10px] px-1.5 py-0">
                          {statusCfg.label}
                        </Badge>
                        {log.intent && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                            {log.intent}
                          </span>
                        )}
                        {log.action_taken && log.action_taken !== log.intent && (
                          <span className="text-[10px] text-muted-foreground">
                            → {log.action_taken}
                          </span>
                        )}
                      </div>
                      <p className="text-sm truncate">
                        {log.content || "(sem conteúdo)"}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>
                          {formatDayMonthTimeBR(new Date(log.created_at))}
                        </span>
                        {log.from_phone && (
                          <span>• {log.from_phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4")}</span>
                        )}
                        {log.error_message && (
                          <span className="text-destructive">• {log.error_message}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <ArrowUpDown className={`h-3 w-3 ${isInbound ? "text-primary rotate-180" : "text-muted-foreground"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
