// =============================================
// B2B EXPORTS TAB - Histórico de exportações
// =============================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Users, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportLog {
  id: string;
  export_type: string;
  export_channel: string | null;
  total_records: number;
  consent_verified: boolean;
  legal_basis: string | null;
  created_at: string;
}

export default function B2BExportsTab() {
  const { currentTenant } = useAuth();
  const [exports, setExports] = useState<ExportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentTenant?.id) {
      loadExports();
    }
  }, [currentTenant?.id]);

  const loadExports = async () => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("b2b_export_logs")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setExports(data || []);
    } catch (err: any) {
      console.error("Load exports error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getExportTypeLabel = (type: string) => {
    switch (type) {
      case "csv_entities":
        return "CSV Empresas";
      case "csv_contacts":
        return "CSV Contatos";
      case "crm_import":
        return "Importação CRM";
      default:
        return type;
    }
  };

  const getChannelLabel = (channel: string | null) => {
    switch (channel) {
      case "email":
        return "E-mail";
      case "whatsapp":
        return "WhatsApp";
      case "all":
        return "Todos";
      default:
        return channel || "-";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Histórico de Exportações
          </CardTitle>
          <CardDescription>
            Registro de todas as exportações realizadas para auditoria e compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exports.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhuma exportação realizada</p>
              <p className="text-sm text-muted-foreground">
                As exportações de públicos aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Consentimento</TableHead>
                    <TableHead>Base Legal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">
                        {format(new Date(exp.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getExportTypeLabel(exp.export_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getChannelLabel(exp.export_channel)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{exp.total_records}</span>
                      </TableCell>
                      <TableCell>
                        {exp.consent_verified ? (
                          <Badge className="bg-green-500/10 text-green-600">
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {exp.legal_basis || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
