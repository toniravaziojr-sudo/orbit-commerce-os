import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { MODULES, USER_TYPE_PRESETS } from '@/config/rbac-modules';
import { Loader2 } from 'lucide-react';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserModal({ open, onOpenChange }: InviteUserModalProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<string>('viewer');
  const [permissions, setPermissions] = useState<Record<string, boolean | Record<string, boolean>>>({});

  // Apply preset when user type changes
  const handleUserTypeChange = (type: string) => {
    setUserType(type);
    const preset = USER_TYPE_PRESETS[type];
    if (preset) {
      setPermissions({ ...preset.permissions });
    }
  };

  // Toggle module permission
  const toggleModule = (moduleKey: string, enabled: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: enabled,
    }));
  };

  // Toggle submodule permission
  const toggleSubmodule = (moduleKey: string, subKey: string, enabled: boolean) => {
    setPermissions(prev => {
      const current = prev[moduleKey];
      if (typeof current === 'boolean') {
        // Convert to object
        const module = MODULES.find(m => m.key === moduleKey);
        const subPermissions: Record<string, boolean> = {};
        module?.submodules?.forEach(s => {
          subPermissions[s.key] = current;
        });
        subPermissions[subKey] = enabled;
        return { ...prev, [moduleKey]: subPermissions };
      }
      return {
        ...prev,
        [moduleKey]: { ...(current || {}), [subKey]: enabled },
      };
    });
  };

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke('tenant-user-invite', {
        body: {
          email: email.trim().toLowerCase(),
          user_type: userType,
          permissions,
          tenant_id: currentTenant?.id,
        },
      });
      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro ao enviar convite');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      toast.success('Convite enviado com sucesso!');
      onOpenChange(false);
      setEmail('');
      setUserType('viewer');
      setPermissions({});
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enviar convite');
    },
  });

  const isModuleEnabled = (moduleKey: string) => {
    const perm = permissions[moduleKey];
    if (typeof perm === 'boolean') return perm;
    if (typeof perm === 'object') return Object.values(perm).some(v => v);
    return false;
  };

  const isSubmoduleEnabled = (moduleKey: string, subKey: string) => {
    const perm = permissions[moduleKey];
    if (typeof perm === 'boolean') return perm;
    if (typeof perm === 'object') return perm[subKey] === true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
          <DialogDescription>
            Envie um convite para adicionar alguém à sua equipe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Usuário</Label>
            <Select value={userType} onValueChange={handleUserTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USER_TYPE_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <span className="font-medium">{preset.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        - {preset.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Permissões</Label>
            <p className="text-sm text-muted-foreground">
              Personalize o acesso a cada módulo
            </p>
            <Accordion type="multiple" className="w-full">
              {MODULES.map((module) => (
                <AccordionItem key={module.key} value={module.key}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isModuleEnabled(module.key)}
                        onCheckedChange={(checked) => toggleModule(module.key, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span>{module.label}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-8 space-y-2">
                      {module.submodules?.map((sub) => (
                        <div key={sub.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`${module.key}-${sub.key}`}
                            checked={isSubmoduleEnabled(module.key, sub.key)}
                            onCheckedChange={(checked) => 
                              toggleSubmodule(module.key, sub.key, !!checked)
                            }
                          />
                          <Label 
                            htmlFor={`${module.key}-${sub.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {sub.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => inviteMutation.mutate()}
            disabled={!email || inviteMutation.isPending}
          >
            {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
