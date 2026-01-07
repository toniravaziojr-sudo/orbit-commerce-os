import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Edit2, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { getHolidayForDate } from "@/lib/brazilian-holidays";

const MAX_POSTS_PER_DAY = 4;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  suggested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  generating_asset: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  asset_review: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  scheduled: "bg-primary/10 text-primary",
  publishing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  published: "bg-green-600 text-white",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground line-through",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  suggested: "Sugerido",
  review: "Revisão",
  approved: "Aprovado",
  generating_asset: "Gerando",
  asset_review: "Revisar Asset",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falha",
  skipped: "Ignorado",
};

const contentTypeIcons: Record<string, string> = {
  image: "🖼️",
  carousel: "📸",
  story: "📱",
  text: "📝",
};

interface DayPostsListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  items: MediaCalendarItem[];
  onEditItem: (item: MediaCalendarItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void;
}

export function DayPostsList({
  open,
  onOpenChange,
  date,
  items,
  onEditItem,
  onAddItem,
  onDeleteItem,
}: DayPostsListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const holiday = getHolidayForDate(date);
  const canAddMore = items.length < MAX_POSTS_PER_DAY;

  const handleDelete = (id: string) => {
    onDeleteItem(id);
    setConfirmDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="capitalize">
              {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {holiday && (
              <Badge variant="outline" className="text-xs">
                {holiday.emoji} {holiday.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {items.length} de {MAX_POSTS_PER_DAY} postagens
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">Nenhuma postagem neste dia</p>
                <Button onClick={() => onAddItem(date)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Postagem
                </Button>
              </div>
            ) : (
              <>
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors hover:border-primary/50 cursor-pointer",
                      confirmDelete === item.id && "border-destructive bg-destructive/5"
                    )}
                    onClick={() => {
                      if (confirmDelete !== item.id) {
                        onEditItem(item);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            #{index + 1}
                          </span>
                          <span>{contentTypeIcons[item.content_type]}</span>
                          <Badge className={cn("text-xs", statusColors[item.status])}>
                            {statusLabels[item.status]}
                          </Badge>
                          {item.asset_url && (
                            <Badge variant="outline" className="text-xs">
                              📎 Criativo
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">
                          {item.title || "Sem título"}
                        </p>
                        {item.copy && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {item.copy}
                          </p>
                        )}
                        {item.scheduled_time && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3" />
                            {item.scheduled_time.slice(0, 5)}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {confirmDelete === item.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(item.id)}
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                onEditItem(item);
                                onOpenChange(false);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {canAddMore && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      onAddItem(date);
                      onOpenChange(false);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Postagem ({items.length}/{MAX_POSTS_PER_DAY})
                  </Button>
                )}

                {!canAddMore && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Limite de {MAX_POSTS_PER_DAY} postagens por dia atingido
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
