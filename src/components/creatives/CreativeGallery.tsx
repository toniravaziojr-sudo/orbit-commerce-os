/**
 * Gestão de Criativos — Galeria Visual
 * 
 * Exibe os criativos gerados em formato de grid com thumbnails
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Video, 
  Image, 
  Download, 
  Play, 
  Expand, 
  Filter, 
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  Grid3X3,
  LayoutList,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCreativeJobs, getStatusColor, getStatusLabel } from '@/hooks/useCreatives';
import type { CreativeJob, CreativeType } from '@/types/creatives';

const TYPE_LABELS: Record<CreativeType, string> = {
  ugc_client_video: 'UGC Cliente',
  ugc_ai_video: 'UGC 100% IA',
  short_video: 'Vídeo Curto',
  tech_product_video: 'Vídeo Tech',
  product_image: 'Imagem',
  avatar_mascot: 'Avatar Mascote',
};

const TYPE_ICONS: Record<CreativeType, React.ReactNode> = {
  ugc_client_video: <Video className="h-4 w-4" />,
  ugc_ai_video: <Video className="h-4 w-4" />,
  short_video: <Video className="h-4 w-4" />,
  tech_product_video: <Video className="h-4 w-4" />,
  product_image: <Image className="h-4 w-4" />,
  avatar_mascot: <Video className="h-4 w-4" />,
};

interface CreativeGalleryProps {
  filterType?: CreativeType;
  showFilters?: boolean;
}

export function CreativeGallery({ filterType, showFilters = true }: CreativeGalleryProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CreativeType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'processing'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedJob, setSelectedJob] = useState<CreativeJob | null>(null);
  
  const { data: jobs, isLoading } = useCreativeJobs(filterType);

  // Filtrar jobs
  const filteredJobs = (jobs || []).filter(job => {
    // Filtro por tipo
    if (typeFilter !== 'all' && job.type !== typeFilter) return false;
    
    // Filtro por status
    if (statusFilter === 'succeeded' && job.status !== 'succeeded') return false;
    if (statusFilter === 'processing' && !['queued', 'running'].includes(job.status)) return false;
    
    // Filtro por busca
    if (search) {
      const searchLower = search.toLowerCase();
      const matchPrompt = job.prompt?.toLowerCase().includes(searchLower);
      const matchProduct = job.product_name?.toLowerCase().includes(searchLower);
      if (!matchPrompt && !matchProduct) return false;
    }
    
    return true;
  });

  // Separar criativos concluídos
  const succeededJobs = filteredJobs.filter(j => j.status === 'succeeded');
  const processingJobs = filteredJobs.filter(j => ['queued', 'running'].includes(j.status));

  const isVideo = (type: CreativeType) => type !== 'product_image';

  const getThumbnail = (job: CreativeJob): string | null => {
    if (job.status !== 'succeeded' || !job.output_urls?.length) return null;
    
    // Para vídeos, podemos usar um frame ou placeholder
    // Para imagens, usar a URL diretamente
    return job.output_urls[0];
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || 'criativo';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: abrir em nova aba
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por prompt ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CreativeType | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'succeeded' | 'processing')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="succeeded">Concluídos</SelectItem>
              <SelectItem value="processing">Em andamento</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none border-l"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Processing Jobs Banner */}
      {processingJobs.length > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <CardTitle className="text-sm font-medium">
                {processingJobs.length} criativo{processingJobs.length > 1 ? 's' : ''} em processamento
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {processingJobs.slice(0, 5).map((job) => (
                <Badge key={job.id} variant="outline" className="bg-background">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  {job.prompt?.slice(0, 30) || job.product_name || 'Processando...'}
                </Badge>
              ))}
              {processingJobs.length > 5 && (
                <Badge variant="outline" className="bg-background">
                  +{processingJobs.length - 5} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gallery Grid */}
      {succeededJobs.length === 0 && processingJobs.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-1">Nenhum criativo ainda</h3>
          <p className="text-sm text-muted-foreground">
            Os criativos gerados aparecerão aqui em formato de galeria.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {succeededJobs.map((job) => (
            <GalleryCard 
              key={job.id} 
              job={job} 
              onView={() => setSelectedJob(job)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {succeededJobs.map((job) => (
            <GalleryListItem 
              key={job.id} 
              job={job} 
              onView={() => setSelectedJob(job)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedJob && TYPE_ICONS[selectedJob.type]}
              {selectedJob?.prompt?.slice(0, 50) || selectedJob?.product_name || 'Criativo'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {selectedJob.type === 'product_image' ? (
                  <img
                    src={selectedJob.output_urls?.[0]}
                    alt="Criativo gerado"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={selectedJob.output_urls?.[0]}
                    controls
                    className="w-full h-full"
                    autoPlay
                  />
                )}
              </div>

              {/* Multiple outputs */}
              {selectedJob.output_urls && selectedJob.output_urls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedJob.output_urls.map((url, idx) => (
                    <button
                      key={idx}
                      className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                      onClick={() => {
                        // Swap preview
                        const urls = [...selectedJob.output_urls!];
                        urls.unshift(urls.splice(idx, 1)[0]);
                        setSelectedJob({ ...selectedJob, output_urls: urls });
                      }}
                    >
                      {selectedJob.type === 'product_image' ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={url} className="w-full h-full object-cover" muted />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{' '}
                  <span className="font-medium">{TYPE_LABELS[selectedJob.type]}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Criado:</span>{' '}
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(selectedJob.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>
                {selectedJob.cost_cents && selectedJob.cost_cents > 0 && (
                  <div>
                    <span className="text-muted-foreground">Custo:</span>{' '}
                    <span className="font-medium">
                      {(selectedJob.cost_cents / 100).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </span>
                  </div>
                )}
                {selectedJob.processing_time_ms && (
                  <div>
                    <span className="text-muted-foreground">Tempo:</span>{' '}
                    <span className="font-medium">
                      {Math.round(selectedJob.processing_time_ms / 1000)}s
                    </span>
                  </div>
                )}
              </div>

              {/* Prompt */}
              {selectedJob.prompt && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Prompt</p>
                  <p className="text-sm">{selectedJob.prompt}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownload(selectedJob.output_urls![0])}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
                <Button variant="outline" onClick={() => window.open(selectedJob.output_urls![0], '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em Nova Aba
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Gallery Card Component ===
function GalleryCard({ 
  job, 
  onView, 
  onDownload 
}: { 
  job: CreativeJob; 
  onView: () => void; 
  onDownload: (url: string, filename?: string) => void;
}) {
  const isImage = job.type === 'product_image';
  const thumbnailUrl = job.output_urls?.[0];

  return (
    <Card className="group overflow-hidden hover:ring-2 ring-primary/50 transition-all cursor-pointer">
      <div className="relative aspect-square bg-muted" onClick={onView}>
        {thumbnailUrl ? (
          isImage ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="relative w-full h-full">
              <video
                src={thumbnailUrl}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-3 rounded-full bg-white/90">
                  <Play className="h-6 w-6 text-black fill-current" />
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isImage ? (
              <Image className="h-8 w-8 text-muted-foreground/50" />
            ) : (
              <Video className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
        )}

        {/* Type Badge */}
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 text-[10px] py-0 px-1.5 bg-background/80 backdrop-blur-sm"
        >
          {TYPE_LABELS[job.type]}
        </Badge>

        {/* Multiple outputs indicator */}
        {job.output_urls && job.output_urls.length > 1 && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 text-[10px] py-0 px-1.5 bg-background/80 backdrop-blur-sm"
          >
            +{job.output_urls.length - 1}
          </Badge>
        )}

        {/* Hover Actions */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(thumbnailUrl!);
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
          >
            <Expand className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className="p-2">
        <p className="text-xs truncate text-muted-foreground">
          {job.prompt?.slice(0, 40) || job.product_name || 'Sem título'}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </CardContent>
    </Card>
  );
}

// === Gallery List Item Component ===
function GalleryListItem({ 
  job, 
  onView, 
  onDownload 
}: { 
  job: CreativeJob; 
  onView: () => void; 
  onDownload: (url: string, filename?: string) => void;
}) {
  const isImage = job.type === 'product_image';
  const thumbnailUrl = job.output_urls?.[0];

  return (
    <Card className="overflow-hidden hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-4 p-3">
        {/* Thumbnail */}
        <div 
          className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer"
          onClick={onView}
        >
          {thumbnailUrl ? (
            isImage ? (
              <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="relative w-full h-full">
                <video src={thumbnailUrl} className="w-full h-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="h-4 w-4 text-white fill-current" />
                </div>
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isImage ? <Image className="h-6 w-6 text-muted-foreground/50" /> : <Video className="h-6 w-6 text-muted-foreground/50" />}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {job.prompt?.slice(0, 60) || job.product_name || 'Criativo sem título'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] py-0">
              {TYPE_LABELS[job.type]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {job.cost_cents && job.cost_cents > 0 && (
              <span className="text-xs text-muted-foreground">
                • {(job.cost_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView}>
            <Expand className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDownload(thumbnailUrl!)}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(thumbnailUrl!, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em Nova Aba
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onView}>
                <Expand className="h-4 w-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
