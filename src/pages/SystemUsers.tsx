import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  UserPlus, 
  MoreHorizontal, 
  Mail, 
  Trash2, 
  RefreshCw,
  Crown,
  ShieldCheck,
  Edit3,
  Headphones,
  Wrench,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Users as UsersIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { EditUserModal } from '@/components/users/EditUserModal';

const USER_TYPE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: 'Proprietário', icon: Crown, color: 'bg-amber-100 text-amber-800' },
  manager: { label: 'Gerente', icon: ShieldCheck, color: 'bg-blue-100 text-blue-800' },
  editor: { label: 'Editor', icon: Edit3, color: 'bg-purple-100 text-purple-800' },
  attendant: { label: 'Atendente', icon: Headphones, color: 'bg-green-100 text-green-800' },
  assistant: { label: 'Auxiliar', icon: Wrench, color: 'bg-orange-100 text-orange-800' },
  viewer: { label: 'Visualizador', icon: Eye, color: 'bg-gray-100 text-gray-800' },
};

export default function SystemUsers() {
  const navigate = useNavigate();
  const { currentTenant, user } = useAuth();
  const { isOwner } = usePermissions();
  const queryClient = useQueryClient();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<string | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<any>(null);

  // Redirect non-owners
  useEffect(() => {
    if (!isOwner) {
      navigate('/');
      toast.error('Apenas o proprietário pode acessar esta página');
    }
  }, [isOwner, navigate]);

  // Fetch team members
  const { data: teamMembers, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['team-members', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      
      // First get user_roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, user_type, permissions, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });

      if (rolesError) {
        console.error('Error fetching user_roles:', rolesError);
        throw rolesError;
      }

      if (!roles || roles.length === 0) return [];

      // Get all user_ids to fetch profiles
      const userIds = roles.map(r => r.user_id);
      
      // Fetch profiles separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles - fallback to showing user_id
      }

      // Map profiles to roles
      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      
      return roles.map(role => ({
        ...role,
        profiles: profilesMap.get(role.user_id) || null,
      }));
    },
    enabled: !!currentTenant && isOwner,
  });

  // Fetch pending invitations
  const { data: pendingInvites, isLoading: isLoadingInvites } = useQuery({
    queryKey: ['pending-invites', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      
      const { data, error } = await supabase
        .from('tenant_user_invitations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant && isOwner,
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userRoleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Usuário removido da equipe');
      setUserToRemove(null);
    },
    onError: (error) => {
      console.error('Error removing user:', error);
      toast.error('Erro ao remover usuário');
    },
  });

  // Revoke invitation mutation
  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('tenant_user_invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      toast.success('Convite revogado');
      setInviteToRevoke(null);
    },
    onError: (error) => {
      console.error('Error revoking invite:', error);
      toast.error('Erro ao revogar convite');
    },
  });

  // Resend invitation mutation
  const resendInviteMutation = useMutation({
    mutationFn: async (invite: any) => {
      // First, revoke old invite
      await supabase
        .from('tenant_user_invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', invite.id);

      // Then create new invite via edge function
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('tenant-user-invite', {
        body: {
          email: invite.email,
          user_type: invite.user_type,
          permissions: invite.permissions,
          tenant_id: currentTenant?.id,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao reenviar convite');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      toast.success('Convite reenviado');
    },
    onError: (error: any) => {
      console.error('Error resending invite:', error);
      toast.error(error.message || 'Erro ao reenviar convite');
    },
  });

  if (!isOwner) {
    return null;
  }

  const isLoading = isLoadingMembers || isLoadingInvites;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuários e Permissões"
        description="Gerencie sua equipe e controle quem acessa cada área do sistema"
        actions={
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar Usuário
          </Button>
        }
      />

      <Tabs defaultValue="team" className="w-full">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Equipe ({teamMembers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Mail className="h-4 w-4" />
            Convites Pendentes ({pendingInvites?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>
                Usuários que têm acesso a esta conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : teamMembers && teamMembers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member: any) => {
                      const profile = member.profiles;
                      const userType = member.role === 'owner' ? 'owner' : (member.user_type || 'viewer');
                      const config = USER_TYPE_CONFIG[userType];
                      const Icon = config?.icon || Eye;
                      const isCurrentUser = member.user_id === user?.id;
                      // Improved name display with fallback to email
                      const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'Usuário';
                      const displayInitial = (profile?.full_name || profile?.email || '?')[0].toUpperCase();

                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                {profile?.avatar_url ? (
                                  <img 
                                    src={profile.avatar_url} 
                                    alt="" 
                                    className="h-9 w-9 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm font-medium">
                                    {displayInitial}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {displayName}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {profile?.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={config?.color}>
                              <Icon className="mr-1 h-3 w-3" />
                              {config?.label || userType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(member.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            {member.role !== 'owner' && !isCurrentUser && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setMemberToEdit(member)}>
                                    <Edit3 className="mr-2 h-4 w-4" />
                                    Editar Permissões
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setUserToRemove(member.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remover
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <UsersIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">Nenhum membro na equipe</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Convide pessoas para ajudar a gerenciar sua loja
                  </p>
                  <Button onClick={() => setIsInviteModalOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Convidar Usuário
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Convites Pendentes</CardTitle>
              <CardDescription>
                Convites aguardando aceite
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInvites ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingInvites && pendingInvites.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((invite: any) => {
                      const config = USER_TYPE_CONFIG[invite.user_type];
                      const Icon = config?.icon || Eye;
                      const isExpired = new Date(invite.expires_at) < new Date();

                      return (
                        <TableRow key={invite.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <span className="font-medium">{invite.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={config?.color}>
                              <Icon className="mr-1 h-3 w-3" />
                              {config?.label || invite.user_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Expirado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(invite.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => resendInviteMutation.mutate(invite)}
                                  disabled={resendInviteMutation.isPending}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Reenviar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setInviteToRevoke(invite.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Revogar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">Nenhum convite pendente</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Convites aceitos ou expirados não aparecem aqui
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      <InviteUserModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
      />

      {/* Remove User Confirmation */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Este usuário perderá o acesso a esta conta imediatamente.
              Esta ação pode ser desfeita convidando o usuário novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => userToRemove && removeUserMutation.mutate(userToRemove)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Invite Confirmation */}
      <AlertDialog open={!!inviteToRevoke} onOpenChange={() => setInviteToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link do convite será invalidado e o usuário não poderá mais aceitar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => inviteToRevoke && revokeInviteMutation.mutate(inviteToRevoke)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Modal */}
      <EditUserModal
        open={!!memberToEdit}
        onOpenChange={(open) => !open && setMemberToEdit(null)}
        member={memberToEdit}
      />
    </div>
  );
}
