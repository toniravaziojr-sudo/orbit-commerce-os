/**
 * Credit Ledger Table
 * Shows transaction history for credits
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  Undo, 
  Gift,
  Settings,
  Bot,
  Image,
  Video,
  Mic,
  FileText,
  Search
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditLedgerEntry, formatCredits } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditLedgerTableProps {
  entries: CreditLedgerEntry[];
  isLoading?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  purchase: { label: 'Compra', icon: <ArrowUpCircle className="h-4 w-4" />, variant: 'default' },
  bonus: { label: 'Bônus', icon: <Gift className="h-4 w-4" />, variant: 'secondary' },
  consume: { label: 'Consumo', icon: <ArrowDownCircle className="h-4 w-4" />, variant: 'destructive' },
  reserve: { label: 'Reserva', icon: <Clock className="h-4 w-4" />, variant: 'outline' },
  refund: { label: 'Estorno', icon: <Undo className="h-4 w-4" />, variant: 'secondary' },
  adjust: { label: 'Ajuste', icon: <Settings className="h-4 w-4" />, variant: 'outline' },
};

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  chat: <Bot className="h-4 w-4" />,
  vision: <Image className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  avatar: <Video className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  seo: <FileText className="h-4 w-4" />,
  embedding: <Search className="h-4 w-4" />,
};

function getFeatureLabel(entry: CreditLedgerEntry): string {
  if (entry.description) return entry.description;
  
  const parts: string[] = [];
  if (entry.provider) parts.push(entry.provider.toUpperCase());
  if (entry.model) parts.push(entry.model);
  if (entry.feature) parts.push(entry.feature);
  
  return parts.join(' • ') || 'Transação';
}

function formatUnits(units: Record<string, number> | null): string {
  if (!units) return '-';
  
  const parts: string[] = [];
  if (units.tokens_in) parts.push(`${(units.tokens_in / 1000).toFixed(1)}k in`);
  if (units.tokens_out) parts.push(`${(units.tokens_out / 1000).toFixed(1)}k out`);
  if (units.seconds) parts.push(`${units.seconds}s`);
  if (units.images) parts.push(`${units.images} img`);
  if (units.minutes) parts.push(`${units.minutes}min`);
  
  return parts.join(', ') || '-';
}

export function CreditLedgerTable({ entries, isLoading }: CreditLedgerTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowDownCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação encontrada</p>
        <p className="text-sm">Compre créditos para começar a usar IA</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Unidades</TableHead>
          <TableHead className="text-right">Créditos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const config = TYPE_CONFIG[entry.transaction_type] || TYPE_CONFIG.consume;
          const isPositive = entry.credits_delta > 0;

          return (
            <TableRow key={entry.id}>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant={config.variant} className="gap-1">
                  {config.icon}
                  {config.label}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {entry.feature && FEATURE_ICONS[entry.feature]}
                  <span className="text-sm">{getFeatureLabel(entry)}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatUnits(entry.units_json)}
              </TableCell>
              <TableCell className={`text-right font-medium ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{formatCredits(entry.credits_delta)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
