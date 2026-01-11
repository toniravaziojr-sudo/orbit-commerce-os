import { useNavigate } from 'react-router-dom';
import { LogoHorizontal } from '@/components/branding/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX, LogOut, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Página exibida para usuários que foram removidos de todos os tenants.
 * Usuários convidados que tiveram seu acesso revogado não podem criar loja própria.
 */
export default function NoAccess() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <LogoHorizontal iconSize={40} />
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Acesso Removido</CardTitle>
            <CardDescription className="text-base">
              Você não possui acesso a nenhuma loja no momento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
              <p>
                Seu acesso foi revogado pelo administrador da loja.
              </p>
              <p>
                Se você acredita que isso foi um erro, entre em contato com o 
                administrador da loja para solicitar um novo convite.
              </p>
            </div>

            {user?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <Mail className="h-4 w-4" />
                <span>Logado como: <strong>{user.email}</strong></span>
              </div>
            )}

            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              className="w-full"
              size="lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair e Usar Outra Conta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
