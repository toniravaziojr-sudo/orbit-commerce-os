import { useState } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MailboxSettingsDialog } from "./MailboxSettingsDialog";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Mail, 
  Inbox,
  Settings,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  Zap,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMailboxes, EmailPurpose, MailboxStatus } from "@/hooks/useMailboxes";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface MailboxListProps {
  onOpenInbox: (mailboxId: string) => void;
}

const purposeConfig: Record<EmailPurpose, { label: string; icon: typeof Mail; color: string }> = {
  notifications: { label: 'Notificações', icon: Mail, color: 'bg-blue-100 text-blue-800' },
  support: { label: 'Atendimento', icon: Mail, color: 'bg-green-100 text-green-800' },
  manual: { label: 'Caixa de Email', icon: Inbox, color: 'bg-gray-100 text-gray-800' },
};

const statusConfig: Record<MailboxStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: 'Ativo', icon: CheckCircle, color: 'text-green-600' },
  pending_dns: { label: 'Aguardando DNS', icon: Clock, color: 'text-yellow-600' },
  error: { label: 'Erro', icon: AlertCircle, color: 'text-red-600' },
  disabled: { label: 'Desativado', icon: AlertCircle, color: 'text-gray-400' },
};

export function MailboxList({ onOpenInbox }: MailboxListProps) {
  const { mailboxes, isLoading, createMailbox, updateMailbox, deleteMailbox } = useMailboxes();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [settingsMailbox, setSettingsMailbox] = useState<typeof mailboxes[0] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPurpose, setNewPurpose] = useState<EmailPurpose>("manual");

  const handleCreate = async () => {
    if (!newEmail) return;

    await createMailbox.mutateAsync({
      email_address: newEmail,
      display_name: newDisplayName || undefined,
      purpose: newPurpose,
    });

    setIsAddDialogOpen(false);
    setNewEmail("");
    setNewDisplayName("");
    setNewPurpose("manual");
  };

  const { confirm: confirmAction, ConfirmDialog: MailboxConfirmDialog } = useConfirmDialog();

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: "Excluir caixa de email",
      description: "Tem certeza que deseja excluir esta caixa de email? Todos os dados relacionados serão perdidos.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteMailbox.mutateAsync(id);
  };

  const handleActivate = async (mailbox: typeof mailboxes[0]) => {
    setActivatingId(mailbox.id);
    try {
      const { data, error } = await supabase.functions.invoke('mailbox-dns-verify', {
        body: { mailbox_id: mailbox.id },
      });

      if (error) throw error;

      if (data?.verified) {
        toast.success('Email ativado com sucesso!');
      } else {
        toast.error('Domínio ainda não verificado. Configure o DNS em Integrações → Emails primeiro.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ativar email. Verifique a configuração do domínio em Integrações.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleChangePurpose = async (id: string, purpose: EmailPurpose) => {
    // If setting as notifications or support, clear any other mailbox with that purpose
    if (purpose === 'notifications' || purpose === 'support') {
      const existing = mailboxes.find(m => m.purpose === purpose && m.id !== id);
      if (existing) {
        await updateMailbox.mutateAsync({ id: existing.id, purpose: 'manual' });
      }
    }
    await updateMailbox.mutateAsync({ id, purpose });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (mailboxes.length === 0) {
    return (
      <>
        <EmptyState
          icon={Mail}
          title="Nenhuma caixa de email"
          description="Configure sua primeira caixa de email para começar a receber e enviar mensagens"
          action={{
            label: "Adicionar Email",
            onClick: () => setIsAddDialogOpen(true)
          }}
        />
        <AddMailboxDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          email={newEmail}
          displayName={newDisplayName}
          onEmailChange={setNewEmail}
          onDisplayNameChange={setNewDisplayName}
          onSubmit={handleCreate}
          isLoading={createMailbox.isPending}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Email
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mailboxes.map(mailbox => {
          const purpose = purposeConfig[mailbox.purpose];
          const status = statusConfig[mailbox.status];
          const PurposeIcon = purpose.icon;
          const StatusIcon = status.icon;

          return (
            <Card key={mailbox.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {mailbox.display_name || mailbox.email_address.split('@')[0]}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {mailbox.email_address}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenInbox(mailbox.id)}>
                        <Inbox className="h-4 w-4 mr-2" />
                        Abrir Inbox
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSettingsMailbox(mailbox)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(mailbox.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </div>
                  {mailbox.status === 'pending_dns' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={activatingId === mailbox.id}
                      onClick={() => handleActivate(mailbox)}
                    >
                      {activatingId === mailbox.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1" />
                      )}
                      Ativar Email
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{mailbox.unread_count} não lidos</span>
                  <span>{mailbox.total_messages} total</span>
                </div>

                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={() => onOpenInbox(mailbox.id)}
                >
                  <Inbox className="h-4 w-4 mr-2" />
                  Abrir Inbox
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddMailboxDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        email={newEmail}
        displayName={newDisplayName}
        onEmailChange={setNewEmail}
        onDisplayNameChange={setNewDisplayName}
        onSubmit={handleCreate}
        isLoading={createMailbox.isPending}
      />

      {settingsMailbox && (
        <MailboxSettingsDialog
          mailbox={settingsMailbox}
          open={!!settingsMailbox}
          onOpenChange={(open) => !open && setSettingsMailbox(null)}
        />
      )}
      {MailboxConfirmDialog}
    </div>
  );
}

interface AddMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  displayName: string;
  onEmailChange: (email: string) => void;
  onDisplayNameChange: (name: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

function AddMailboxDialog({
  open,
  onOpenChange,
  email,
  displayName,
  onEmailChange,
  onDisplayNameChange,
  onSubmit,
  isLoading,
}: AddMailboxDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Caixa de Email</DialogTitle>
          <DialogDescription>
            Configure um novo endereço de email para receber e enviar mensagens
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Endereço de Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="contato@seudominio.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de Exibição (opcional)</Label>
            <Input
              id="displayName"
              placeholder="Contato"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Esta caixa de email será usada para gerenciar emails corporativos manualmente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!email || isLoading}>
            {isLoading ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
