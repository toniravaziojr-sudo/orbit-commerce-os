import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, RefreshCw, Users, Video, Heart, UserPlus } from 'lucide-react';
import { useTikTokContentProfile } from '@/hooks/useTikTokContentProfile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TikTokContentProfileTab() {
  const { profile, profileLoading, syncProfile } = useTikTokContentProfile();

  if (profileLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Informações do Perfil TikTok</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncProfile.mutate()}
          disabled={syncProfile.isPending}
        >
          {syncProfile.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      {!profile ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Perfil não carregado</p>
          <p className="text-xs mt-1">Clique em "Sincronizar" para importar dados do perfil</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Profile header */}
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || 'TikTok'} />
              <AvatarFallback className="text-lg">
                {(profile.display_name || 'T').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{profile.display_name || 'Sem nome'}</p>
              {profile.bio_description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio_description}</p>
              )}
              {profile.profile_synced_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Atualizado em {format(new Date(profile.profile_synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 border rounded-lg text-center">
              <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{(profile.follower_count || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <UserPlus className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{(profile.following_count || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <Video className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{(profile.video_count || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Vídeos</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{(profile.likes_count || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Curtidas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
