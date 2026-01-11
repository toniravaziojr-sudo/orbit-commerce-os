import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { MODULES, USER_TYPE_PRESETS } from '@/config/rbac-modules';

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    user_id: string;
    user_type: string;
    permissions: Record<string, boolean | Record<string, boolean>> | null;
    profiles?: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

export function EditUserModal({ open, onOpenChange, member }: EditUserModalProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  
  const [userType, setUserType] = useState<string>('viewer');
  const [permissions, setPermissions] = useState<Record<string, boolean | Record<string, boolean>>>({});
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');

  // Initialize from member data
  useEffect(() => {
    if (member) {
      setUserType(member.user_type || 'viewer');
      setPermissions(member.permissions || {});
      setDisplayName(member.profiles?.full_name || '');
    }
  }, [member]);

  const handleUserTypeChange = (newType: string) => {
    setUserType(newType);
    // Apply preset permissions if available
    const preset = USER_TYPE_PRESETS[newType as keyof typeof USER_TYPE_PRESETS];
    if (preset?.permissions) {
      setPermissions(preset.permissions);
    }
  };

  const toggleModule = (moduleKey: string) => {
    setPermissions(prev => {
      const current = prev[moduleKey];
      if (typeof current === 'boolean') {
        return { ...prev, [moduleKey]: !current };
      }
      if (typeof current === 'object') {
        // If it was an object, toggle to false (disable all)
        return { ...prev, [moduleKey]: false };
      }
      // If undefined, enable
      return { ...prev, [moduleKey]: true };
    });
  };

  const toggleSubmodule = (moduleKey: string, submoduleKey: string) => {
    setPermissions(prev => {
      const modulePerms = prev[moduleKey];
      if (typeof modulePerms === 'object' && modulePerms !== null) {
        return {
          ...prev,
          [moduleKey]: {
            ...modulePerms,
            [submoduleKey]: !(modulePerms as Record<string, boolean>)[submoduleKey],
          },
        };
      }
      // Create object with this submodule enabled
      return {
        ...prev,
        [moduleKey]: { [submoduleKey]: true },
      };
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!member || !currentTenant) throw new Error('Missing data');

      // Update user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({
          user_type: userType as any,
          permissions: permissions as any,
        })
        .eq('id', member.id);

      if (roleError) throw roleError;

      // Update profile name if changed
      if (displayName !== (member.profiles?.full_name || '')) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: displayName || null })
          .eq('id', member.user_id);

        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Permissões atualizadas com sucesso!');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Erro ao atualizar usuário');
    },
  });

  const handleResetPassword = async () => {
    if (!member?.profiles?.email) {
      toast.error('Email do usuário não encontrado');
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        member.profiles.email,
        { redirectTo: `${window.location.origin}/auth?reset=true` }
      );

      if (error) throw error;
      
      toast.success(`Email de recuperação enviado para ${member.profiles.email}`);
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast.error(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const isModuleEnabled = (moduleKey: string): boolean => {
    const perm = permissions[moduleKey];
    if (typeof perm === 'boolean') return perm;
    if (typeof perm === 'object' && perm !== null) {
      return Object.values(perm).some(v => v === true);
    }
    return false;
  };

  const isSubmoduleEnabled = (moduleKey: string, submoduleKey: string): boolean => {
    const perm = permissions[moduleKey];
    if (typeof perm === 'object' && perm !== null) {
      return (perm as Record<string, boolean>)[submoduleKey] === true;
    }
    return false;
  };

  const memberName = member?.profiles?.full_name || member?.profiles?.email || 'Usuário';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Edite as permissões de {memberName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              {member?.profiles?.avatar_url ? (
                <img 
                  src={member.profiles.avatar_url} 
                  alt="" 
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium">
                  {memberName[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">{member?.profiles?.email}</p>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Nome</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nome do usuário"
            />
            <p className="text-xs text-muted-foreground">
              Nome exibido na lista de equipe
            </p>
          </div>

          {/* User Type */}
          <div className="space-y-2">
            <Label>Tipo de Usuário</Label>
            <Select value={userType} onValueChange={handleUserTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Gerente</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="attendant">Atendente</SelectItem>
                <SelectItem value="assistant">Auxiliar</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O tipo de usuário define as permissões padrão
            </p>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Permissões Detalhadas</Label>
            <Accordion type="multiple" className="w-full">
              {MODULES.map((module) => (
                <AccordionItem key={module.key} value={module.key}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isModuleEnabled(module.key)}
                        onCheckedChange={() => toggleModule(module.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>{module.label}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {module.submodules ? (
                      <div className="space-y-2 pl-6">
                        {module.submodules.map((sub) => (
                          <div key={sub.key} className="flex items-center gap-2">
                            <Checkbox
                              checked={isSubmoduleEnabled(module.key, sub.key)}
                              onCheckedChange={() => toggleSubmodule(module.key, sub.key)}
                            />
                            <Label className="text-sm font-normal cursor-pointer">
                              {sub.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground pl-6">
                        Sem submódulos
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Password Reset */}
          <div className="pt-4 border-t">
            <Label className="mb-2 block">Segurança</Label>
            <Button
              variant="outline"
              onClick={handleResetPassword}
              disabled={isResettingPassword}
              className="w-full"
            >
              {isResettingPassword ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Enviar Email de Recuperação de Senha
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Um email será enviado para o usuário redefinir a senha
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
