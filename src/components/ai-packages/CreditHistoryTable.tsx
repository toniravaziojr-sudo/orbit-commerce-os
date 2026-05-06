/**
 * CreditHistoryTable — Etapa 1B Fase A3.2
 *
 * Renderiza o extrato vindo de `useCreditHistory` (RPC get_credit_history).
 * Componente NOVO; não substitui CreditLedgerTable existente (que continua
 * acoplado ao shape antigo de credit_ledger direto).
 *
 * Regras:
 * - Nunca exibir "null"/"undefined".
 * - Não renderizar service_key cru se vier null (tenant comum).
 * - Não renderizar provider cru se vier null.
 * - Não exibir custo/margem se vierem null.
 */

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Undo,
  Gift,
  Settings,
  Image as ImageIcon,
  Video,
  AlertCircle,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeShortBR } from "@/lib/date-format";
import { formatCredits } from "@/hooks/useCredits";
import type { CreditHistoryItem } from "@/hooks/useCreditHistory";

interface CreditHistoryTableProps {
  items: CreditHistoryItem[];
  isLoading?: boolean;
  isError?: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
  onPageChange?: (newOffset: number) => void;
  /** Quando true, mostra colunas extras (provider, service_key, custo, margem) — só admin. */
  showAdminColumns?: boolean;
}

const TX_TYPE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  reserve: { label: "Reserva", variant: "outline", icon: <Clock className="h-3.5 w-3.5" /> },
  capture: { label: "Captura", variant: "destructive", icon: <ArrowDownCircle className="h-3.5 w-3.5" /> },
  release: { label: "Liberação", variant: "secondary", icon: <Undo className="h-3.5 w-3.5" /> },
  refund: { label: "Estorno", variant: "secondary", icon: <Undo className="h-3.5 w-3.5" /> },
  adjust: { label: "Ajuste", variant: "outline", icon: <Settings className="h-3.5 w-3.5" /> },
  purchase: { label: "Compra", variant: "default", icon: <ArrowUpCircle className="h-3.5 w-3.5" /> },
  bonus: { label: "Bônus", variant: "secondary", icon: <Gift className="h-3.5 w-3.5" /> },
  consume: { label: "Consumo", variant: "destructive", icon: <ArrowDownCircle className="h-3.5 w-3.5" /> },
};

const STATUS_LABEL: Record<string, string> = {
  reserved: "Reservado",
  captured: "Capturado",
  released: "Liberado",
  completed: "Completo",
  failed: "Falhou",
};

const CATEGORY_LABEL: Record<string, string> = {
  ai_image: "IA Imagem",
  ai_video: "IA Vídeo",
  whatsapp: "WhatsApp",
  email: "Email",
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ai_image: <ImageIcon className="h-3.5 w-3.5" />,
  ai_video: <Video className="h-3.5 w-3.5" />,
};

function describeItem(item: CreditHistoryItem): string {
  const categoryLabel = item.category
    ? (CATEGORY_LABEL[item.category] ?? item.category)
    : null;
  const detail =
    item.description ||
    item.creative_product_name ||
    item.feature ||
    null;

  if (categoryLabel && detail) return `${categoryLabel} — ${detail}`;
  if (detail) return detail;
  if (categoryLabel) return categoryLabel;
  return "Movimento de crédito";
}

function txLabel(t: string) {
  return TX_TYPE_LABEL[t] ?? { label: t, variant: "outline" as const, icon: null };
}

export function CreditHistoryTable({
  items,
  isLoading,
  isError,
  totalCount = 0,
  limit = 50,
  offset = 0,
  onPageChange,
  showAdminColumns = false,
}: CreditHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-destructive">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-70" />
        <p className="text-sm">Não foi possível carregar o extrato.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowDownCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p>Nenhum movimento no período.</p>
      </div>
    );
  }

  const page = Math.floor(offset / Math.max(1, limit)) + 1;
  const pages = Math.max(1, Math.ceil(totalCount / Math.max(1, limit)));

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Descrição</TableHead>
              {showAdminColumns && <TableHead>Provider</TableHead>}
              {showAdminColumns && <TableHead>Service key</TableHead>}
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Saldo após</TableHead>
              {showAdminColumns && <TableHead className="text-right">Custo USD</TableHead>}
              {showAdminColumns && <TableHead className="text-right">Venda USD</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const tx = txLabel(item.transaction_type);
              const isPositive = item.credits_delta > 0;
              const isZero = item.credits_delta === 0;
              const status = item.operation_status
                ? STATUS_LABEL[item.operation_status] ?? item.operation_status
                : null;
              const catIcon = item.category ? CATEGORY_ICON[item.category] : null;

              return (
                <TableRow key={item.ledger_id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTimeShortBR(new Date(item.created_at))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.variant} className="gap-1">
                      {tx.icon}
                      {tx.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {status ? (
                      <span className="text-xs text-muted-foreground">{status}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {catIcon}
                      <span className="text-sm">{describeItem(item)}</span>
                    </div>
                  </TableCell>
                  {showAdminColumns && (
                    <TableCell className="text-xs">{item.provider ?? "—"}</TableCell>
                  )}
                  {showAdminColumns && (
                    <TableCell className="text-xs font-mono">
                      {item.service_key ?? "—"}
                    </TableCell>
                  )}
                  <TableCell
                    className={`text-right font-medium ${
                      isZero
                        ? "text-muted-foreground"
                        : isPositive
                          ? "text-green-600"
                          : "text-destructive"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatCredits(item.credits_delta)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {item.balance_after != null ? formatCredits(item.balance_after) : "—"}
                  </TableCell>
                  {showAdminColumns && (
                    <TableCell className="text-right text-xs">
                      {item.cost_usd != null ? `$${Number(item.cost_usd).toFixed(4)}` : "—"}
                    </TableCell>
                  )}
                  {showAdminColumns && (
                    <TableCell className="text-right text-xs">
                      {item.sell_usd != null ? `$${Number(item.sell_usd).toFixed(4)}` : "—"}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalCount > limit && onPageChange && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page} de {pages} · {totalCount} movimento(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset <= 0}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= totalCount}
              onClick={() => onPageChange(offset + limit)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
