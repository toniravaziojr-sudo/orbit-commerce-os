 /**
  * Converts Google Maps business data to Facebook Custom Audiences CSV format
  * 
  * Facebook accepts these identifiers:
  * - phone (E.164 format: +5511999999999)
  * - fn (first name)
  * - ln (last name) 
  * - ct (city)
  * - st (state - 2 letter code)
  * - zip (postal code)
  * - country (2 letter code)
  */
 
 interface GoogleMapsItem {
   name: string;
   phone_numbers: string[];
   city: string | null;
   state: string | null;
   zip_code: string | null;
   country_code: string | null;
   full_address: string | null;
   website: string | null;
   rating: number | null;
   review_count: number | null;
   subtypes: string[] | null;
 }
 
 interface GoogleMapsData {
   items: GoogleMapsItem[];
 }
 
 interface FacebookRow {
   phone: string;
   fn: string;
   ln: string;
   ct: string;
   st: string;
   zip: string;
   country: string;
 }
 
 // Map Brazilian state names to 2-letter codes
 const stateCodeMap: Record<string, string> = {
   'acre': 'AC',
   'alagoas': 'AL',
   'amapá': 'AP',
   'amazonas': 'AM',
   'bahia': 'BA',
   'ceará': 'CE',
   'distrito federal': 'DF',
   'espírito santo': 'ES',
   'goiás': 'GO',
   'maranhão': 'MA',
   'mato grosso': 'MT',
   'mato grosso do sul': 'MS',
   'minas gerais': 'MG',
   'pará': 'PA',
   'paraíba': 'PB',
   'paraná': 'PR',
   'pernambuco': 'PE',
   'piauí': 'PI',
   'rio de janeiro': 'RJ',
   'rio grande do norte': 'RN',
   'rio grande do sul': 'RS',
   'rondônia': 'RO',
   'roraima': 'RR',
   'santa catarina': 'SC',
   'são paulo': 'SP',
   'sergipe': 'SE',
   'tocantins': 'TO',
 };
 
 /**
  * Formats a Brazilian phone number to E.164 format
  * Input: "(66) 99234-9377" or "66992349377"
  * Output: "+5566992349377"
  */
 function formatPhoneToE164(phone: string): string {
   // Remove all non-digits
   const digits = phone.replace(/\D/g, '');
   
   // If already has country code (starts with 55 and has 12-13 digits)
   if (digits.startsWith('55') && digits.length >= 12) {
     return '+' + digits;
   }
   
   // Brazilian mobile: 11 digits (2 DDD + 9 + 8 digits)
   // Brazilian landline: 10 digits (2 DDD + 8 digits)
   if (digits.length === 10 || digits.length === 11) {
     return '+55' + digits;
   }
   
   // If 8-9 digits (no DDD), we can't reliably add country code
   // Return empty to skip this record
   if (digits.length < 10) {
     return '';
   }
   
   return '+55' + digits;
 }
 
 /**
  * Gets state code from full state name
  */
 function getStateCode(stateName: string | null): string {
   if (!stateName) return '';
   const normalized = stateName.toLowerCase().trim();
   return stateCodeMap[normalized] || stateName.substring(0, 2).toUpperCase();
 }
 
 /**
  * Extracts first and last name from business name
  * Uses the business name as a single entity (fn)
  */
 function extractNames(name: string): { fn: string; ln: string } {
   const parts = name.trim().split(' ');
   if (parts.length === 1) {
     return { fn: parts[0], ln: '' };
   }
   return { 
     fn: parts[0], 
     ln: parts.slice(1).join(' ')
   };
 }
 
 /**
  * Cleans ZIP code to digits only
  */
 function cleanZipCode(zip: string | null): string {
   if (!zip) return '';
   return zip.replace(/\D/g, '');
 }
 
 /**
  * Converts Google Maps data to Facebook CSV format
  */
 export function convertGoogleMapsToFacebookCSV(data: GoogleMapsData): string {
   const rows: FacebookRow[] = [];
   
   for (const item of data.items) {
     // Skip items without phone numbers
     if (!item.phone_numbers || item.phone_numbers.length === 0) {
       continue;
     }
     
     // Process each phone number as a separate row
     for (const phone of item.phone_numbers) {
       const formattedPhone = formatPhoneToE164(phone);
       if (!formattedPhone) continue;
       
       const { fn, ln } = extractNames(item.name);
       
       rows.push({
         phone: formattedPhone,
         fn: fn.toLowerCase(),
         ln: ln.toLowerCase(),
         ct: (item.city || '').toLowerCase(),
         st: getStateCode(item.state).toLowerCase(),
         zip: cleanZipCode(item.zip_code),
         country: (item.country_code || 'BR').toLowerCase(),
       });
     }
   }
   
   // Generate CSV
   const headers = ['phone', 'fn', 'ln', 'ct', 'st', 'zip', 'country'];
   const csvLines = [
     headers.join(','),
     ...rows.map(row => 
       headers.map(h => {
         const value = row[h as keyof FacebookRow];
         // Escape commas and quotes in values
         if (value.includes(',') || value.includes('"')) {
           return `"${value.replace(/"/g, '""')}"`;
         }
         return value;
       }).join(',')
     )
   ];
   
   return csvLines.join('\n');
 }
 
 /**
  * Stats about the conversion
  */
 export interface ConversionStats {
   totalItems: number;
   itemsWithPhone: number;
   totalPhones: number;
   skippedNoPhone: number;
   skippedInvalidPhone: number;
 }
 
 export function getConversionStats(data: GoogleMapsData): ConversionStats {
   let itemsWithPhone = 0;
   let totalPhones = 0;
   let skippedInvalidPhone = 0;
   
   for (const item of data.items) {
     if (item.phone_numbers && item.phone_numbers.length > 0) {
       itemsWithPhone++;
       for (const phone of item.phone_numbers) {
         const formatted = formatPhoneToE164(phone);
         if (formatted) {
           totalPhones++;
         } else {
           skippedInvalidPhone++;
         }
       }
     }
   }
   
   return {
     totalItems: data.items.length,
     itemsWithPhone,
     totalPhones,
     skippedNoPhone: data.items.length - itemsWithPhone,
     skippedInvalidPhone,
   };
 }
 
 /**
  * Downloads the CSV as a file
  */
 export function downloadCSV(csvContent: string, filename: string = 'facebook-custom-audience.csv'): void {
   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.setAttribute('href', url);
   link.setAttribute('download', filename);
   link.style.visibility = 'hidden';
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
   URL.revokeObjectURL(url);
 }