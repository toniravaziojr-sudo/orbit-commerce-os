import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { Send, Square, Paperclip, X, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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

      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      const newFile: AttachedFile = { file, preview, isUploading: true };
      setAttachedFiles(prev => [...prev, newFile]);

      try {
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

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (file: File) => {
    setAttachedFiles(prev => {
      const toRemove = prev.find(f => f.file === file);
      if (toRemove?.preview) URL.revokeObjectURL(toRemove.preview);
      return prev.filter(f => f.file !== file);
    });
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if ((!trimmed && !hasAttachments) || isStreaming || isUploadingAny) return;

    const attachments = attachedFiles
      .filter(f => f.publicUrl)
      .map(f => ({
        url: f.publicUrl!,
        filename: f.file.name,
        mimeType: f.file.type,
      }));

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setMessage("");

    attachedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setAttachedFiles([]);

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
    <div className="relative">
      {/* Attached files preview — above the input card */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachedFiles.map((af, idx) => {
            const FileIcon = getFileIcon(af.file.type);
            return (
              <div
                key={idx}
                className="relative group flex items-center gap-2 px-2.5 py-1.5 bg-muted/40 rounded-lg border border-border/40"
              >
                {af.preview ? (
                  <img src={af.preview} alt={af.file.name} className="h-8 w-8 object-cover rounded" />
                ) : (
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-[11px] max-w-[100px] truncate">{af.file.name}</span>
                {af.isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    onClick={() => removeFile(af.file)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/10 rounded"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ChatGPT-style unified input card */}
      <div className={cn(
        "flex items-end gap-1 rounded-2xl border border-border/60 bg-muted/20 p-1.5",
        "focus-within:border-primary/30 focus-within:bg-background transition-all duration-200",
        "shadow-sm"
      )}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                disabled={isStreaming}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Anexar arquivo</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Envie uma mensagem..."
          className={cn(
            "flex-1 min-h-[36px] max-h-[200px] resize-none bg-transparent text-[13px] leading-relaxed",
            "placeholder:text-muted-foreground/50 focus:outline-none py-2 px-1"
          )}
          rows={1}
          disabled={isStreaming}
        />

        {isStreaming ? (
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="flex-shrink-0 rounded-xl h-8 w-8"
            onClick={handleSend}
            disabled={(!message.trim() && !hasAttachments) || isUploadingAny}
          >
            {isUploadingAny ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
