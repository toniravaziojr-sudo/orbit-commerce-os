 import { useState, useCallback } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Upload, Download, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import { 
   convertGoogleMapsToFacebookCSV, 
   getConversionStats, 
   downloadCSV,
   type ConversionStats 
 } from '@/lib/converters/googleMapsToFacebookCSV';
 
 export function GoogleMapsToFacebookConverter() {
   const [file, setFile] = useState<File | null>(null);
   const [stats, setStats] = useState<ConversionStats | null>(null);
   const [csvContent, setCsvContent] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [isProcessing, setIsProcessing] = useState(false);
 
   const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
     const selectedFile = e.target.files?.[0];
     if (selectedFile) {
       setFile(selectedFile);
       setStats(null);
       setCsvContent(null);
       setError(null);
     }
   }, []);
 
   const handleProcess = useCallback(async () => {
     if (!file) return;
     
     setIsProcessing(true);
     setError(null);
     
     try {
       const text = await file.text();
       const data = JSON.parse(text);
       
       if (!data.items || !Array.isArray(data.items)) {
         throw new Error('Formato inválido: o arquivo deve conter um array "items"');
       }
       
       const conversionStats = getConversionStats(data);
       setStats(conversionStats);
       
       const csv = convertGoogleMapsToFacebookCSV(data);
       setCsvContent(csv);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
     } finally {
       setIsProcessing(false);
     }
   }, [file]);
 
   const handleDownload = useCallback(() => {
     if (csvContent) {
       const filename = file?.name.replace('.json', '') + '_facebook.csv' || 'facebook-custom-audience.csv';
       downloadCSV(csvContent, filename);
     }
   }, [csvContent, file]);
 
   return (
     <Card className="w-full max-w-2xl mx-auto">
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <FileJson className="h-5 w-5" />
           Conversor Google Maps → Facebook
         </CardTitle>
         <CardDescription>
           Converta dados de lojas do Google Maps para o formato de público personalizado do Facebook Ads
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Upload area */}
         <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
           <input
             type="file"
             accept=".json"
             onChange={handleFileChange}
             className="hidden"
             id="json-upload"
           />
           <label 
             htmlFor="json-upload" 
             className="cursor-pointer flex flex-col items-center gap-2"
           >
             <Upload className="h-8 w-8 text-muted-foreground" />
             <span className="text-sm text-muted-foreground">
               {file ? file.name : 'Clique para selecionar o arquivo JSON'}
             </span>
           </label>
         </div>
 
         {/* Process button */}
         {file && !csvContent && (
           <Button 
             onClick={handleProcess} 
             disabled={isProcessing}
             className="w-full"
           >
             {isProcessing ? 'Processando...' : 'Processar Arquivo'}
           </Button>
         )}
 
         {/* Error */}
         {error && (
           <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Erro</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
         )}
 
         {/* Stats */}
         {stats && (
           <Alert>
             <CheckCircle2 className="h-4 w-4" />
             <AlertTitle>Conversão Concluída</AlertTitle>
             <AlertDescription>
               <ul className="mt-2 space-y-1 text-sm">
                 <li>📊 Total de itens: <strong>{stats.totalItems.toLocaleString()}</strong></li>
                 <li>📱 Itens com telefone: <strong>{stats.itemsWithPhone.toLocaleString()}</strong></li>
                 <li>✅ Telefones válidos: <strong>{stats.totalPhones.toLocaleString()}</strong></li>
                 <li>⚠️ Sem telefone: <strong>{stats.skippedNoPhone.toLocaleString()}</strong></li>
                 <li>❌ Telefones inválidos: <strong>{stats.skippedInvalidPhone.toLocaleString()}</strong></li>
               </ul>
             </AlertDescription>
           </Alert>
         )}
 
         {/* Download button */}
         {csvContent && (
           <Button 
             onClick={handleDownload} 
             className="w-full"
             variant="default"
           >
             <Download className="h-4 w-4 mr-2" />
             Baixar CSV para Facebook ({stats?.totalPhones.toLocaleString()} contatos)
           </Button>
         )}
 
         {/* Format info */}
         <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
           <p className="font-medium mb-1">Formato do CSV gerado:</p>
           <code className="text-xs">phone, fn, ln, ct, st, zip, country</code>
           <p className="mt-2">
             O Facebook usa esses campos para fazer correspondência com usuários. 
             Os telefones são convertidos para formato E.164 (+55...).
           </p>
         </div>
       </CardContent>
     </Card>
   );
 }