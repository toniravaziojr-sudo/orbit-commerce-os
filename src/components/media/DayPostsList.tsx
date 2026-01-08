import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Edit2, Clock, Instagram, Facebook, Newspaper } from "lucide-react";
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

// Limites por tipo
const PUBLICATION_LIMITS = {
  feed: 4,
  stories: 10,
  blog: 2,
};

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
  failed: "Com Erros",
  skipped: "Ignorado",
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

// Helper para obter o tipo da publicação
const getPublicationType = (item: MediaCalendarItem): "feed" | "stories" | "blog" => {
  const platforms = item.target_platforms || [];
  const type = item.content_type as string;
  
  if (type === "text" || type === "blog" || platforms.includes("blog")) {
    return "blog";
  }
  if (type === "story" || type === "stories") {
    return "stories";
  }
  return "feed";
};

// Helper para contar publicações por tipo
const getCountsByType = (items: MediaCalendarItem[]) => {
  return {
    feed: items.filter(i => getPublicationType(i) === "feed").length,
    stories: items.filter(i => getPublicationType(i) === "stories").length,
    blog: items.filter(i => getPublicationType(i) === "blog").length,
  };
};

// Ícone do canal/tipo
const getChannelIcon = (item: MediaCalendarItem) => {
  const platforms = item.target_platforms || [];
  const type = item.content_type as string;
  const isStory = type === "story" || type === "stories";
  const isBlog = type === "text" || type === "blog" || platforms.includes("blog");

  if (isBlog) {
    return (
      <div className="flex items-center gap-1">
        <Newspaper className="h-4 w-4 text-emerald-600" />
        <span className="text-xs text-muted-foreground">Blog</span>
      </div>
    );
  }

  if (isStory) {
    return (
      <div className="flex items-center gap-1">
        {platforms.includes("instagram") && (
          <span className="font-bold text-orange-500 text-sm">S</span>
        )}
        {platforms.includes("facebook") && (
          <span className="font-bold text-blue-600 text-sm">S</span>
        )}
        <span className="text-xs text-muted-foreground">Story</span>
      </div>
    );
  }

  // Feed
  return (
    <div className="flex items-center gap-1">
      {platforms.includes("instagram") && (
        <Instagram className="h-4 w-4 text-orange-500" />
      )}
      {platforms.includes("facebook") && (
        <Facebook className="h-4 w-4 text-blue-600" />
      )}
      <span className="text-xs text-muted-foreground">Feed</span>
    </div>
  );
};

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
  const counts = getCountsByType(items);
  const totalLimit = PUBLICATION_LIMITS.feed + PUBLICATION_LIMITS.stories + PUBLICATION_LIMITS.blog;
  const canAddMore = items.length < totalLimit;

  const handleDelete = (id: string) => {
    onDeleteItem(id);
    setConfirmDelete(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="capitalize">
              {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {holiday && (
              <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                {holiday.emoji} {holiday.name}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-2">
            <span>Feed: {counts.feed}/{PUBLICATION_LIMITS.feed}</span>
            <span>•</span>
            <span>Stories: {counts.stories}/{PUBLICATION_LIMITS.stories}</span>
            <span>•</span>
            <span>Blog: {counts.blog}/{PUBLICATION_LIMITS.blog}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">Nenhuma publicação neste dia</p>
                <Button onClick={() => onAddItem(date)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Publicação
                </Button>
              </div>
            ) : (
              <>
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-accent/50 cursor-pointer group",
                      confirmDelete === item.id && "border-destructive bg-destructive/5"
                    )}
                    onClick={() => {
                      if (confirmDelete !== item.id) {
                        onEditItem(item);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Preview image or placeholder */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {item.asset_thumbnail_url || item.asset_url ? (
                          <img 
                            src={item.asset_thumbnail_url || item.asset_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-muted-foreground/50">
                            {getPublicationType(item) === "blog" ? (
                              <Newspaper className="h-5 w-5" />
                            ) : getPublicationType(item) === "stories" ? (
                              <span className="font-bold text-lg">S</span>
                            ) : (
                              <Instagram className="h-5 w-5" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          {getChannelIcon(item)}
                          <Badge className={cn("text-xs h-5", statusColors[item.status])}>
                            {statusLabels[item.status] || item.status}
                          </Badge>
                        </div>
                        <p className="font-medium truncate text-sm">
                          {item.title || "Sem título"}
                        </p>
                        {item.copy && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.copy}
                          </p>
                        )}
                        {item.scheduled_time && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {item.scheduled_time.slice(0, 5)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {confirmDelete === item.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleDelete(item.id)}
                            >
                              Excluir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Não
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                onEditItem(item);
                                onOpenChange(false);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Add button at bottom */}
        {items.length > 0 && canAddMore && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                onAddItem(date);
                onOpenChange(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Adicionar Publicação
            </Button>
          </div>
        )}

        {items.length > 0 && !canAddMore && (
          <div className="pt-2 border-t">
            <p className="text-center text-sm text-muted-foreground">
              Limite máximo de publicações atingido
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
