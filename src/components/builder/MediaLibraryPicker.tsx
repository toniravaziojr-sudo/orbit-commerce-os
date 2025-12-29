// =============================================
// MEDIA LIBRARY PICKER - Select from uploaded images (only images, not videos)
// =============================================

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMediaLibrary, MediaVariant } from '@/hooks/useMediaLibrary';
import { Image, Search, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: MediaVariant;
  onSelect: (url: string) => void;
}

export function MediaLibraryPicker({
  open,
  onOpenChange,
  variant,
  onSelect,
}: MediaLibraryPickerProps) {
  // Only fetch images, not videos
  const { mediaItems, isLoading } = useMediaLibrary({ variant, mediaType: 'image' });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filteredItems = mediaItems.filter(item =>
    item.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
      setSelected(null);
      setSearch('');
    }
  };

  const variantLabel = variant === 'desktop' ? 'Desktop' : 'Mobile';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Banco de Imagens - {variantLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Gallery */}
          <ScrollArea className="h-[400px] rounded-md border p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Image className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">
                  {search
                    ? 'Nenhuma imagem encontrada'
                    : `Nenhuma imagem ${variantLabel} enviada ainda`}
                </p>
                <p className="text-xs mt-1">
                  Faça upload de imagens para vê-las aqui
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item.file_url)}
                    className={cn(
                      'relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:opacity-90',
                      selected === item.file_url
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                  >
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selected === item.file_url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary rounded-full p-1">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <p className="text-[10px] text-white truncate">
                        {item.file_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSelect} disabled={!selected}>
              Selecionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
