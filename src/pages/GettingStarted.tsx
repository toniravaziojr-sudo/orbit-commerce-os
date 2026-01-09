import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, 'completed'>[] = [
  {
    id: 'import_products',
    title: 'Importar produtos',
    description: 'Importe seus produtos de outra plataforma ou cadastre manualmente',
    href: '/import',
  },
  {
    id: 'import_customers',
    title: 'Importar clientes',
    description: 'Traga sua base de clientes para o Comando Central',
    href: '/import',
  },
  {
    id: 'setup_store',
    title: 'Configurar loja virtual',
    description: 'Personalize sua loja com seu logo, cores e informações',
    href: '/storefront/settings',
  },
  {
    id: 'setup_payments',
    title: 'Configurar pagamentos',
    description: 'Configure os meios de pagamento para receber vendas',
    href: '/integrations',
  },
  {
    id: 'setup_shipping',
    title: 'Configurar frete',
    description: 'Defina as opções de entrega para seus clientes',
    href: '/shipping/settings',
  },
  {
    id: 'first_sale',
    title: 'Fazer primeira venda',
    description: 'Crie um pedido teste para validar todo o fluxo',
    href: '/orders/new',
  },
];

export default function GettingStarted() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inicializar checklist vazio (progresso local por enquanto)
    setChecklist(DEFAULT_CHECKLIST.map(item => ({ ...item, completed: false })));
    setLoading(false);
  }, [currentTenant?.id]);

  const toggleItem = async (itemId: string) => {
    if (!currentTenant?.id) return;

    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ));
  };

  const completedCount = checklist.filter(i => i.completed).length;
  const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bem-vindo ao Comando Central! 🎉</h1>
          <p className="text-muted-foreground">
            Siga os passos abaixo para configurar sua loja e começar a vender.
          </p>
        </div>

        {/* Video placeholder */}
        <Card className="mb-8 overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground">Vídeo de boas-vindas em breve</p>
            </div>
          </div>
        </Card>

        {/* Progress */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Seu progresso</CardTitle>
              <span className="text-sm text-muted-foreground">
                {completedCount} de {checklist.length} concluídos
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Checklist */}
        <div className="space-y-4">
          {checklist.map((item, index) => (
            <Card
              key={item.id}
              className={`transition-all ${item.completed ? 'bg-muted/50' : 'hover:shadow-md'}`}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/30 hover:border-primary'
                  }`}
                >
                  {item.completed ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>

                <Button
                  variant={item.completed ? 'ghost' : 'outline'}
                  size="sm"
                  onClick={() => navigate(item.href)}
                >
                  {item.completed ? 'Ver' : 'Iniciar'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skip button */}
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Pular e ir para o Dashboard
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
