import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Calendar, CalendarPlus, Clock, MapPin, Users, AlertCircle, ExternalLink } from "lucide-react";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useGoogleCalendar, type CalendarEvent } from "@/hooks/useGoogleCalendar";
import { format, parseISO,  isTomorrow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { formatDayMonthTimeBR, formatTimeBR, isTodayBR } from "@/lib/date-format";

export function GoogleCalendarTab() {
  const { isConnected, connection } = useGoogleConnection();
  const hasCalendarScope = connection?.scopePacks?.includes("calendar");
  const { eventsQuery, syncMutation, createEventMutation } = useGoogleCalendar();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ summary: "", description: "", start: "", end: "", location: "" });

  if (!isConnected || !hasCalendarScope) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Conecte sua conta Google com o escopo <strong>Calendar</strong> para sincronizar eventos.
          </span>
          <Link to="/integrations?tab=google" className="flex items-center gap-1 text-primary hover:underline ml-4">
            Ir para Integrações <ExternalLink className="h-3 w-3" />
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const events = (eventsQuery.data as CalendarEvent[]) || [];
  const upcomingEvents = events.filter(e => !isPast(parseISO(e.end)));
  const pastEvents = events.filter(e => isPast(parseISO(e.end)));

  const handleCreateEvent = () => {
    if (!newEvent.summary || !newEvent.start || !newEvent.end) {
      toast.error("Preencha título, início e fim");
      return;
    }
    createEventMutation.mutate(
      { summary: newEvent.summary, description: newEvent.description, start: newEvent.start, end: newEvent.end, location: newEvent.location },
      {
        onSuccess: () => {
          toast.success("Evento criado no Google Calendar!");
          setCreateOpen(false);
          setNewEvent({ summary: "", description: "", start: "", end: "", location: "" });
        },
        onError: () => toast.error("Erro ao criar evento"),
      }
    );
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isTodayBR(d)) return `Hoje, ${formatTimeBR(d)}`;
      if (isTomorrow(d)) return `Amanhã, ${formatTimeBR(d)}`;
      return formatDayMonthTimeBR(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Próximos Eventos</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {eventsQuery.isLoading ? <Skeleton className="h-7 w-12" /> : upcomingEvents.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos Passados (7d)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {eventsQuery.isLoading ? <Skeleton className="h-7 w-12" /> : pastEvents.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total no Período</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {eventsQuery.isLoading ? <Skeleton className="h-7 w-12" /> : events.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>Eventos dos próximos 30 dias</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Evento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Título</Label>
                    <Input value={newEvent.summary} onChange={e => setNewEvent(p => ({ ...p, summary: e.target.value }))} placeholder="Reunião de equipe" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Início</Label>
                      <Input type="datetime-local" value={newEvent.start} onChange={e => setNewEvent(p => ({ ...p, start: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Fim</Label>
                      <Input type="datetime-local" value={newEvent.end} onChange={e => setNewEvent(p => ({ ...p, end: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Local (opcional)</Label>
                    <Input value={newEvent.location} onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))} placeholder="Escritório / Google Meet" />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={3} />
                  </div>
                  <Button onClick={handleCreateEvent} disabled={createEventMutation.isPending} className="w-full">
                    {createEventMutation.isPending ? "Criando..." : "Criar Evento"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum evento encontrado</p>
              <p className="text-sm mt-1">Clique em Sincronizar para buscar eventos do Calendar</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="w-[160px]">Início</TableHead>
                    <TableHead className="w-[160px]">Fim</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingEvents.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{evt.summary}</span>
                          {evt.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" /> {evt.location}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatEventDate(evt.start)}</TableCell>
                      <TableCell className="text-sm">{formatEventDate(evt.end)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="text-xs">Próximo</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pastEvents.map((evt) => (
                    <TableRow key={evt.id} className="opacity-60">
                      <TableCell>
                        <div>
                          <span>{evt.summary}</span>
                          {evt.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" /> {evt.location}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatEventDate(evt.start)}</TableCell>
                      <TableCell className="text-sm">{formatEventDate(evt.end)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">Passado</Badge>
                      </TableCell>
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
