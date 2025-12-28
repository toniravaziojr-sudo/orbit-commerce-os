import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Copy,
  ExternalLink,
  Settings
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mailbox, useMailboxes } from "@/hooks/useMailboxes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MailboxSettingsDialogProps {
  mailbox: Mailbox;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MailboxSettingsDialog({ mailbox, open, onOpenChange }: MailboxSettingsDialogProps) {
  const { updateMailbox } = useMailboxes();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  const [displayName, setDisplayName] = useState(mailbox.display_name || "");
  const [signatureHtml, setSignatureHtml] = useState(mailbox.signature_html || "");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(mailbox.auto_reply_enabled);
  const [autoReplyMessage, setAutoReplyMessage] = useState(mailbox.auto_reply_message || "");
  const [isVerifyingDns, setIsVerifyingDns] = useState(false);
  const [isSettingUpInbound, setIsSettingUpInbound] = useState(false);
  const [inboundStatus, setInboundStatus] = useState<'unknown' | 'configured' | 'not_configured'>('unknown');

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

  const handleVerifyDns = async () => {
    setIsVerifyingDns(true);
    try {
      // Call edge function to verify DNS for this mailbox
      const { data, error } = await supabase.functions.invoke('mailbox-dns-verify', {
        body: { mailbox_id: mailbox.id },
      });

      if (error) throw error;

      // Invalidate mailboxes query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

      if (data.verified) {
        toast.success('DNS verificado com sucesso! Mailbox ativo.');
      } else {
        toast.error('DNS ainda não configurado corretamente. Verifique os registros.');
      }
    } catch (error) {
      console.error('DNS verification error:', error);
      toast.error('Erro ao verificar DNS');
    } finally {
      setIsVerifyingDns(false);
    }
  };

  const handleCheckInboundSetup = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sendgrid-inbound-setup', {
        body: {
          action: 'check',
          hostname: mailbox.domain, // Use root domain directly
          tenant_id: mailbox.tenant_id,
        },
      });

      if (error) throw error;
      setInboundStatus(data.configured ? 'configured' : 'not_configured');
    } catch (error) {
      console.error('Check inbound error:', error);
    }
  };

  const handleSetupInbound = async () => {
    setIsSettingUpInbound(true);
    try {
      const { data, error } = await supabase.functions.invoke('sendgrid-inbound-setup', {
        body: {
          action: 'setup',
          hostname: mailbox.domain, // Use root domain directly
          tenant_id: mailbox.tenant_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Recebimento de emails configurado');
        setInboundStatus('configured');
      }
    } catch (error) {
      console.error('Setup inbound error:', error);
      toast.error('Erro ao configurar recebimento');
    } finally {
      setIsSettingUpInbound(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações - {mailbox.email_address}
          </DialogTitle>
          <DialogDescription>
            Configure as opções desta caixa de email
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
            <TabsTrigger value="inbound">Recebimento</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome de Exibição</Label>
              <Input
                id="displayName"
                placeholder="Nome que aparece como remetente"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature">Assinatura (HTML)</Label>
              <Textarea
                id="signature"
                placeholder="<p>Atenciosamente,<br>Sua Equipe</p>"
                value={signatureHtml}
                onChange={(e) => setSignatureHtml(e.target.value)}
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <Separator />

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

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateMailbox.isPending}>
                Salvar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="dns" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Status do DNS</h4>
                <p className="text-sm text-muted-foreground">
                  Domínio: {mailbox.domain}
                </p>
              </div>
              <Badge variant={mailbox.dns_verified ? "default" : "secondary"}>
                {mailbox.dns_verified ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Verificado</>
                ) : (
                  <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>
                )}
              </Badge>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <h5 className="font-medium text-sm">Registros DNS Necessários</h5>
              
              <div className="space-y-3">
                <DnsRecordRow
                  type="MX"
                  name={`@ (${mailbox.domain})`}
                  value="mx.sendgrid.net"
                  priority="10"
                  onCopy={() => copyToClipboard('mx.sendgrid.net')}
                />
                
                <DnsRecordRow
                  type="TXT"
                  name={mailbox.domain}
                  value="v=spf1 include:sendgrid.net ~all"
                  onCopy={() => copyToClipboard('v=spf1 include:sendgrid.net ~all')}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Configure estes registros no seu provedor de DNS (Cloudflare, Route53, etc.)
                com a opção "Somente DNS" (sem proxy).
              </p>
            </div>

            <Button 
              onClick={handleVerifyDns} 
              disabled={isVerifyingDns}
              className="w-full"
            >
              {isVerifyingDns ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Verificar DNS</>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="inbound" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Recebimento de Emails</h4>
                <p className="text-sm text-muted-foreground">
                  Configuração do SendGrid Inbound Parse
                </p>
              </div>
              <Badge 
                variant={inboundStatus === 'configured' ? "default" : "secondary"}
                onClick={handleCheckInboundSetup}
                className="cursor-pointer"
              >
                {inboundStatus === 'configured' ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Configurado</>
                ) : inboundStatus === 'not_configured' ? (
                  <><AlertCircle className="h-3 w-3 mr-1" /> Não Configurado</>
                ) : (
                  'Verificar'
                )}
              </Badge>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h5 className="font-medium text-sm">Endereço de Recebimento</h5>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm">
                  *@{mailbox.domain}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(`*@${mailbox.domain}`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Emails enviados para qualquer endereço @{mailbox.domain} serão recebidos nesta caixa.
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h5 className="font-medium text-sm">Pré-requisitos</h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  {mailbox.dns_verified ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  DNS configurado e verificado
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Registro MX apontando para mx.sendgrid.net
                </li>
              </ul>
            </div>

            <Button 
              onClick={handleSetupInbound} 
              disabled={isSettingUpInbound || !mailbox.dns_verified}
              className="w-full"
            >
              {isSettingUpInbound ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configurando...</>
              ) : (
                <><ExternalLink className="h-4 w-4 mr-2" /> Configurar Recebimento</>
              )}
            </Button>

            {!mailbox.dns_verified && (
              <p className="text-sm text-yellow-600 text-center">
                Configure e verifique o DNS primeiro na aba "DNS"
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DnsRecordRow({ 
  type, 
  name, 
  value, 
  priority,
  onCopy 
}: { 
  type: string; 
  name: string; 
  value: string; 
  priority?: string;
  onCopy: () => void;
}) {
  return (
    <div className="grid grid-cols-[60px_1fr_auto] gap-2 items-center text-sm">
      <Badge variant="outline" className="justify-center">
        {type}
      </Badge>
      <div className="min-w-0">
        <div className="text-muted-foreground truncate">{name}</div>
        <div className="font-mono truncate">
          {priority && <span className="text-muted-foreground mr-1">[{priority}]</span>}
          {value}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
