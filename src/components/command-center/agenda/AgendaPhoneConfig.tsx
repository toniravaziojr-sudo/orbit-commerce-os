import { useState } from "react";
import { Phone, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAgendaAuthorizedPhones } from "@/hooks/useAgendaAuthorizedPhones";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatPhoneDisplay(phone: string): string {
  if (phone.length === 13) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  if (phone.length === 12) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
  }
  return `+${phone}`;
}

export function AgendaPhoneConfig() {
  const { phones, isLoading, addPhone, removePhone, togglePhone } = useAgendaAuthorizedPhones();
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = async () => {
    if (!newPhone.trim()) return;
    await addPhone.mutateAsync({ phone: newPhone.trim(), label: newLabel.trim() || undefined });
    setNewPhone("");
    setNewLabel("");
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Números Autorizados
            </CardTitle>
            <CardDescription className="mt-1">
              Números de WhatsApp que podem se comunicar com o agente da Agenda
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar número autorizado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Número do WhatsApp</Label>
                  <Input
                    placeholder="5511999999999"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (ex: 5511999999999)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Identificação (opcional)</Label>
                  <Input
                    placeholder="Ex: João - Owner"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleAdd} disabled={addPhone.isPending || !newPhone.trim()}>
                  {addPhone.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : phones.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum número autorizado configurado</p>
            <p className="text-xs mt-1">Adicione um número para que o admin possa se comunicar com a Agenda via WhatsApp</p>
          </div>
        ) : (
          <div className="space-y-2">
            {phones.map((phone) => (
              <div
                key={phone.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${phone.is_active ? 'bg-success' : 'bg-muted-foreground/50'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">
                        {formatPhoneDisplay(phone.phone)}
                      </span>
                      <Badge variant={phone.is_active ? "default" : "secondary"} className="text-[10px] py-0">
                        {phone.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {phone.label && (
                      <p className="text-xs text-muted-foreground">{phone.label}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      Adicionado em {format(new Date(phone.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={phone.is_active}
                    onCheckedChange={(checked) => togglePhone.mutate({ phoneId: phone.id, isActive: checked })}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover número?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O número {formatPhoneDisplay(phone.phone)} não poderá mais se comunicar com o agente da Agenda.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removePhone.mutate(phone.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
