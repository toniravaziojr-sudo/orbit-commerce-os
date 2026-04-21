import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { usePlatformPartnerBusinessId, useOpenWhatsAppValidationWindow } from "@/hooks/useWhatsAppValidation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wizard cross-business: instrui o tenant a adicionar o nosso Business como
 * parceiro na WABA dele dentro do painel da Meta. Não automatiza esse passo:
 * a Meta não expõe API pública para um terceiro se autoadicionar a um portfólio.
 */
export function CrossBusinessAuthorizationWizard({ open, onOpenChange }: Props) {
  const { data: partnerBusinessId } = usePlatformPartnerBusinessId();
  const openWindow = useOpenWhatsAppValidationWindow();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    if (!partnerBusinessId) return;
    await navigator.clipboard.writeText(partnerBusinessId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Business ID copiado");
  };

  const handleValidateNow = () => {
    openWindow.mutate(undefined, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Autorizar recepção real do WhatsApp</DialogTitle>
          <DialogDescription>
            Para receber mensagens de verdade, sua conta do WhatsApp Business (WABA) precisa
            autorizar o nosso aplicativo como parceiro. Esse passo é obrigatório da Meta e só
            pode ser feito por você, dentro do painel oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Por que é manual?</strong> A Meta não permite que um aplicativo de terceiros
              se autoadicione como parceiro de uma WABA — isso é uma regra de segurança da
              plataforma. Nós já fizemos tudo o que é possível do nosso lado.
            </AlertDescription>
          </Alert>

          {!partnerBusinessId ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                O Business ID da plataforma ainda não foi configurado pelo administrador. Entre em
                contato com o suporte para concluir esta etapa.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border bg-muted/40 p-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Nosso Business ID (você vai copiar este número no passo 3)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
                  {partnerBusinessId}
                </code>
                <Button size="sm" variant="outline" onClick={copyId}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1.5">{copied ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
            </div>
          )}

          <ol className="space-y-3">
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">1</Badge>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Abra o Business Manager da Meta</p>
                <p className="text-xs text-muted-foreground">
                  Acesse <a className="underline" href="https://business.facebook.com/" target="_blank" rel="noreferrer">business.facebook.com</a> com a conta que controla a WABA do seu WhatsApp.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">2</Badge>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Vá em Configurações &gt; Contas &gt; Contas do WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Selecione a WABA do número que você conectou aqui.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">3</Badge>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Adicione um parceiro &gt; Empresas parceiras</p>
                <p className="text-xs text-muted-foreground">
                  Cole o Business ID acima e atribua permissão para gerenciar mensagens. Esse é o
                  passo que a Meta exige e não pode ser feito do nosso lado.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="h-6 w-6 shrink-0 rounded-full p-0 flex items-center justify-center">4</Badge>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Volte aqui, clique em "Já fiz, validar agora" e envie uma mensagem real</p>
                <p className="text-xs text-muted-foreground">
                  O sistema abre uma janela de 10 minutos. Envie uma mensagem de qualquer celular
                  ao seu número conectado. Quando chegar, o canal é marcado como "Recebendo normalmente".
                </p>
              </div>
            </li>
          </ol>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Se a mensagem não chegar em 10 minutos, isso é uma <strong>hipótese principal</strong>{" "}
              de autorização ainda pendente, não uma confirmação. Você pode tentar de novo ou pedir
              suporte.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href="https://business.facebook.com/" target="_blank" rel="noreferrer">
              Abrir Business Manager <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
          <Button onClick={handleValidateNow} disabled={openWindow.isPending}>
            Já fiz, validar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
