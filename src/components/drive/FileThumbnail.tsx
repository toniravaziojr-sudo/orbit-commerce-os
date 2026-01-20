import { useState, useEffect } from 'react';
import { FileItem } from '@/hooks/useFiles';
import { cn } from '@/lib/utils';
import { Folder, FileText, FileVideo, FileAudio, File, Image as ImageIcon } from 'lucide-react';

interface FileThumbnailProps {
  file: FileItem;
  getFileUrl: (file: FileItem) => Promise<string | null>;
  className?: string;
  iconClassName?: string;
}

function getFileIconComponent(file: FileItem) {
  if (file.is_folder) return Folder;
  const mime = file.mime_type || '';
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return FileText;
  return File;
}

export function FileThumbnail({ file, getFileUrl, className, iconClassName }: FileThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isImage = file.mime_type?.startsWith('image/') && !file.is_folder;

  useEffect(() => {
    if (!isImage) return;
    
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    getFileUrl(file).then((url) => {
      if (!cancelled && url) {
        setThumbnailUrl(url);
      }
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setHasError(true);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [file.id, isImage, getFileUrl]);

  // For images with successful URL, show thumbnail
  if (isImage && thumbnailUrl && !hasError) {
    return (
      <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
        <img
          src={thumbnailUrl}
          alt={file.original_name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // Fallback to icon
  const Icon = getFileIconComponent(file);
  return (
    <Icon className={cn(
      iconClassName,
      file.is_folder ? "text-amber-500" : "text-muted-foreground"
    )} />
  );
}
