import { useNavigate } from "react-router-dom";
import { User, LogOut, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PlatformAlerts } from "./PlatformAlerts";
import { ModuleTutorialLink } from "./ModuleTutorialLink";
import { AdminModeToggle } from "./AdminModeToggle";

export function AppHeader() {
  const navigate = useNavigate();
  const { profile, currentTenant, userRoles, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  // Get initials for avatar
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get current role in tenant
  const getCurrentRole = () => {
    if (!currentTenant) return null;
    const role = userRoles.find((r) => r.tenant_id === currentTenant.id);
    return role?.role;
  };

  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    operator: "Operador",
    support: "Suporte",
    finance: "Financeiro",
    viewer: "Visualizador",
  };

  const currentRole = getCurrentRole();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Left side: Mode Toggle + Alerts + Tutorial */}
      <div className="flex items-center gap-4">
        <AdminModeToggle />
        <PlatformAlerts />
        <div className="hidden lg:block">
          <ModuleTutorialLink />
        </div>
      </div>

      {/* Right side: User Menu */}
      <div className="flex items-center gap-3">
        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left sm:flex">
                <span className="text-sm font-medium text-foreground">
                  {profile?.full_name || profile?.email?.split("@")[0] || "Usuário"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {currentRole ? roleLabels[currentRole] : currentTenant?.name}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {profile?.full_name || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/account/data")}>
              <User className="mr-2 h-4 w-4" />
              Dados da Conta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/account/billing")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Planos e Faturamento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
