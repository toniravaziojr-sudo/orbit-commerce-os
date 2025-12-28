import { useState, useEffect, useRef } from "react";
import { X, Send, Paperclip, Trash2, Loader2, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mailbox } from "@/hooks/useMailboxes";
import { useEmailMessage, useEmailActions } from "@/hooks/useEmailMessages";
import { useEmailAttachmentUpload, PendingAttachment } from "@/hooks/useEmailAttachmentUpload";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface EmailComposerProps {
  mailbox: Mailbox;
  replyToMessageId?: string | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailComposer({ mailbox, replyToMessageId, onClose }: EmailComposerProps) {
  const { currentTenant } = useAuth();
  const { data: replyToMessage } = useEmailMessage(replyToMessageId || null);
  const { sendEmail } = useEmailActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAll,
    getUploadedAttachments,
    hasUploading,
  } = useEmailAttachmentUpload(currentTenant?.id);
  
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);

  // Populate fields when replying
  useEffect(() => {
    if (replyToMessage) {
      setTo(replyToMessage.from_email);
      setSubject(`Re: ${replyToMessage.subject || ''}`);
      setBody(`\n\n---\nEm ${new Date(replyToMessage.received_at || replyToMessage.created_at).toLocaleString('pt-BR')}, ${replyToMessage.from_name || replyToMessage.from_email} escreveu:\n\n${replyToMessage.body_text || ''}`);
    }
  }, [replyToMessage]);

  const parseEmails = (str: string) => {
    return str.split(',').map(e => e.trim()).filter(Boolean).map(email => ({ email }));
  };

  const handleSend = async () => {
    if (!to || hasUploading) return;

    const uploadedAttachments = getUploadedAttachments();

    await sendEmail.mutateAsync({
      mailbox_id: mailbox.id,
      to_emails: parseEmails(to),
      cc_emails: showCc ? parseEmails(cc) : undefined,
      subject,
      body_html: body.replace(/\n/g, '<br>'),
      in_reply_to: replyToMessage?.external_message_id || undefined,
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
    });

    onClose();
  };

  const handleClose = async () => {
    await clearAll();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{replyToMessageId ? 'Responder' : 'Novo Email'}</span>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {/* From */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <div className="text-sm font-medium">
              {mailbox.display_name ? `${mailbox.display_name} <${mailbox.email_address}>` : mailbox.email_address}
            </div>
          </div>

          {/* To */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="to" className="text-xs">Para</Label>
              {!showCc && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              )}
            </div>
            <Input
              id="to"
              placeholder="email@exemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* Cc */}
          {showCc && (
            <div className="space-y-1">
              <Label htmlFor="cc" className="text-xs">Cc</Label>
              <Input
                id="cc"
                placeholder="email@exemplo.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1">
            <Label htmlFor="subject" className="text-xs">Assunto</Label>
            <Input
              id="subject"
              placeholder="Assunto do email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1 flex-1">
            <Label htmlFor="body" className="text-xs">Mensagem</Label>
            <Textarea
              id="body"
              placeholder="Escreva sua mensagem..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[200px] resize-none"
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Anexos</Label>
              <div className="space-y-2">
                {attachments.map(attachment => (
                  <AttachmentItem 
                    key={attachment.id} 
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Signature preview */}
          {mailbox.signature_html && (
            <div className="p-3 border rounded-lg bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-2 block">Assinatura</Label>
              <div 
                className="text-sm prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: mailbox.signature_html }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button 
              variant="outline" 
              size="icon" 
              title="Anexar arquivo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClose}>
              <Trash2 className="h-4 w-4 mr-2" />
              Descartar
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={!to || sendEmail.isPending || hasUploading}
            >
              {hasUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando anexos...
                </>
              ) : sendEmail.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentItem({ 
  attachment, 
  onRemove 
}: { 
  attachment: PendingAttachment; 
  onRemove: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg border",
      attachment.error ? "bg-destructive/10 border-destructive" : "bg-muted/30"
    )}>
      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">{attachment.name}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatFileSize(attachment.size)}
          </span>
        </div>
        {attachment.isUploading && (
          <Progress value={attachment.uploadProgress} className="h-1 mt-1" />
        )}
        {attachment.error && (
          <span className="text-xs text-destructive">{attachment.error}</span>
        )}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        onClick={onRemove}
        disabled={attachment.isUploading}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
