import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, X, Loader2, Image as ImageIcon, FileText, Mic, StopCircle, Square, MessageSquare, Brain, Search } from "lucide-react";
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

export type ChatMode = "chat" | "thinking" | "search";

export interface ChatGPTAttachment {
  url: string;
  filename: string;
  mimeType: string;
}

interface AttachedFile {
  file: File;
  preview?: string;
  publicUrl?: string;
  isUploading: boolean;
}

interface ChatGPTChatInputProps {
  onSend: (message: string, attachments?: ChatGPTAttachment[], mode?: ChatMode) => void;
  isStreaming: boolean;
  onCancel: () => void;
  disabled?: boolean;
}

const MODE_CONFIG = {
  chat: {
    icon: MessageSquare,
    label: "Chat",
    description: "Conversa padrão com GPT-5",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20",
    activeColor: "bg-blue-500 text-white border-blue-500",
  },
  thinking: {
    icon: Brain,
    label: "Thinking",
    description: "Raciocínio avançado com o3-mini",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20",
    activeColor: "bg-purple-500 text-white border-purple-500",
  },
  search: {
    icon: Search,
    label: "Busca",
    description: "Pesquisa na internet em tempo real",
    color: "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20",
    activeColor: "bg-green-500 text-white border-green-500",
  },
} as const;

const ACCEPTED_FILE_TYPES = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
const ACCEPTED_AUDIO_TYPE = "audio/webm";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ChatGPTChatInput({ onSend, isStreaming, onCancel, disabled }: ChatGPTChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedMode, setSelectedMode] = useState<ChatMode>("chat");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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
        const result = await uploadAndRegisterToSystemDrive({
          tenantId: currentTenant.id,
          userId: user.id,
          file,
          source: "chatgpt",
          subPath: "chatgpt",
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
      if (toRemove?.preview) {
        URL.revokeObjectURL(toRemove.preview);
      }
      return prev.filter(f => f.file !== file);
    });
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: ACCEPTED_AUDIO_TYPE });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: ACCEPTED_AUDIO_TYPE });
        stream.getTracks().forEach(track => track.stop());
        
        // Upload audio
        if (currentTenant?.id && user?.id) {
          const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: ACCEPTED_AUDIO_TYPE });
          
          const newFile: AttachedFile = { 
            file: audioFile, 
            isUploading: true 
          };
          setAttachedFiles(prev => [...prev, newFile]);
          
          try {
            const result = await uploadAndRegisterToSystemDrive({
              tenantId: currentTenant.id,
              userId: user.id,
              file: audioFile,
              source: "chatgpt_audio",
              subPath: "chatgpt/audio",
            });

            if (result) {
              setAttachedFiles(prev =>
                prev.map(f =>
                  f.file === audioFile
                    ? { ...f, publicUrl: result.publicUrl, isUploading: false }
                    : f
                )
              );
              toast.success("Áudio gravado com sucesso!");
            } else {
              toast.error("Erro ao enviar áudio");
              setAttachedFiles(prev => prev.filter(f => f.file !== audioFile));
            }
          } catch (err) {
            console.error("Audio upload error:", err);
            toast.error("Erro ao enviar áudio");
            setAttachedFiles(prev => prev.filter(f => f.file !== audioFile));
          }
        }
        
        setRecordingDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      toast.success("Gravando áudio...");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    onSend(trimmed, attachments.length > 0 ? attachments : undefined, selectedMode);
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
    if (mimeType.startsWith("audio/")) return Mic;
    return FileText;
  };

  return (
    <div className="border-t p-4 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* Mode selector chips */}
        <div className="flex items-center gap-2 mb-3">
          <TooltipProvider>
            {(Object.keys(MODE_CONFIG) as ChatMode[]).map((mode) => {
              const config = MODE_CONFIG[mode];
              const Icon = config.icon;
              const isActive = selectedMode === mode;
              
              return (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedMode(mode)}
                      disabled={isStreaming || isRecording}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                        isActive ? config.activeColor : config.color,
                        (isStreaming || isRecording) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{config.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{config.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>

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

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-500 font-medium">
              Gravando... {formatDuration(recordingDuration)}
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={stopRecording}
              className="ml-auto h-7"
            >
              <Square className="h-3 w-3 mr-1" />
              Parar
            </Button>
          </div>
        )}

        <div className={cn(
          "relative flex items-end gap-1 rounded-2xl border border-border/60 bg-muted/20 p-1.5",
          "focus-within:border-primary/30 focus-within:bg-background transition-all duration-200",
          "shadow-sm"
        )}>
          <TooltipProvider>
            {/* Attachment button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  disabled={isStreaming || isRecording}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Anexar arquivo ou imagem</p>
              </TooltipContent>
            </Tooltip>

            {/* Microphone button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className="flex-shrink-0 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  disabled={isStreaming || disabled}
                  onClick={handleMicClick}
                >
                  {isRecording ? (
                    <StopCircle className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording ? "Parar gravação" : "Gravar áudio"}</p>
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
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Pergunte alguma coisa..."
            className={cn(
              "flex-1 min-h-[36px] max-h-[200px] resize-none bg-transparent text-[13px] leading-relaxed",
              "placeholder:text-muted-foreground/50 focus:outline-none py-2 px-1"
            )}
            rows={1}
            disabled={isStreaming || isRecording}
          />

          {/* Send/Cancel button */}
          {isStreaming ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onCancel}
              className="h-8 w-8 flex-shrink-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!message.trim() && !hasAttachments) || isUploadingAny || isRecording}
              className="h-8 w-8 flex-shrink-0 rounded-xl"
            >
              {isUploadingAny ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
          ChatGPT pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
