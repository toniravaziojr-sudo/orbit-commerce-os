import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, MessageSquare, Download, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useMeliMessages } from "@/hooks/useMeliMessages";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  unanswered: { label: "Não respondida", variant: "destructive" },
  answered: { label: "Respondida", variant: "default" },
  closed: { label: "Fechada", variant: "secondary" },
  deleted: { label: "Excluída", variant: "outline" },
};

export function MeliMessagesTab() {
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<string>("");
  
  const { 
    messages, 
    total, 
    isLoading, 
    sync, 
    isSyncing, 
    refetch,
    answerQuestion,
    isAnswering,
  } = useMeliMessages({
    status,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(total / 20);

  const handleAnswer = (messageId: string) => {
    if (!answerText.trim()) return;
    
    answerQuestion(
      { messageId, answer: answerText.trim() },
      {
        onSuccess: () => {
          setAnswerText("");
          setExpandedMessage(null);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Mensagens do Mercado Livre
            </CardTitle>
            <CardDescription>
              {total} mensagens encontradas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => sync(false)}
              disabled={isSyncing}
            >
              <Download className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex items-center gap-4">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unanswered">Não respondidas</SelectItem>
              <SelectItem value="answered">Respondidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de mensagens */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma mensagem do Mercado Livre encontrada.</p>
            <p className="text-sm mt-2">Clique em "Sincronizar" para importar mensagens.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <Collapsible
                key={message.id}
                open={expandedMessage === message.id}
                onOpenChange={(open) => {
                  setExpandedMessage(open ? message.id : null);
                  setAnswerText("");
                }}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      {/* Thumbnail do item */}
                      {message.item_thumbnail && (
                        <img 
                          src={message.item_thumbnail} 
                          alt="" 
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={STATUS_MAP[message.status]?.variant || "outline"}>
                            {STATUS_MAP[message.status]?.label || message.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        
                        {message.item_title && (
                          <p className="text-sm font-medium truncate mb-1">
                            {message.item_title}
                          </p>
                        )}
                        
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.question_text}
                        </p>
                      </div>

                      <div className="flex items-center">
                        {expandedMessage === message.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t p-4 bg-muted/30 space-y-4">
                      {/* Pergunta completa */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Pergunta:</p>
                        <p className="text-sm">{message.question_text}</p>
                      </div>

                      {/* Resposta existente */}
                      {message.answer_text && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Sua resposta ({message.answered_at && format(new Date(message.answered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}):
                          </p>
                          <p className="text-sm bg-background p-3 rounded border">{message.answer_text}</p>
                        </div>
                      )}

                      {/* Form de resposta */}
                      {message.status === "unanswered" && (
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Digite sua resposta..."
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            className="min-h-[100px]"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleAnswer(message.id)}
                              disabled={isAnswering || !answerText.trim()}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {isAnswering ? "Enviando..." : "Enviar Resposta"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
