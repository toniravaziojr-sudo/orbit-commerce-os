import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, X, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { uploadAndRegisterToSystemDrive } from "@/lib/uploadAndRegisterToSystemDrive";
import { toast } from "sonner";

interface AttachedFile {
  file: File;
  preview?: string;
  publicUrl?: string;
  isUploading: boolean;
}

interface CommandChatInputProps {
  onSend: (message: string, attachments?: { url: string; filename: string; mimeType: string }[]) => void;
  isStreaming: boolean;
  onCancel: () => void;
}

const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function CommandChatInput({ onSend, isStreaming, onCancel }: CommandChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, currentTenant } = useAuth();

  const hasAttachments = attachedFiles.length > 0;
  const isUploadingAny = attachedFiles.some(f => f.isUploading);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentTenant?.id || !user?.id) {
      toast.error("Usuário ou tenant não identificado");
      return;
    }

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo ${file.name} excede o limite de 10MB`);
        continue;
      }

      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      // Add to state as uploading
      const newFile: AttachedFile = { file, preview, isUploading: true };
      setAttachedFiles(prev => [...prev, newFile]);

      try {
        // Upload file
        const result = await uploadAndRegisterToSystemDrive({
          tenantId: currentTenant.id,
          userId: user.id,
          file,
          source: "command_assistant",
          subPath: "command-assistant",
        });

        if (result) {
          setAttachedFiles(prev => 
            prev.map(f => 
              f.file === file 
                ? { ...f, publicUrl: result.publicUrl, isUploading: false }
                : f
            )
          );
        } else {
          toast.error(`Erro ao enviar ${file.name}`);
          setAttachedFiles(prev => prev.filter(f => f.file !== file));
        }
      } catch (err) {
        console.error("Upload error:", err);
        toast.error(`Erro ao enviar ${file.name}`);
        setAttachedFiles(prev => prev.filter(f => f.file !== file));
      }
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (file: File) => {
    setAttachedFiles(prev => {
      const toRemove = prev.find(f => f.file === file);
      if (toRemove?.preview) {
        URL.revokeObjectURL(toRemove.preview);
      }
      return prev.filter(f => f.file !== file);
    });
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if ((!trimmed && !hasAttachments) || isStreaming || isUploadingAny) return;
    
    // Prepare attachments
    const attachments = attachedFiles
      .filter(f => f.publicUrl)
      .map(f => ({
        url: f.publicUrl!,
        filename: f.file.name,
        mimeType: f.file.type,
      }));

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setMessage("");
    
    // Clear attachments and revoke previews
    attachedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setAttachedFiles([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return ImageIcon;
    return FileText;
  };

  return (
    <div className="border-t border-border p-4">
      {/* Attached files preview */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachedFiles.map((af, idx) => {
            const FileIcon = getFileIcon(af.file.type);
            return (
              <div 
                key={idx}
                className="relative group flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md border"
              >
                {af.preview ? (
                  <img 
                    src={af.preview} 
                    alt={af.file.name} 
                    className="h-8 w-8 object-cover rounded"
                  />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-xs max-w-[100px] truncate">
                  {af.file.name}
                </span>
                {af.isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    onClick={() => removeFile(af.file)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <TooltipProvider>
          {/* Attachment button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex-shrink-0" 
                disabled={isStreaming}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Anexar arquivo ou imagem</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Message input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Digite sua mensagem... (Enter para enviar)"
            className={cn(
              "min-h-[40px] max-h-[200px] resize-none",
              "bg-muted/50 border-transparent focus:border-border"
            )}
            rows={1}
            disabled={isStreaming}
          />
        </div>

        {/* Send/Cancel button */}
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="flex-shrink-0"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="flex-shrink-0"
            onClick={handleSend}
            disabled={(!message.trim() && !hasAttachments) || isUploadingAny}
          >
            {isUploadingAny ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        O assistente pode executar ações como criar categorias, cupons e tarefas
      </p>
    </div>
  );
}
