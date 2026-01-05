import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, Save, Eye, EyeOff, Database, Server } from "lucide-react";
import { toast } from "sonner";

interface CredentialEditorProps {
  credentialKey: string;
  label: string;
  description?: string;
  isConfigured: boolean;
  preview?: string;
  source?: 'db' | 'env' | null;
  placeholder?: string;
}

export function CredentialEditor({
  credentialKey,
  label,
  description,
  isConfigured,
  preview,
  source,
  placeholder = "Digite o novo valor..."
}: CredentialEditorProps) {
  const [newValue, setNewValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await supabase.functions.invoke('platform-credentials-update', {
        body: { credentialKey, credentialValue: value }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setNewValue("");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['platform-secrets-status'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const handleSave = () => {
    if (!newValue.trim()) {
      toast.error('Digite um valor');
      return;
    }
    updateMutation.mutate(newValue.trim());
  };

  return (
    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground">{credentialKey}</p>
          {source === 'db' && (
            <Badge variant="outline" className="text-xs h-5">
              <Database className="h-3 w-3 mr-1" />
              Banco
            </Badge>
          )}
          {source === 'env' && (
            <Badge variant="outline" className="text-xs h-5">
              <Server className="h-3 w-3 mr-1" />
              Env
            </Badge>
          )}
        </div>
        {isConfigured ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <p className="text-sm font-mono flex-1">
          {isConfigured ? (showValue && preview ? preview : '••••••••••••••••') : 'Não configurado'}
        </p>
        {isConfigured && preview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {isEditing ? (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs">{label}</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={placeholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending || !newValue.trim()}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setIsEditing(false); setNewValue(""); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setIsEditing(true)}
        >
          {isConfigured ? 'Alterar' : 'Configurar'}
        </Button>
      )}
    </div>
  );
}
