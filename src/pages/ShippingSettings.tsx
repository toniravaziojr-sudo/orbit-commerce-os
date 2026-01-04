import { PageHeader } from '@/components/ui/page-header';
import { ShippingCarrierSettings } from '@/components/shipping/ShippingCarrierSettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ShippingSettings() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Configurar Transportadoras"
        description="Configure as integrações com transportadoras para cotação e rastreamento"
        actions={
          <Button variant="outline" onClick={() => navigate('/shipping')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        }
      />

      <ShippingCarrierSettings />
    </div>
  );
}
