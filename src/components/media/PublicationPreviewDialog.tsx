import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  Instagram, 
  Facebook, 
  Newspaper, 
  Edit2, 
  X,
  ZoomIn,
  Hash,
  MessageSquare,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";

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

interface PublicationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaCalendarItem | null;
  onEdit?: (item: MediaCalendarItem) => void;
}

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

const getChannelInfo = (item: MediaCalendarItem) => {
  const platforms = item.target_platforms || [];
  const type = item.content_type as string;
  const isStory = type === "story" || type === "stories";
  const isBlog = type === "text" || type === "blog" || platforms.includes("blog");

  if (isBlog) {
    return { icon: Newspaper, label: "Blog", color: "text-emerald-600" };
  }
  if (isStory) {
    return { icon: Instagram, label: "Story", color: "text-orange-500" };
  }
  return { icon: Instagram, label: "Feed", color: "text-orange-500" };
};

export function PublicationPreviewDialog({
  open,
  onOpenChange,
  item,
  onEdit,
}: PublicationPreviewDialogProps) {
  const [imageZoomed, setImageZoomed] = useState(false);

  if (!item) return null;

  const channelInfo = getChannelInfo(item);
  const platforms = item.target_platforms || [];
  const hasImage = item.asset_url || item.asset_thumbnail_url;
  const imageUrl = item.asset_url || item.asset_thumbnail_url;

  return (
    <>
      {/* Main Preview Dialog */}
      <Dialog open={open && !imageZoomed} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span>{item.title || "Sem título"}</span>
                <Badge className={cn("text-xs", statusColors[item.status])}>
                  {statusLabels[item.status] || item.status}
                </Badge>
              </DialogTitle>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <channelInfo.icon className={cn("h-4 w-4", channelInfo.color)} />
                <span>{channelInfo.label}</span>
              </div>
              {platforms.includes("instagram") && (
                <div className="flex items-center gap-1">
                  <Instagram className="h-4 w-4 text-orange-500" />
                  <span>Instagram</span>
                </div>
              )}
              {platforms.includes("facebook") && (
                <div className="flex items-center gap-1">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  <span>Facebook</span>
                </div>
              )}
              {item.scheduled_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{item.scheduled_time.slice(0, 5)}</span>
                </div>
              )}
              {item.scheduled_date && (
                <span>
                  {format(new Date(item.scheduled_date), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              {/* Image Preview */}
              {hasImage ? (
                <div 
                  className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
                  onClick={() => setImageZoomed(true)}
                >
                  <img 
                    src={imageUrl} 
                    alt={item.title || "Preview"} 
                    className="w-full max-h-[300px] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex items-center gap-2 text-white">
                      <ZoomIn className="h-6 w-6" />
                      <span className="font-medium">Ampliar</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-muted h-[200px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Imagem não gerada</p>
                  </div>
                </div>
              )}

              {/* Copy/Content */}
              {item.copy && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span>Conteúdo</span>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="whitespace-pre-wrap text-sm">{item.copy}</p>
                  </div>
                </div>
              )}

              {/* CTA */}
              {item.cta && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Call to Action</div>
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="text-sm font-medium text-primary">{item.cta}</p>
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {item.hashtags && item.hashtags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <span>Hashtags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.hashtags.map((tag, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        #{tag.replace(/^#/, "")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Prompt */}
              {item.generation_prompt && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Prompt de Geração
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    {item.generation_prompt}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          {onEdit && (
            <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  onEdit(item);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Editar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Zoomed Image Dialog */}
      <Dialog open={imageZoomed} onOpenChange={setImageZoomed}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setImageZoomed(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            {hasImage && (
              <img 
                src={imageUrl} 
                alt={item.title || "Preview"} 
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
