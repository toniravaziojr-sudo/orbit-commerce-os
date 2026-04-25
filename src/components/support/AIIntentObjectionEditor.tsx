import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ChevronDown, ChevronUp, AlertTriangle, MessageSquare } from "lucide-react";
import {
  useAiIntentObjectionMap,
  type AiIntentObjectionEntry,
  type IntentObjectionSeverity,
} from "@/hooks/useAiIntentObjectionMap";

const severityVariant = (s: IntentObjectionSeverity) =>
  s === 'high' ? 'destructive' : s === 'medium' ? 'default' : 'secondary';
const severityLabel = (s: IntentObjectionSeverity) =>
  s === 'high' ? 'Alta' : s === 'medium' ? 'Média' : s === 'low' ? 'Baixa' : '—';

interface EntryRowProps {
  entry: AiIntentObjectionEntry;
  onUpdate: (updates: Partial<AiIntentObjectionEntry>) => void;
  onToggleActive: (active: boolean) => void;
  isPending: boolean;
}

function EntryRow({ entry, onUpdate, onToggleActive, isPending }: EntryRowProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(entry.label);
  const [triggers, setTriggers] = useState(entry.trigger_patterns.join(', '));
  const [response, setResponse] = useState(entry.standard_response || '');
  const [severity, setSeverity] = useState<string>(entry.severity || 'none');
  const [state, setState] = useState(entry.recommended_state || '');

  const handleSave = () => {
    onUpdate({
      label: label.trim(),
      trigger_patterns: triggers.split(',').map(s => s.trim()).filter(Boolean),
      standard_response: response.trim() || null,
      severity: (severity === 'none' ? null : severity) as IntentObjectionSeverity,
      recommended_state: state.trim() || null,
    });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 gap-3 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {entry.entry_type === 'objection' ? (
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          ) : (
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="font-medium truncate">{entry.label}</span>
          {entry.severity && (
            <Badge variant={severityVariant(entry.severity)} className="text-xs">
              {severityLabel(entry.severity)}
            </Badge>
          )}
          {entry.has_manual_overrides && (
            <Badge variant="outline" className="text-xs">Editado</Badge>
          )}
          {!entry.is_active && (
            <Badge variant="secondary" className="text-xs">Desativado</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={entry.is_active} onCheckedChange={onToggleActive} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {open && (
        <div className="p-4 space-y-3 border-t">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Frases que ativam (gatilhos)</Label>
            <Input
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
              placeholder="tá caro, fora do orçamento, achei salgado"
            />
            <p className="text-xs text-muted-foreground">Separadas por vírgula.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem severidade</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado sugerido na conversa</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Ex: negociacao, descoberta, fechamento"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Resposta padrão sugerida</Label>
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
              placeholder="Como a IA deve responder quando essa intenção/objeção for detectada"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AIIntentObjectionEditor() {
  const { entries, isLoading, update, toggleActive, regenerate } = useAiIntentObjectionMap();

  const intents = entries.filter(e => e.entry_type === 'intent');
  const objections = entries.filter(e => e.entry_type === 'objection');

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Intenções e Objeções</CardTitle>
            <CardDescription>
              Catálogo de situações recorrentes nas conversas e como a IA deve responder.
              Novas entradas chegam pela Central de Insights — aqui você ajusta o que já foi aprovado.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {regenerate.isPending ? 'Gerando...' : 'Regenerar com IA'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-medium">Objeções ({objections.length})</h3>
          </div>
          {objections.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma objeção cadastrada. Use "Regenerar com IA" ou aprove sugestões na Central de Insights.
            </p>
          ) : (
            <div className="space-y-2">
              {objections.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onUpdate={(updates) => update.mutate({ id: entry.id, updates })}
                  onToggleActive={(active) => toggleActive.mutate({ id: entry.id, is_active: active })}
                  isPending={update.isPending}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Intenções ({intents.length})</h3>
          </div>
          {intents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma intenção cadastrada. Use "Regenerar com IA" ou aprove sugestões na Central de Insights.
            </p>
          ) : (
            <div className="space-y-2">
              {intents.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onUpdate={(updates) => update.mutate({ id: entry.id, updates })}
                  onToggleActive={(active) => toggleActive.mutate({ id: entry.id, is_active: active })}
                  isPending={update.isPending}
                />
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
