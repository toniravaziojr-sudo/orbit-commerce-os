import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, Trash2 } from "lucide-react";
import { useTikTokAudiences } from "@/hooks/useTikTokAudiences";

export function TikTokAdsAudiencesTab() {
  const { audiences, audiencesLoading, syncAudiences, deleteAudience } = useTikTokAudiences();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {audiences.length} público(s) sincronizado(s)
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncAudiences.mutate()}
          disabled={syncAudiences.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncAudiences.isPending ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {audiencesLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : audiences.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum público encontrado. Clique em Sincronizar para importar do TikTok.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {audiences.map((a) => (
            <Card key={a.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm truncate">{a.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {a.audience_type}
                      </Badge>
                      {a.cover_num > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {a.cover_num.toLocaleString("pt-BR")} usuários
                        </span>
                      )}
                      {!a.is_valid && (
                        <Badge variant="destructive" className="text-[10px]">Inválido</Badge>
                      )}
                      {a.is_expired && (
                        <Badge variant="secondary" className="text-[10px]">Expirado</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteAudience.mutate(a.tiktok_audience_id)}
                    disabled={deleteAudience.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
