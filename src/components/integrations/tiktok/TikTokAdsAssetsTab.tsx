import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Image, Video, FileQuestion } from "lucide-react";
import { useTikTokAdAssets } from "@/hooks/useTikTokAdAssets";

function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TikTokAdsAssetsTab() {
  const { images, videos, assetsLoading, syncAssets } = useTikTokAdAssets();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {images.length} imagem(ns) · {videos.length} vídeo(s)
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncAssets.mutate()}
          disabled={syncAssets.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncAssets.isPending ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      <Tabs defaultValue="images" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="images" className="gap-1.5 text-xs">
            <Image className="h-3.5 w-3.5" />
            Imagens ({images.length})
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5 text-xs">
            <Video className="h-3.5 w-3.5" />
            Vídeos ({videos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-3">
          {assetsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : images.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileQuestion className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma imagem encontrada. Sincronize para importar do TikTok.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  {img.file_url ? (
                    <img
                      src={img.file_url}
                      alt={img.file_name || "Asset"}
                      className="w-full h-24 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-24 bg-muted flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-2">
                    <p className="text-[10px] truncate font-medium">{img.file_name || "Sem nome"}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {img.width > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {img.width}×{img.height}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        {formatFileSize(img.file_size)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-3">
          {assetsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : videos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileQuestion className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum vídeo encontrado. Sincronize para importar do TikTok.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {videos.map((vid) => (
                <Card key={vid.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate font-medium">{vid.file_name || "Sem nome"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {vid.duration > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {Number(vid.duration).toFixed(1)}s
                          </Badge>
                        )}
                        {vid.width > 0 && (
                          <span className="text-[9px] text-muted-foreground">
                            {vid.width}×{vid.height}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          {formatFileSize(vid.file_size)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
