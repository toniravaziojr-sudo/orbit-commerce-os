import { useState, useEffect } from "react";
import { X, Send, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mailbox } from "@/hooks/useMailboxes";
import { useEmailMessage, useEmailActions } from "@/hooks/useEmailMessages";

interface EmailComposerProps {
  mailbox: Mailbox;
  replyToMessageId?: string | null;
  onClose: () => void;
}

export function EmailComposer({ mailbox, replyToMessageId, onClose }: EmailComposerProps) {
  const { data: replyToMessage } = useEmailMessage(replyToMessageId || null);
  const { sendEmail } = useEmailActions();
  
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
    if (!to) return;

    await sendEmail.mutateAsync({
      mailbox_id: mailbox.id,
      to_emails: parseEmails(to),
      cc_emails: showCc ? parseEmails(cc) : undefined,
      subject,
      body_html: body.replace(/\n/g, '<br>'),
      in_reply_to: replyToMessage?.external_message_id || undefined,
    });

    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{replyToMessageId ? 'Responder' : 'Novo Email'}</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
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
            <Button variant="outline" size="icon" title="Anexar arquivo">
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              <Trash2 className="h-4 w-4 mr-2" />
              Descartar
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={!to || sendEmail.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendEmail.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
