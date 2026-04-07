import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, RefreshCw, Search, Loader2, MessageSquare, Send, MapPin, AlertCircle, ExternalLink } from "lucide-react";
import { useGoogleBusiness } from "@/hooks/useGoogleBusiness";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function GoogleBusinessReviewsTab() {
  const { isConnected, connection } = useGoogleConnection();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const {
    locationsQuery,
    reviewsQuery,
    syncReviewsMutation,
    replyMutation,
    syncAllMutation,
  } = useGoogleBusiness(selectedLocationId || undefined);

  const [searchTerm, setSearchTerm] = useState("");
  const [replyDialog, setReplyDialog] = useState<{ reviewId: string; reviewerName: string; comment: string } | null>(null);
  const [replyText, setReplyText] = useState("");

  const locations = locationsQuery.data || [];
  const reviews = reviewsQuery.data || [];

  // Auto-select first location
  if (locations.length > 0 && !selectedLocationId) {
    setSelectedLocationId(locations[0].location_id || locations[0].id);
  }

  if (!isConnected) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Conecte sua conta Google na página de{" "}
          <a href="/integrations?tab=google" className="underline font-medium">Integrações</a>{" "}
          para gerenciar avaliações do Google Meu Negócio.
        </AlertDescription>
      </Alert>
    );
  }

  const hasBusinessScope = connection?.scopePacks?.includes("business");
  if (!hasBusinessScope) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          O escopo "Google Meu Negócio" não está ativo. Reconecte sua conta Google com o pacote Business habilitado.
        </AlertDescription>
      </Alert>
    );
  }

  const filteredReviews = reviews.filter((r: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      r.reviewer_name?.toLowerCase().includes(s) ||
      r.comment?.toLowerCase().includes(s)
    );
  });

  const handleSync = () => {
    if (!selectedLocationId) return;
    syncAllMutation.mutate(selectedLocationId, {
      onSuccess: () => toast.success("Avaliações sincronizadas!"),
      onError: () => toast.error("Erro ao sincronizar"),
    });
  };

  const handleReply = () => {
    if (!replyDialog || !replyText.trim() || !selectedLocationId) return;
    replyMutation.mutate(
      { locationId: selectedLocationId, reviewId: replyDialog.reviewId, replyText: replyText.trim() },
      {
        onSuccess: () => {
          toast.success("Resposta enviada!");
          setReplyDialog(null);
          setReplyText("");
        },
        onError: () => toast.error("Erro ao enviar resposta"),
      }
    );
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );

  const avgRating = reviews.length
    ? (reviews.reduce((sum: number, r: any) => sum + (r.star_rating || r.rating || 0), 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      {/* Location selector + sync */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="w-[280px]">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Selecione um local" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc: any) => (
              <SelectItem key={loc.location_id || loc.id} value={loc.location_id || loc.id}>
                {loc.name || loc.title || loc.location_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncAllMutation.isPending || !selectedLocationId}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{reviews.length}</div>
            <p className="text-sm text-muted-foreground">Total de Avaliações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold flex items-center gap-1">
              {avgRating} <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-sm text-muted-foreground">Nota Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {reviews.filter((r: any) => r.reply_text || r.reply_comment).length}
            </div>
            <p className="text-sm text-muted-foreground">Respondidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {reviews.filter((r: any) => !r.reply_text && !r.reply_comment).length}
            </div>
            <p className="text-sm text-muted-foreground">Sem Resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar avaliações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Reviews table */}
      {reviewsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {selectedLocationId ? "Nenhuma avaliação encontrada." : "Selecione um local para ver avaliações."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avaliador</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="hidden md:table-cell">Comentário</TableHead>
                  <TableHead className="hidden lg:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review: any) => {
                  const hasReply = !!(review.reply_text || review.reply_comment);
                  const rating = review.star_rating || review.rating || 0;
                  const comment = review.comment || review.content || "";
                  const reviewerName = review.reviewer_name || review.reviewer?.displayName || "Anônimo";
                  const createdAt = review.create_time || review.created_at;

                  return (
                    <TableRow key={review.id || review.review_id}>
                      <TableCell className="font-medium">{reviewerName}</TableCell>
                      <TableCell>{renderStars(rating)}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate">{comment || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {createdAt ? format(new Date(createdAt), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell>
                        {hasReply ? (
                          <Badge className="bg-green-500/10 text-green-600">Respondida</Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setReplyDialog({
                              reviewId: review.review_id || review.id,
                              reviewerName,
                              comment,
                            })
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reply dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => { setReplyDialog(null); setReplyText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Avaliação</DialogTitle>
          </DialogHeader>
          {replyDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{replyDialog.reviewerName}</p>
                <p className="text-sm text-muted-foreground">{replyDialog.comment || "Sem comentário"}</p>
              </div>
              <Textarea
                placeholder="Digite sua resposta..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyDialog(null); setReplyText(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleReply} disabled={!replyText.trim() || replyMutation.isPending}>
              {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
