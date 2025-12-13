import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';

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

interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
}

interface ProductImageManagerProps {
  productId: string;
  images: ProductImage[];
  onImagesChange: () => void;
}

interface SortableImageCardProps {
  image: ProductImage;
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
          src={image.url}
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
              size="sm"
              variant="secondary"
              onClick={() => onSetPrimary(image.id)}
              title="Definir como principal"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
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

export function ProductImageManager({ productId, images, onImagesChange }: ProductImageManagerProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
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

  const sortedImages = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedImages.findIndex((img) => img.id === active.id);
      const newIndex = sortedImages.findIndex((img) => img.id === over.id);
      
      const newOrder = arrayMove(sortedImages, oldIndex, newIndex);
      
      // Update sort_order in database
      try {
        const updates = newOrder.map((img, index) => ({
          id: img.id,
          sort_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from('product_images')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id);
        }

        toast({
          title: 'Ordem atualizada',
          description: 'A ordem das imagens foi salva',
        });
        onImagesChange();
      } catch (error) {
        console.error('Error updating sort order:', error);
        toast({
          title: 'Erro',
          description: 'Falha ao atualizar a ordem das imagens',
          variant: 'destructive',
        });
      }
    }
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedImages: string[] = [];

    try {
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

        const fileExt = file.name.split('.').pop();
        const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: 'Erro no upload',
            description: uploadError.message,
            variant: 'destructive',
          });
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        uploadedImages.push(publicUrl);
      }

      // Insert image records
      if (uploadedImages.length > 0) {
        const maxSortOrder = Math.max(...images.map(img => img.sort_order ?? 0), -1);
        const newImages = uploadedImages.map((url, index) => ({
          product_id: productId,
          url,
          alt_text: null,
          is_primary: images.length === 0 && index === 0,
          sort_order: maxSortOrder + index + 1,
        }));

        const { error: insertError } = await supabase
          .from('product_images')
          .insert(newImages);

        if (insertError) {
          toast({
            title: 'Erro ao salvar imagens',
            description: insertError.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Imagens adicionadas',
            description: `${uploadedImages.length} imagem(ns) adicionada(s) com sucesso`,
          });
          onImagesChange();
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao fazer upload das imagens',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  }, [productId, images, toast, onImagesChange]);

  const handleAddUrl = async () => {
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

    setIsAddingUrl(true);
    try {
      const maxSortOrder = Math.max(...images.map(img => img.sort_order ?? 0), -1);

      const { error } = await supabase
        .from('product_images')
        .insert({
          product_id: productId,
          url: imageUrl.trim(),
          alt_text: altText.trim() || null,
          is_primary: images.length === 0,
          sort_order: maxSortOrder + 1,
        });

      if (error) {
        toast({
          title: 'Erro ao adicionar imagem',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Imagem adicionada',
          description: 'Imagem externa adicionada com sucesso',
        });
        setImageUrl('');
        setAltText('');
        setUrlDialogOpen(false);
        onImagesChange();
      }
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      // Remove primary from all images
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);

      // Set new primary
      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) {
        toast({
          title: 'Erro',
          description: 'Falha ao definir imagem principal',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Imagem principal atualizada',
        });
        onImagesChange();
      }
    } catch (error) {
      console.error('Error setting primary:', error);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const image = images.find(img => img.id === imageId);
      
      // Delete from database
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        toast({
          title: 'Erro ao excluir',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // If it was uploaded to storage, try to delete the file
      if (image?.url.includes('product-images')) {
        const path = image.url.split('/product-images/')[1];
        if (path) {
          await supabase.storage
            .from('product-images')
            .remove([path]);
        }
      }

      toast({
        title: 'Imagem excluída',
      });
      onImagesChange();
    } catch (error) {
      console.error('Error deleting image:', error);
    } finally {
      setDeleteImageId(null);
    }
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
          <Button variant="outline" disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload de Imagens
          </Button>
        </div>

        <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
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
              <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddUrl} disabled={isAddingUrl}>
                {isAddingUrl && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sortedImages.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Arraste as imagens para reordená-las
        </p>
      )}

      {sortedImages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <ImagePlus className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma imagem adicionada
            </p>
            <p className="text-sm text-muted-foreground">
              Faça upload ou adicione URLs de imagens
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedImages.map(img => img.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sortedImages.map((image) => (
                <SortableImageCard
                  key={image.id}
                  image={image}
                  onSetPrimary={handleSetPrimary}
                  onDelete={setDeleteImageId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={!!deleteImageId} onOpenChange={() => setDeleteImageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A imagem será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteImageId && handleDeleteImage(deleteImageId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
