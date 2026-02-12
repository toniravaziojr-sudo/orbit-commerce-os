import { useState } from "react";
import { Settings, Eye, EyeOff, Bold, Italic, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Mailbox, useMailboxes } from "@/hooks/useMailboxes";

interface MailboxSettingsDialogProps {
  mailbox: Mailbox;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MailboxSettingsDialog({ mailbox, open, onOpenChange }: MailboxSettingsDialogProps) {
  const { updateMailbox } = useMailboxes();
  const [displayName, setDisplayName] = useState(mailbox.display_name || "");
  const [signatureHtml, setSignatureHtml] = useState(mailbox.signature_html || "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(mailbox.auto_reply_enabled);
  const [autoReplyMessage, setAutoReplyMessage] = useState(mailbox.auto_reply_message || "");
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    await updateMailbox.mutateAsync({
      id: mailbox.id,
      display_name: displayName || undefined,
      signature_html: signatureHtml || undefined,
      auto_reply_enabled: autoReplyEnabled,
      auto_reply_message: autoReplyMessage || undefined,
    });
    onOpenChange(false);
  };

  const insertTag = (tag: string) => {
    const textarea = document.getElementById("signature-editor") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = signatureHtml.substring(start, end);
    let insertion = "";

    switch (tag) {
      case "bold":
        insertion = `<strong>${selected || "texto"}</strong>`;
        break;
      case "italic":
        insertion = `<em>${selected || "texto"}</em>`;
        break;
      case "link":
        insertion = `<a href="https://">${selected || "link"}</a>`;
        break;
      case "br":
        insertion = "<br>";
        break;
    }

    const newValue = signatureHtml.substring(0, start) + insertion + signatureHtml.substring(end);
    setSignatureHtml(newValue);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações - {mailbox.email_address}
          </DialogTitle>
          <DialogDescription>
            Configure as opções desta caixa de email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de Exibição</Label>
            <Input
              id="displayName"
              placeholder="Nome que aparece como remetente"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Signature with toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assinatura do Email</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? "Editar" : "Visualizar"}
              </Button>
            </div>

            {showPreview ? (
              <div
                className="min-h-[120px] rounded-md border bg-background p-3 text-sm prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: signatureHtml || '<span class="text-muted-foreground">Sem assinatura configurada</span>'
                }}
              />
            ) : (
              <>
                {/* Mini toolbar */}
                <div className="flex items-center gap-1 rounded-t-md border border-b-0 bg-muted/50 px-2 py-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTag("bold")} title="Negrito">
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTag("italic")} title="Itálico">
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertTag("link")} title="Link">
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertTag("br")}>
                    Quebra de linha
                  </Button>
                </div>
                <Textarea
                  id="signature-editor"
                  placeholder="Atenciosamente,&#10;Equipe da Loja"
                  value={signatureHtml}
                  onChange={(e) => setSignatureHtml(e.target.value)}
                  className="min-h-[120px] rounded-t-none text-sm"
                />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Essa assinatura será adicionada automaticamente aos emails enviados por esta caixa.
            </p>
          </div>

          <Separator />

          {/* Auto Reply */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Resposta Automática</Label>
              <p className="text-sm text-muted-foreground">
                Enviar resposta automática para novos emails
              </p>
            </div>
            <Switch
              checked={autoReplyEnabled}
              onCheckedChange={setAutoReplyEnabled}
            />
          </div>

          {autoReplyEnabled && (
            <div className="space-y-2">
              <Label htmlFor="autoReply">Mensagem de Resposta Automática</Label>
              <Textarea
                id="autoReply"
                placeholder="Obrigado por entrar em contato. Responderemos em breve."
                value={autoReplyMessage}
                onChange={(e) => setAutoReplyMessage(e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMailbox.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
