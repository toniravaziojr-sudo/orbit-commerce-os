// =============================================
// LANDING PAGE CHAT INPUT - With media upload support
// Input component for AI editor with image/video attachments
// =============================================

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';
import { useSystemUpload } from '@/hooks/useSystemUpload';
import { cn } from '@/lib/utils';
import {
  Send,
  Loader2,
  Paperclip,
  Upload,
  FolderOpen,
  Link,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react';

export interface ChatAttachment {
  type: 'image' | 'video';
  url: string;
  name?: string;
}

interface LandingPageChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function LandingPageChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Descreva o ajuste que deseja fazer...',
}: LandingPageChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, isUploading } = useSystemUpload({
    source: 'landing_page_chat',
    subPath: 'chat-attachments',
  });

  const handleSubmit = () => {
    if (!message.trim() && attachments.length === 0) return;
    onSend(message.trim(), attachments);
    setMessage('');
    setAttachments([]);
  };

  const handleFileSelect = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      return; // Only accept images and videos
    }

    try {
      const result = await upload(file);
      if (result) {
        setAttachments(prev => [...prev, {
          type: isImage ? 'image' : 'video',
          url: result.publicUrl,
          name: file.name,
        }]);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
    setAttachPopoverOpen(false);
  };

  const handleDriveSelect = (url: string) => {
    // Detect type from URL extension
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(url);
    setAttachments(prev => [...prev, {
      type: isVideo ? 'video' : 'image',
      url,
      name: url.split('/').pop(),
    }]);
    setShowDrivePicker(false);
    setAttachPopoverOpen(false);
  };

  const handleUrlAdd = () => {
    if (!urlInput.trim()) return;
    const isVideo = /\.(mp4|webm|mov|avi)$/i.test(urlInput);
    setAttachments(prev => [...prev, {
      type: isVideo ? 'video' : 'image',
      url: urlInput.trim(),
      name: urlInput.split('/').pop(),
    }]);
    setUrlInput('');
    setShowUrlInput(false);
    setAttachPopoverOpen(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t p-4 space-y-3">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted"
            >
              {attachment.type === 'image' ? (
                <img
                  src={attachment.url}
                  alt={attachment.name || 'Anexo'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => removeAttachment(index)}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end">
        <Popover open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={isLoading || isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setShowDrivePicker(true);
                  setAttachPopoverOpen(false);
                }}
              >
                <FolderOpen className="h-4 w-4" />
                Meu Drive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setShowUrlInput(true);
                  setAttachPopoverOpen(false);
                }}
              >
                <Link className="h-4 w-4" />
                URL Externa
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = '';
          }}
        />

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              handleSubmit();
            }
          }}
        />
      </div>

      {/* URL input modal inline */}
      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemplo.com/imagem.jpg"
            className="flex-1 h-9 rounded-md border bg-transparent px-3 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleUrlAdd} disabled={!urlInput.trim()}>
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowUrlInput(false)}>
            Cancelar
          </Button>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={(!message.trim() && attachments.length === 0) || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Aplicar Ajuste
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        ⌘ + Enter para enviar
      </p>

      {/* Drive Picker Modal */}
      <DriveFilePicker
        open={showDrivePicker}
        onOpenChange={setShowDrivePicker}
        onSelect={handleDriveSelect}
        accept="all"
        title="Selecionar Mídia"
      />
    </div>
  );
}
