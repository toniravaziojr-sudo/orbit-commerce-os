import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, User, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Agent {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  active_conversations?: number;
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentAssignee: string | null;
  onTransfer: (toUserId: string, reason?: string) => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  conversationId,
  currentAssignee,
  onTransfer,
}: TransferDialogProps) {
  const { currentTenant, user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch available agents (team members)
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Get all users with roles in this tenant
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('tenant_id', currentTenant.id);

      if (rolesError) throw rolesError;

      // Get active conversation counts per agent
      const { data: convCounts, error: convError } = await supabase
        .from('conversations')
        .select('assigned_to')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['open', 'new', 'waiting_agent', 'waiting_customer']);

      if (convError) throw convError;

      // Count conversations per agent
      const countsMap = (convCounts || []).reduce((acc, c) => {
        if (c.assigned_to) {
          acc[c.assigned_to] = (acc[c.assigned_to] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Map to agents array
      const agentsList: Agent[] = roles
        .filter(r => r.profiles && r.user_id !== currentAssignee)
        .map(r => ({
          id: r.user_id,
          email: (r.profiles as any)?.email || '',
          full_name: (r.profiles as any)?.full_name || null,
          avatar_url: (r.profiles as any)?.avatar_url || null,
          role: r.role,
          active_conversations: countsMap[r.user_id] || 0,
        }));

      return agentsList;
    },
    enabled: !!currentTenant?.id && open,
  });

  const filteredAgents = agents?.filter(agent => {
    const search = searchQuery.toLowerCase();
    return (
      agent.email.toLowerCase().includes(search) ||
      agent.full_name?.toLowerCase().includes(search)
    );
  }) || [];

  const handleTransfer = () => {
    if (!selectedAgent) return;
    onTransfer(selectedAgent, reason || undefined);
    onOpenChange(false);
    setSelectedAgent('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Transferir conversa
          </DialogTitle>
          <DialogDescription>
            Selecione um atendente para assumir esta conversa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atendente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Agents list */}
          <ScrollArea className="h-[200px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Carregando atendentes...
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {searchQuery ? 'Nenhum atendente encontrado' : 'Nenhum atendente disponível'}
              </div>
            ) : (
              <RadioGroup value={selectedAgent} onValueChange={setSelectedAgent}>
                <div className="divide-y">
                  {filteredAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <RadioGroupItem value={agent.id} id={agent.id} />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback>
                          {(agent.full_name?.[0] || agent.email[0]).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {agent.full_name || agent.email}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs capitalize">
                            {agent.role}
                          </Badge>
                          <span>
                            {agent.active_conversations} conversa{agent.active_conversations !== 1 ? 's' : ''} ativa{agent.active_conversations !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            )}
          </ScrollArea>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo da transferência (opcional)</Label>
            <Textarea
              placeholder="Ex: Cliente precisa de suporte técnico especializado"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedAgent}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
