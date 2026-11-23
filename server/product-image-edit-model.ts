/**
 * Keep image endpoints on supported Image API models.
 * GPT Image 1 was retired on 2026-10-23; do not silently retry that model.
 */
export const DEFAULT_PRODUCT_IMAGE_EDIT_MODEL="gpt-image-2.5-sunburst" as const;
const SUPPORTED_MODELS=new Set([
 "gpt-image-1.5","gpt-image-2","gpt-image-2.5-flare","gpt-image-2.5-sunburst",
 "gpt-image-2.6-flare","gpt-image-2.6-sunburst"
]);
export function productImageEditModel():string{
 const configured=String(process.env.OPENAI_IMAGE_EDIT_MODEL||"").trim();
 if(!configured)return DEFAULT_PRODUCT_IMAGE_EDIT_MODEL;
 if(SUPPORTED_MODELS.has(configured))return configured;
 // Do not let an old or typoed model name break the entire workflow.
 console.warn("Invalid OPENAI_IMAGE_EDIT_MODEL; using supported default model");
 return DEFAULT_PRODUCT_IMAGE_EDIT_MODEL;
}

export function userFacingImageEditError(error:unknown):{status:number;error:string;code:string}{
 const source=error as {status?:number;code?:string;message?:string};
 const status=Number(source?.status||0);
 const message=String(source?.message||"");
 if(status===401)return {status:503,code:"invalid_api_key",
  error:"AI görsel anahtarı geçersiz. Yönetim panelindeki sunucu/API bağlantısı kontrol edilmeli."};
 if(status===403)return {status:503,code:"access_denied",
  error:"OpenAI projesinin görsel düzenleme modeline erişimi yok. API organizasyon erişimini veya doğrulamasını kontrol edin."};
 if(status===429)return {status:429,code:"rate_limit",
  error:"AI görsel servisi kullanım veya bütçe limitine ulaştı. OpenAI API kota/bütçe ayarını kontrol edip tekrar deneyin."};
 if(status===400&&/model|does not exist|not found|unsupported/i.test(message))
  return {status:502,code:"invalid_image_model",
   error:"Görsel düzenleme modeli kullanılamıyor. Desteklenen model seçimini ve OpenAI API erişimini kontrol edin."};
 if(status===400)return {status:422,code:"image_request_rejected",
  error:"AI fotoğraf isteği kabul edilmedi. Kaynak fotoğraf biçimini ve model erişimini kontrol edin."};
 if(status===408||status===504||/timeout|timed out|AbortError/i.test(message))
  return {status:504,code:"image_timeout",
   error:"AI görsel işlemi zaman aşımına uğradı; orijinal fotoğraf değiştirilmedi."};
 if(status>=500)return {status:502,code:"image_service_unavailable",
  error:"AI görsel servisi geçici olarak yanıt vermiyor. Orijinal fotoğraf korundu."};
 return {status:502,code:"image_edit_failed",
  error:"AI görseli hazırlanamadı. Kaynak fotoğraf korundu; sunucu işlem kaydı kontrol edilebilir."};
}
