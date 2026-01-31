// =============================================
// PRODUCT IMAGE UPLOADER - Works with local state for new products
// Now with "Meu Drive" integration
// =============================================

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Upload, 
  Link as LinkIcon, 
  Trash2, 
  Star, 
  GripVertical,
  Loader2,
  ImagePlus,
  FolderOpen,
} from 'lucide-react';
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface PendingImage {
  id: string;
  type: 'file' | 'url';
  file?: File;
  url: string;
  previewUrl: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

interface ProductImageUploaderProps {
  images: PendingImage[];
  onImagesChange: (images: PendingImage[]) => void;
}

interface SortableImageCardProps {
  image: PendingImage;
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableImageCard({ image, onSetPrimary, onDelete }: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className="relative group overflow-hidden"
    >
      <div className="aspect-square relative">
        {/* Drag handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="absolute top-2 right-2 z-10 cursor-grab bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <img
          src={image.previewUrl}
          alt={image.alt_text || 'Imagem do produto'}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder.svg';
          }}
        />
        
        {/* Primary badge */}
        {image.is_primary && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <Star className="h-3 w-3 fill-current" />
            Principal
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {!image.is_primary && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onSetPrimary(image.id)}
              title="Definir como principal"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onDelete(image.id)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProductImageUploader({ images, onImagesChange }: ProductImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedImages.findIndex((img) => img.id === active.id);
      const newIndex = sortedImages.findIndex((img) => img.id === over.id);
      
      const newOrder = arrayMove(sortedImages, oldIndex, newIndex).map((img, index) => ({
        ...img,
        sort_order: index,
      }));
      
      onImagesChange(newOrder);
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: PendingImage[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Arquivo inválido',
          description: `${file.name} não é uma imagem válida`,
          variant: 'destructive',
        });
        continue;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: `${file.name} excede o limite de 5MB`,
          variant: 'destructive',
        });
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const id = `pending-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      newImages.push({
        id,
        type: 'file',
        file,
        url: '',
        previewUrl,
        alt_text: null,
        is_primary: images.length === 0 && newImages.length === 0,
        sort_order: images.length + newImages.length,
      });
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
      toast({
        title: 'Imagens adicionadas',
        description: `${newImages.length} imagem(ns) adicionada(s)`,
      });
    }

    setIsUploading(false);
    event.target.value = '';
  }, [images, toast, onImagesChange]);

  const handleAddUrl = () => {
    if (!imageUrl.trim()) {
      toast({
        title: 'URL obrigatória',
        description: 'Digite a URL da imagem',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      toast({
        title: 'URL inválida',
        description: 'Digite uma URL válida',
        variant: 'destructive',
      });
      return;
    }

    const id = `pending-url-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newImage: PendingImage = {
      id,
      type: 'url',
      url: imageUrl.trim(),
      previewUrl: imageUrl.trim(),
      alt_text: altText.trim() || null,
      is_primary: images.length === 0,
      sort_order: images.length,
    };

    onImagesChange([...images, newImage]);
    toast({
      title: 'Imagem adicionada',
      description: 'Imagem externa adicionada',
    });

    setImageUrl('');
    setAltText('');
    setUrlDialogOpen(false);
  };

  const handleDriveSelect = (url: string) => {
    const id = `pending-drive-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newImage: PendingImage = {
      id,
      type: 'url',
      url: url,
      previewUrl: url,
      alt_text: null,
      is_primary: images.length === 0,
      sort_order: images.length,
    };

    onImagesChange([...images, newImage]);
    toast({
      title: 'Imagem adicionada',
      description: 'Imagem do Meu Drive adicionada',
    });
    setDrivePickerOpen(false);
  };

  const handleSetPrimary = (imageId: string) => {
    const updated = images.map(img => ({
      ...img,
      is_primary: img.id === imageId,
    }));
    onImagesChange(updated);
  };

  const handleDeleteImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image?.type === 'file' && image.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(image.previewUrl);
    }
    
    const remaining = images.filter(img => img.id !== imageId);
    
    // If we deleted the primary, set first remaining as primary
    if (image?.is_primary && remaining.length > 0) {
      remaining[0].is_primary = true;
    }
    
    onImagesChange(remaining);
    setDeleteImageId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <Button type="button" variant="outline" disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>

        <Button type="button" variant="outline" onClick={() => setDrivePickerOpen(true)}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Meu Drive
        </Button>

        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              <LinkIcon className="h-4 w-4 mr-2" />
              Adicionar URL
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Imagem por URL</DialogTitle>
              <DialogDescription>
                Cole a URL de uma imagem hospedada externamente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL da Imagem *</Label>
                <Input
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="altText">Texto Alternativo</Label>
                <Input
                  id="altText"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Descrição da imagem"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUrlDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleAddUrl}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Images grid */}
      {sortedImages.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Arraste imagens ou clique para fazer upload
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedImages.map(img => img.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedImages.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  onSetPrimary={handleSetPrimary}
                  onDelete={(id) => setDeleteImageId(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteImageId} onOpenChange={() => setDeleteImageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteImageId && handleDeleteImage(deleteImageId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Drive File Picker */}
      <DriveFilePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onSelect={handleDriveSelect}
        accept="image"
        title="Selecionar Imagem do Meu Drive"
      />
    </div>
  );
}
