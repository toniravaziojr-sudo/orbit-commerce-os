 import { PageHeader } from "@/components/ui/page-header";
 import { GoogleMapsToFacebookConverter } from "@/components/tools/GoogleMapsToFacebookConverter";
 import { StorageExporter } from "@/components/tools/StorageExporter";
 
 export default function PlatformTools() {
   return (
     <div className="space-y-6 animate-fade-in">
       <PageHeader
         title="Ferramentas da Plataforma"
         description="Utilitários exclusivos para administração da plataforma"
       />
 
       <div className="space-y-6">
         <StorageExporter />
         <GoogleMapsToFacebookConverter />
       </div>
     </div>
   );
 }