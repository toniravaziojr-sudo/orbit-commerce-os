// =============================================
// VIDEO CAROUSEL EDITOR - Visual editor for video carousel items
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Youtube, Upload, Play } from 'lucide-react';
import { VideoUploaderWithLibrary } from '../VideoUploaderWithLibrary';
import { ImageUploaderWithLibrary } from '../ImageUploaderWithLibrary';

export interface VideoCarouselItem {
  id?: string;
  url?: string;
  videoDesktop?: string;
  videoMobile?: string;
  title?: string;
  thumbnail?: string;
}

interface VideoCarouselEditorProps {
  items: VideoCarouselItem[];
  onChange: (items: VideoCarouselItem[]) => void;
}

// Extract YouTube ID from URL
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Check if URL is YouTube or Vimeo
function isEmbedUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
}

// Get thumbnail URL for YouTube
function getYouTubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export function VideoCarouselEditor({ items = [], onChange }: VideoCarouselEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const addItem = () => {
    const newIndex = safeItems.length;
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      url: '',
      videoDesktop: '',
      videoMobile: '',
      title: '',
      thumbnail: '',
    }]);
    setExpandedItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const updateItem = (index: number, field: keyof VideoCarouselItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
    const newExpanded = { ...expandedItems };
    delete newExpanded[index];
    setExpandedItems(newExpanded);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeItems.length - 1) return;
    
    const newItems = [...safeItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getItemPreview = (item: VideoCarouselItem): string => {
    if (item.url) {
      if (item.url.includes('youtube')) return 'YouTube';
      if (item.url.includes('vimeo')) return 'Vimeo';
      return 'Link';
    }
    if (item.videoDesktop) return 'Upload';
    return 'Sem vídeo';
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const isExpanded = expandedItems[index];
        const hasYouTube = item.url && isEmbedUrl(item.url);
        const hasUpload = item.videoDesktop || item.videoMobile;
        const thumbnail = item.thumbnail || (item.url ? getYouTubeThumbnail(item.url) : null);

        return (
          <Card key={item.id || index} className="overflow-hidden">
            {/* Header */}
            <div 
              className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(index)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                {thumbnail ? (
                  <img src={thumbnail} alt="" className="w-10 h-6 object-cover rounded" />
                ) : (
                  <div className="w-10 h-6 bg-muted rounded flex items-center justify-center">
                    <Play className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium">#{index + 1}</span>
                <span className="text-xs text-muted-foreground">• {getItemPreview(item)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                  disabled={index === safeItems.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-3 space-y-4 border-t">
                <Tabs defaultValue={hasUpload ? 'upload' : 'youtube'} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="youtube" className="text-xs gap-1">
                      <Youtube className="h-3 w-3" />
                      YouTube/Vimeo
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="text-xs gap-1">
                      <Upload className="h-3 w-3" />
                      Upload
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="youtube" className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">URL do Vídeo</Label>
                      <Input
                        value={item.url || ''}
                        onChange={(e) => updateItem(index, 'url', e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Cole a URL do YouTube ou Vimeo</p>
                    </div>
                    {item.url && getYouTubeThumbnail(item.url) && (
                      <div className="relative rounded overflow-hidden">
                        <img 
                          src={getYouTubeThumbnail(item.url) || ''} 
                          alt="Preview" 
                          className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="upload" className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vídeo Desktop</Label>
                      <VideoUploaderWithLibrary
                        value={item.videoDesktop || ''}
                        onChange={(url) => updateItem(index, 'videoDesktop', url)}
                        placeholder="Vídeo para Desktop"
                        variant="desktop"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vídeo Mobile (opcional)</Label>
                      <VideoUploaderWithLibrary
                        value={item.videoMobile || ''}
                        onChange={(url) => updateItem(index, 'videoMobile', url)}
                        placeholder="Vídeo para Mobile"
                        variant="mobile"
                      />
                      <p className="text-xs text-muted-foreground">Se vazio, usa o vídeo Desktop</p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Optional fields */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título (opcional)</Label>
                    <Input
                      value={item.title || ''}
                      onChange={(e) => updateItem(index, 'title', e.target.value)}
                      placeholder="Nome do vídeo"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Thumbnail personalizado (opcional)</Label>
                    <ImageUploaderWithLibrary
                      value={item.thumbnail || ''}
                      onChange={(url) => updateItem(index, 'thumbnail', url)}
                      placeholder="Imagem de capa"
                      variant="desktop"
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar vídeo
      </Button>
    </div>
  );
}
