import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, CheckCircle2, XCircle, Loader2, Info, Wifi, Send } from "lucide-react";
import { useWmsPratikaConfig, useWmsPratikaLogs, useWmsPratikaSave, useWmsPratikaTest } from "@/hooks/useWmsPratika";
import { formatDateTimeBR } from "@/lib/date-format";

export function WmsPratikaTab() {
  const { data: config, isLoading } = useWmsPratikaConfig();
  const { data: logs = [] } = useWmsPratikaLogs();
  const saveMutation = useWmsPratikaSave();
  const testMutation = useWmsPratikaTest();

  const [isEnabled, setIsEnabled] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("http://wmspratika.ddsinformatica.com.br/WsSoap/WsRecepcaoNfe.asmx");
  const [cnpj, setCnpj] = useState("");
  const [autoSendNfe, setAutoSendNfe] = useState(true);
  const [autoSendLabel, setAutoSendLabel] = useState(true);

  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setEndpointUrl(config.endpoint_url);
      setCnpj(config.cnpj || "");
      setAutoSendNfe(config.auto_send_nfe);
      setAutoSendLabel(config.auto_send_label);
    }
  }, [config]);

  const handleSave = () => {
    saveMutation.mutate({
      is_enabled: isEnabled,
      endpoint_url: endpointUrl,
      cnpj: cnpj || null,
      auto_send_nfe: autoSendNfe,
      auto_send_label: autoSendLabel,
    });
  };

  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
    saveMutation.mutate({
      is_enabled: checked,
      endpoint_url: endpointUrl,
      cnpj: cnpj || null,
      auto_send_nfe: autoSendNfe,
      auto_send_label: autoSendLabel,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">WMS Pratika</CardTitle>
                <CardDescription>
                  Integração com sistema WMS da DDS Informática
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isEnabled ? "default" : "secondary"}>
                {isEnabled ? "Ativo" : "Inativo"}
              </Badge>
              <Switch checked={isEnabled} onCheckedChange={handleToggle} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {isEnabled && (
        <>
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
              <CardDescription>
                Dados para comunicação com o web service SOAP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint">URL do Web Service</Label>
                <Input
                  id="endpoint"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="http://wmspratika.ddsinformatica.com.br/WsSoap/WsRecepcaoNfe.asmx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ (identificação no WMS)</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                <p className="text-xs text-muted-foreground">
                  O CNPJ é enviado junto ao XML para identificar sua empresa no sistema WMS
                </p>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Enviar NFe automaticamente</Label>
                  <p className="text-xs text-muted-foreground">
                    Envia o XML da NFe ao WMS sempre que uma nota for autorizada
                  </p>
                </div>
                <Switch checked={autoSendNfe} onCheckedChange={setAutoSendNfe} />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Enviar etiquetas automaticamente</Label>
                  <p className="text-xs text-muted-foreground">
                    Envia a etiqueta de transporte ao WMS quando gerada
                  </p>
                </div>
                <Switch checked={autoSendLabel} onCheckedChange={setAutoSendLabel} />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Configurações
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !endpointUrl}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este web service <strong>não requer autenticação</strong>. O cliente é identificado pelo CNPJ
              passado como parâmetro junto ao XML da nota fiscal.
              Operações suportadas: envio de NFe, atualização de rastreio e envio de etiquetas em lote.
            </AlertDescription>
          </Alert>

          {/* Recent Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos Envios</CardTitle>
              <CardDescription>
                Histórico dos últimos envios para o WMS
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum envio registrado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operação</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Send className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="capitalize">{log.operation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.reference_id?.substring(0, 8) || "—"}
                        </TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </Badge>
                          ) : log.status === "error" ? (
                            <Badge variant="destructive" className="gap-1" title={log.error_message || ""}>
                              <XCircle className="h-3 w-3" /> Erro
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{log.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTimeBR(log.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
