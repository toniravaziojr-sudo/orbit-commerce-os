import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Clock, CalendarClock, Send } from 'lucide-react';
import { useTikTokContentProfile } from '@/hooks/useTikTokContentProfile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Agendado', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    publishing: { label: 'Publicando', className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
    published: { label: 'Publicado', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
    failed: { label: 'Falhou', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
    draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-border' },
  };
  const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}

export function TikTokContentScheduleTab() {
  const { scheduledPosts, postsLoading, createScheduledPost, deleteScheduledPost, publishScheduled } = useTikTokContentProfile();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('SELF_ONLY');
  const [scheduledAt, setScheduledAt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const handleCreate = () => {
    if (!title || !scheduledAt) return;
    createScheduledPost.mutate({
      title,
      description: description || undefined,
      privacy_level: privacyLevel,
      video_storage_path: videoUrl || undefined,
      scheduled_at: new Date(scheduledAt).toISOString(),
    }, {
      onSuccess: () => {
        setShowForm(false);
        setTitle('');
        setDescription('');
        setScheduledAt('');
        setVideoUrl('');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {scheduledPosts.length} post(s) agendado(s)
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => publishScheduled.mutate()}
            disabled={publishScheduled.isPending}
          >
            {publishScheduled.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Publicar Pendentes
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Agendar
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label htmlFor="sched-title" className="text-sm">Título *</Label>
            <Input id="sched-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do vídeo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-desc" className="text-sm">Descrição</Label>
            <Input id="sched-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do vídeo (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sched-date" className="text-sm">Data/Hora *</Label>
              <Input id="sched-date" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Privacidade</Label>
              <Select value={privacyLevel} onValueChange={setPrivacyLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF_ONLY">Só eu</SelectItem>
                  <SelectItem value="MUTUAL_FOLLOW_FRIENDS">Amigos</SelectItem>
                  <SelectItem value="FOLLOWER_OF_CREATOR">Seguidores</SelectItem>
                  <SelectItem value="PUBLIC_TO_EVERYONE">Público</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-url" className="text-sm">URL do Vídeo</Label>
            <Input id="sched-url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://... (URL pública do vídeo)" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!title || !scheduledAt || createScheduledPost.isPending}>
              {createScheduledPost.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Agendar Post
            </Button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {postsLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : scheduledPosts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum post agendado</p>
          <p className="text-xs mt-1">Clique em "Agendar" para criar um novo post</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scheduledPosts.map((post: any) => (
            <div key={post.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <StatusBadge status={post.status} />
                </div>
                {post.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{post.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Agendado: {format(new Date(post.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {post.published_at && (
                    <span>
                      Publicado: {format(new Date(post.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {post.privacy_level && (
                    <span className="capitalize">{post.privacy_level.replace(/_/g, ' ').toLowerCase()}</span>
                  )}
                </div>
                {post.error_message && (
                  <p className="text-xs text-destructive mt-1">{post.error_message}</p>
                )}
              </div>
              {post.status === 'scheduled' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={() => deleteScheduledPost.mutate(post.id)}
                  disabled={deleteScheduledPost.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
