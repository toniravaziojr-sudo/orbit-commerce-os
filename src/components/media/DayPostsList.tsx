import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Edit2, Clock, Instagram, Facebook, Newspaper, Eye, Copy } from "lucide-react";
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
import { PublicationPreviewDialog } from "./PublicationPreviewDialog";

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
  draft: "Em Construção",
  suggested: "Em Construção",
  review: "Em Construção",
  generating_asset: "Gerando",
  asset_review: "Revisar Asset",
  approved: "Aprovado",
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
  onDuplicateItem?: (item: MediaCalendarItem) => void;
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

// Ícone do canal/tipo - suporta múltiplos canais do mesmo formato
const getChannelIcon = (item: MediaCalendarItem) => {
  const platforms = item.target_platforms || [];
  const type = item.content_type as string;
  
  const isBlog = type === "text" || type === "blog" || platforms.includes("blog");
  const isStory = type === "story" || type === "stories" || platforms.some(p => p.startsWith("story_"));
  
  // Detecta quais redes estão presentes
  const hasInstagram = platforms.some(p => p.includes("instagram"));
  const hasFacebook = platforms.some(p => p.includes("facebook"));
  const hasBoth = hasInstagram && hasFacebook;

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
        {hasBoth ? (
          // S bicolor - metade laranja, metade azul
          <span className="font-bold text-sm bg-gradient-to-r from-orange-500 to-blue-600 bg-clip-text text-transparent">S</span>
        ) : hasInstagram ? (
          <span className="font-bold text-sm text-orange-500">S</span>
        ) : hasFacebook ? (
          <span className="font-bold text-sm text-blue-600">S</span>
        ) : (
          <span className="font-bold text-sm text-muted-foreground">S</span>
        )}
        <span className="text-xs text-muted-foreground">Story</span>
      </div>
    );
  }

  // Feed
  return (
    <div className="flex items-center gap-1">
      {hasBoth ? (
        // Ícones combinados para ambos
        <>
          <Instagram className="h-4 w-4 text-orange-500" />
          <Facebook className="h-4 w-4 text-blue-600" />
        </>
      ) : hasInstagram ? (
        <Instagram className="h-4 w-4 text-orange-500" />
      ) : hasFacebook ? (
        <Facebook className="h-4 w-4 text-blue-600" />
      ) : null}
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
  onDuplicateItem,
}: DayPostsListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaCalendarItem | null>(null);
  const holiday = getHolidayForDate(date);
  const counts = getCountsByType(items);
  const totalLimit = PUBLICATION_LIMITS.feed + PUBLICATION_LIMITS.stories + PUBLICATION_LIMITS.blog;
  const canAddMore = items.length < totalLimit;

  const handleDelete = (id: string) => {
    onDeleteItem(id);
    setConfirmDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col overflow-hidden max-h-[90vh]">
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

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
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
                        <p className="font-medium text-sm line-clamp-1">
                          {item.title || "Sem título"}
                        </p>
                        {/* Status indicators for what's missing */}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(!item.copy || item.copy.trim() === "") && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Sem copy
                            </span>
                          )}
                          {item.copy && item.copy.trim() !== "" && !item.asset_url && item.content_type !== "text" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              Sem criativo
                            </span>
                          )}
                          {item.asset_url && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              ✓ Criativo
                            </span>
                          )}
                        </div>
                        {item.copy && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.copy.slice(0, 60)}...
                          </p>
                        )}
                        {item.scheduled_time && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {item.scheduled_time.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions - below content, always visible */}
                    <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                      {confirmDelete === item.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-3 text-xs"
                            onClick={() => handleDelete(item.id)}
                          >
                            Excluir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => {
                              onEditItem(item);
                              onOpenChange(false);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {onDuplicateItem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1 text-xs"
                              onClick={() => onDuplicateItem(item)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </>
                      )}
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

      {/* Preview Dialog */}
      <PublicationPreviewDialog
        open={!!previewItem}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        item={previewItem}
        onEdit={(item) => {
          setPreviewItem(null);
          onEditItem(item);
          onOpenChange(false);
        }}
      />
    </>
  );
}
