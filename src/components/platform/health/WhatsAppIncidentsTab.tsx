import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  useWhatsAppIncidents,
  useWhatsAppOrphanInbound,
  resolveWhatsAppIncident,
} from '@/hooks/useSystemHealth';

const BRT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return BRT.format(new Date(d)); } catch { return '—'; }
}

function severityBadge(sev: string) {
  const v: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
    critical: 'destructive', high: 'destructive', medium: 'default', low: 'secondary',
  };
  return <Badge variant={v[sev] ?? 'outline'}>{sev}</Badge>;
}

function statusBadge(status: string) {
  const v: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
    open: 'destructive', acknowledged: 'default', resolved: 'secondary',
  };
  return <Badge variant={v[status] ?? 'outline'}>{status}</Badge>;
}

export function WhatsAppIncidentsTab() {
  const incidents = useWhatsAppIncidents(50);
  const orphans = useWhatsAppOrphanInbound(50);
  const qc = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const onResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const result = await resolveWhatsAppIncident(id, 'Resolvido manualmente pelo operador');
      if (result.success) {
        toast({ title: 'Incidente resolvido', description: 'O registro foi marcado como resolvido.' });
        await qc.invalidateQueries({ queryKey: ['system-health'] });
      } else {
        toast({ title: 'Nada a resolver', description: 'O incidente já estava resolvido.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao resolver', variant: 'destructive' });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Incidentes do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : incidents.error ? (
            <p className="text-sm text-destructive">{(incidents.error as Error).message}</p>
          ) : (incidents.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Nenhum incidente aberto.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lojista</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detectado</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(incidents.data ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.tenant_name}</TableCell>
                      <TableCell><code className="text-xs">{i.incident_type}</code></TableCell>
                      <TableCell>{severityBadge(i.severity)}</TableCell>
                      <TableCell className="max-w-xs truncate" title={i.title}>{i.title}</TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(i.detected_at)}</TableCell>
                      <TableCell className="text-right">
                        {i.status !== 'resolved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onResolve(i.id)}
                            disabled={resolvingId === i.id}
                          >
                            {resolvingId === i.id ? 'Resolvendo...' : 'Resolver'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-warning" />
            Mensagens recebidas não processadas (&gt; 5 min)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orphans.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : orphans.error ? (
            <p className="text-sm text-destructive">{(orphans.error as Error).message}</p>
          ) : (orphans.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Nenhuma mensagem travada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lojista</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Idade</TableHead>
                    <TableHead>Recebido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orphans.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.tenant_name}</TableCell>
                      <TableCell className="text-xs">{m.from_phone ?? '—'}</TableCell>
                      <TableCell><code className="text-xs">{m.message_type ?? '—'}</code></TableCell>
                      <TableCell>
                        <Badge variant={m.processing_status === 'failed' ? 'destructive' : 'secondary'}>
                          {m.processing_status ?? 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={m.age_minutes > 60 ? 'text-destructive font-semibold' : 'text-warning'}>
                          {m.age_minutes} min
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(m.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
