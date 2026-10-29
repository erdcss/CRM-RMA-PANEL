import { DragEvent, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileText,
  Globe2,
  ImagePlus,
  Percent,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fileToCompressedDataUrl } from "@/lib/compress-image";
import {renderCataloguePdf,type SourceImageBox} from "@/lib/pdf-catalog-pages";

type ImportVariant = {
  name: string;
  value: string;
  sku: string;
  barcode: string;
  price: number | null;
  stock: number | null;
};

type ImageMatchStatus = "idle" | "searching" | "verified" | "review" | "not_found";

type ImportRow = {
  key: string;
  selected: boolean;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  sourcePrice: string;
  price: string;
  stock: string;
  minOrderQty: string;
  unitsPerBox: string;
  collectionName: string;
  images: string[];
  imageStatus: ImageMatchStatus;
  imageConfidence: number | null;
  imageSourceUrl: string | null;
  imageReason: string;
  variants: ImportVariant[];
  sourceDocument?:string;
  sourcePage?:number;
  sourceImageReview?:boolean;
};

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

function descriptionWithProductCode(description: unknown, sku: unknown) {
  const code = String(sku || "").trim();
  const cleanDescription = String(description || "")
    .split("\n")
    .filter((line) => !/^ürün\s*kodu\s*:/i.test(line.trim()))
    .join("\n")
    .trim();

  if (!code) return cleanDescription;
  return cleanDescription
    ? `Ürün Kodu: ${code}\n${cleanDescription}`
    : `Ürün Kodu: ${code}`;
}

function priceWithProfit(source: unknown, percent: number) {
  const value = Number(source);
  if (!Number.isFinite(value)) return "";
  const safePercent = Math.min(500, Math.max(0, Number(percent) || 0));
  return (Math.round(value * (1 + safePercent / 100) * 100) / 100).toFixed(2);
}

function variantsFromAi(product: any): ImportVariant[] {
  const variants: ImportVariant[] = [];

  if (product?.color) {
    variants.push({
      name: "Renk",
      value: String(product.color),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  if (product?.size) {
    variants.push({
      name: "Beden / Ölçü",
      value: String(product.size),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  if (product?.variant && !product?.color && !product?.size) {
    variants.push({
      name: "Varyant",
      value: String(product.variant),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  return variants;
}


type ExistingCatalogProduct = {
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  brand?: string | null;
  images?: string[] | string | null;
  image_data?: string | null;
};

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR");
}

function firstCatalogImage(item: ExistingCatalogProduct): string | null {
  let images: unknown = item.images;
  if (typeof images === "string") {
    try { images = JSON.parse(images); } catch { images = []; }
  }
  const candidates = [...(Array.isArray(images) ? images : []), item.image_data];
  const result = candidates.find((value) => {
    if (typeof value !== "string") return false;
    const url = value.toLowerCase();
    return url.startsWith("data:image/png;base64,") ||
      url.startsWith("data:image/jpeg;base64,") ||
      url.startsWith("data:image/webp;base64,") ||
      url.startsWith("https://") || url.startsWith("http://") ||
      (url.startsWith("/") && !url.startsWith("//"));
  });
  return typeof result === "string" ? result : null;
}

// Reuse only an unambiguous product photo; a guessed match is worse than no photo.
function matchCatalogImage(row: ImportRow, catalog: ExistingCatalogProduct[]) {
  const barcode = normalizeIdentifier(row.barcode);
  const sku = normalizeIdentifier(row.sku);
  const name = normalizeIdentifier(row.name);
  const brand = normalizeIdentifier(row.brand);
  const barcodeMatches = barcode.length >= 8
    ? catalog.filter((item) => normalizeIdentifier(item.barcode) === barcode) : [];
  const skuMatches = sku
    ? catalog.filter((item) => normalizeIdentifier(item.sku) === sku) : [];
  const nameMatches = name && brand
    ? catalog.filter((item) =>
        normalizeIdentifier(item.name) === name &&
        normalizeIdentifier(item.brand) === brand) : [];
  const matches = barcodeMatches.length ? barcodeMatches
    : skuMatches.length ? skuMatches : nameMatches;
  if (matches.length !== 1) return null;
  const matched = matches[0];
  if (brand && matched.brand && normalizeIdentifier(matched.brand) !== brand) return null;
  if (barcode && matched.barcode && normalizeIdentifier(matched.barcode) !== barcode) return null;
  return firstCatalogImage(matched);
}

export default function AdminProductAiImport() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [profitPercent, setProfitPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [analysisProgress,setAnalysisProgress]=useState("");
  const [analysisWarnings,setAnalysisWarnings]=useState<string[]>([]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const waitingImageCount = selectedRows.filter((row) => row.images.length === 0).length;

  function updateRow<K extends keyof ImportRow>(key:string, field:K, value:ImportRow[K]) {
    setRows((current)=>current.map(row=>row.key===key?{...row,[field]:value}:row));
  }

  async function setRowImage(key:string,file?:File) {
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)) {
      toast({title:"PNG, JPEG veya WebP görsel seçin",variant:"destructive"});return;
    }
    try {
      const image=await fileToCompressedDataUrl(file);
      setRows(current=>current.map(row=>row.key===key?{
        ...row,images:[image],imageStatus:"verified" as const,
        imageConfidence:1,imageSourceUrl:null,imageReason:"Görsel manuel olarak eklendi.",
      }:row));
    } catch(error) {
      toast({title:"Görsel eklenemedi",description:error instanceof Error?error.message:"Tekrar deneyin",variant:"destructive"});
    }
  }

  function addFiles(incoming: File[]) {
    const accepted = incoming.filter(
      (file) => allowedTypes.has(file.type) && file.size <= 10 * 1024 * 1024,
    );
    const rejected = incoming.length - accepted.length;
    setFiles((current) => [...current, ...accepted].slice(0, 12));

    if (rejected > 0) {
      toast({
        title: "Bazı dosyalar eklenmedi",
        description: "Yalnızca PDF, PNG ve JPEG; dosya başına en fazla 10 MB desteklenir.",
        variant: "destructive",
      });
    }
  }

  function applyProfitPercent(nextPercent: number) {
    const safePercent = Math.min(500, Math.max(0, Number(nextPercent) || 0));
    setProfitPercent(safePercent);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        price: row.sourcePrice
          ? priceWithProfit(row.sourcePrice, safePercent)
          : row.price,
      })),
    );
  }

  async function findWebImages(targetRows: ImportRow[]) {
    const missing = targetRows.filter((row) => row.images.length === 0);
    if (!missing.length) {
      return {
        found: 0,
        unresolved: 0,
        imagesByKey: {} as Record<string, string>,
      };
    }

    const missingKeys = new Set(missing.map((row) => row.key));
    setRows((current) =>
      current.map((row) =>
        missingKeys.has(row.key)
          ? {
              ...row,
              imageStatus: "searching" as const,
              imageReason: "Görselleri Çek işlemi çalışıyor…",
              imageSourceUrl: null,
            }
          : row,
      ),
    );

    setImageSearching(true);

    const imagesByKey: Record<string, string> = {};
    const statusByKey = new Map<
      string,
      {
        confidence: number | null;
        reason: string;
        found: boolean;
      }
    >();

    try {
      const chunks: ImportRow[][] = [];
      for (let index = 0; index < missing.length; index += 40) {
        chunks.push(missing.slice(index, index + 40));
      }

      for (let index = 0; index < chunks.length; index += 3) {
        const group = chunks.slice(index, index + 3);
        const results = await Promise.all(
          group.map(async (chunk) => {
            const response = await apiRequest(
              "POST",
              "/api/product-ai/find-images",
              {
                attempt: 0,
                products: chunk.map((row) => ({
                  key: row.key,
                  sku: row.sku,
                  barcode: row.barcode,
                  name: row.name,
                  brand: row.brand,
                  category: row.category,
                  description: row.description,
                  attributes: row.variants
                    .map((variant) => `${variant.name}: ${variant.value}`)
                    .filter(Boolean)
                    .join(", "),
                })),
              },
            );

            return response.json() as Promise<{
              matches?: Array<{
                key: string;
                imageData?: string | null;
                confidence?: number;
                status?: "verified" | "review" | "not_found";
                reason?: string;
              }>;
            }>;
          }),
        );

        for (const result of results) {
          for (const match of result.matches || []) {
            const validImage =
              match.status === "verified" &&
              typeof match.imageData === "string" &&
              match.imageData.startsWith("data:image/");

            if (validImage) {
              imagesByKey[match.key] = match.imageData as string;
            }

            statusByKey.set(match.key, {
              found: validImage,
              confidence:
                typeof match.confidence === "number"
                  ? match.confidence
                  : null,
              reason:
                match.reason ||
                (validImage
                  ? "İlk geçerli görsel otomatik eklendi."
                  : "Görsel bulunamadı."),
            });
          }
        }

        // Show images immediately as soon as each request group finishes.
        setRows((current) =>
          current.map((row) => {
            const image = imagesByKey[row.key];
            if (image && row.images.length === 0) {
              const status = statusByKey.get(row.key);
              return {
                ...row,
                images: [image],
                imageStatus: "verified" as const,
                imageConfidence: status?.confidence ?? 0.9,
                imageSourceUrl: null,
                imageReason:
                  status?.reason ||
                  "Ürün adıyla bulunan ilk görsel otomatik eklendi.",
              };
            }
            return row;
          }),
        );
      }

      setRows((current) =>
        current.map((row) => {
          if (!missingKeys.has(row.key) || row.images.length > 0) return row;
          const image = imagesByKey[row.key];
          if (image) {
            const status = statusByKey.get(row.key);
            return {
              ...row,
              images: row.images.length ? row.images : [image],
              imageStatus: "verified" as const,
              imageConfidence: status?.confidence ?? 0.9,
              imageSourceUrl: null,
              imageReason:
                status?.reason ||
                "Ürün adıyla bulunan ilk görsel otomatik eklendi.",
            };
          }

          return {
            ...row,
            imageStatus: "not_found" as const,
            imageConfidence: null,
            imageSourceUrl: null,
            imageReason: "Ürün adıyla görsel bulunamadı.",
          };
        }),
      );

      const found = Object.keys(imagesByKey).length;
      const unresolved = missing.length - found;

      toast({
        title:
          unresolved === 0
            ? "Tüm ürün görselleri eklendi"
            : `${found} ürüne görsel eklendi`,
        description:
          unresolved > 0
            ? `${unresolved} ürün için görsel bulunamadı; ürünler yine de içe aktarılabilir.`
            : "Listedeki tüm ürünlerin görselleri hazır.",
      });

      return { found, unresolved, imagesByKey };
    } catch (error) {
      setRows((current) =>
        current.map((row) =>
          missingKeys.has(row.key) && row.images.length === 0
            ? {
                ...row,
                imageStatus: "not_found" as const,
                imageReason: "Görsel araması tamamlanamadı.",
                imageSourceUrl: null,
              }
            : row,
        ),
      );

      toast({
        title: "Görsel araması tamamlanamadı",
        description:
          "Ürün listesi korunuyor; tüm ürünleri yine de içe aktarabilirsiniz.",
      });

      return {
        found: Object.keys(imagesByKey).length,
        unresolved: missing.length - Object.keys(imagesByKey).length,
        imagesByKey,
      };
    } finally {
      setImageSearching(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  }

  async function extractFileWithRetry(file: File, source?:{dataUrl:string;mime:string;name:string}) {
    const dataUrl = source?.dataUrl || await fileToDataUrl(file);
    const mime=source?.mime || file.type;
    const name=source?.name || file.name;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/product-ai/extract", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            mime,
            dataUrl,
          }),
        });

        const payload = await response.json().catch(() => ({})) as {
          products?: any[];
          expectedCount?:number;
          error?: string;
          retryable?: boolean;
        };

        if (response.ok) return payload;

        lastError = new Error(
          payload.error || `AI analizi başarısız oldu (HTTP ${response.status})`,
        );

        const canRetry =
          attempt === 0 &&
          (
            payload.retryable === true ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          );

        if (!canRetry) throw lastError;

        toast({
          title: "AI analizi yeniden deneniyor",
          description: `${file.name} için geçici hata oluştu. Otomatik ikinci deneme yapılıyor.`,
        });

        await new Promise((resolve) => window.setTimeout(resolve, 900));
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("AI belge analizi tamamlanamadı");

        if (attempt === 1) throw lastError;
      }
    }

    throw lastError || new Error("AI belge analizi tamamlanamadı");
  }

  async function analyze() {
    if(!files.length)return;
    setAnalyzing(true);
    setAnalysisProgress('');
    setAnalysisWarnings([]);
    const extracted:ImportRow[]=[];
    const failedFiles:Array<{name:string;message:string}>=[];
    const warnings:string[]=[];
    const hasPdf=files.some(f=>f.type==="application/pdf");

    function appendProducts(products:any[],file:File,pageNumber:number,
      crop:(box:SourceImageBox)=>string|null,originalImage:string|null=null){
      for(const product of products){
        const box=product.sourceImageBox as SourceImageBox|null;
        const cropped=box?crop(box):null;
        const automaticImage=cropped||(products.length===1?originalImage:null);
        const sku=String(product.sku||product.barcode||"").trim();
        const price=product.salePrice??product.purchasePrice;
        const sourcePrice=price==null?"":String(price);
        const fromList=!!cropped&&file.type==="application/pdf";
        extracted.push({
          key:crypto.randomUUID(),selected:true,sku,
          barcode:String(product.barcode||""),
          name:String(product.name||""),brand:String(product.brand||""),
          category:String(product.category||""),
          description:descriptionWithProductCode(product.description,sku),
          sourcePrice,price:sourcePrice?priceWithProfit(sourcePrice,profitPercent):"",
          stock:product.stock==null?"0":String(product.stock),
          minOrderQty:product.minimumOrderQuantity==null?"1":String(product.minimumOrderQuantity),
          unitsPerBox:product.unitsPerBox==null?"":String(product.unitsPerBox),
          collectionName:"",images:automaticImage?[automaticImage]:[],
          imageStatus:automaticImage?"verified":"idle",
          imageConfidence:fromList?0.85:automaticImage?1:null,
          imageSourceUrl:null,
          imageReason:fromList
            ?"Yüklenen listenin "+pageNumber+". sayfasından alındı. Eşleşmeyi kontrol edin."
            :automaticImage?"Yüklenen belgeden doğrudan alındı.":"",
          variants:variantsFromAi(product),
          sourceDocument:file.name,sourcePage:pageNumber,
          sourceImageReview:fromList,
        });
      }
    }
    try{
      for(const file of files){
        try{
          if(file.type==="application/pdf"){
            let pageCount=0;
            for await (const page of renderCataloguePdf(file)){
              pageCount++;
              setAnalysisProgress(file.name+": "+page.pageNumber+"/"+page.totalPages+" sayfa");
              try{
                const result=await extractFileWithRetry(file,{
                  dataUrl:page.dataUrl,mime:"image/jpeg",
                  name:file.name+" - sayfa "+page.pageNumber
                });
                appendProducts(result.products||[],file,page.pageNumber,page.crop);
                if(typeof result.expectedCount==="number"&&
                  result.expectedCount!==(result.products||[]).length){
                  warnings.push(file.name+" · Sayfa "+page.pageNumber+": "+
                    result.expectedCount+" ürün hücresi görüldü, "+
                    (result.products||[]).length+" ürün çıkarıldı. Kontrol edin.");
                }
              }catch(error){
                warnings.push(file.name+" · "+page.pageNumber+". sayfa çözümlenemedi: "+
                  (error instanceof Error?error.message:"Tekrar deneyin")+
                  ". Diğer sayfalar korunuyor; eksik sayfayı yeniden analiz edin.");
              }
            }
            if(!pageCount)warnings.push(file.name+": İşlenecek sayfa bulunamadı.");
          }else{
            setAnalysisProgress(file.name+" analiz ediliyor");
            const result=await extractFileWithRetry(file);
            const originalImage=file.type.startsWith("image/")?
              await fileToCompressedDataUrl(file):null;
            appendProducts(result.products||[],file,1,()=>null,originalImage);
            if(typeof result.expectedCount==="number"&&
              result.expectedCount!==(result.products||[]).length){
              warnings.push(file.name+": "+result.expectedCount+" ürün hücresi görüldü, "+
                (result.products||[]).length+" ürün çıkarıldı.");
            }
          }
        }catch(error){
          failedFiles.push({name:file.name,message:error instanceof Error?error.message:"Analiz başarısız"});
        }
      }
      if(!extracted.length)throw Error(failedFiles[0]?.message||"Hiçbir ürün çıkarılamadı.");

      // Products with same model and different colours remain distinct.
      const occurrences=new Map<string,number>();
      for(const row of extracted){
        const code=normalizeIdentifier(row.sku);
        if(code)occurrences.set(code,(occurrences.get(code)||0)+1);
      }
      const serial=new Map<string,number>();
      for(const row of extracted){
        const code=normalizeIdentifier(row.sku);
        if(!code||occurrences.get(code)===1)continue;
        const count=(serial.get(code)||0)+1;serial.set(code,count);
        const variant=row.variants.find(v=>v.name==="Renk")?.value||"";
        const suffix=variant.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
          .replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,12);
        row.sku=row.sku+"-"+(suffix||"V")+count;
        row.description=descriptionWithProductCode(row.description,row.sku);
        warnings.push(row.name+": Aynı modelin varyantı için ayrı stok kodu oluşturuldu; kontrol edin.");
      }

      let prepared=extracted;
      try{
        const response=await fetch("/api/admin/b2b-products",{credentials:"include",cache:"no-store"});
        if(response.ok){
          const catalog:unknown=await response.json();
          if(Array.isArray(catalog)){
            prepared=extracted.map(row=>{
              if(row.images.length)return row;
              const photo=matchCatalogImage(row,catalog as ExistingCatalogProduct[]);
              return photo?{...row,images:[photo],imageStatus:"verified" as const,
                imageConfidence:1,imageSourceUrl:null,
                imageReason:"Mevcut katalogdaki birebir eşleşen ürünün görseli alındı."}:row;
            });
          }
        }
      }catch{/* Optional exact catalog match. */}
      setRows(prepared);
      setAnalysisWarnings([...warnings,...failedFiles.map(f=>f.name+": "+f.message)]);
      const missing=prepared.filter(row=>!row.images.length).length;
      toast({title:prepared.length+" ürün analiz edildi",
        description:missing
          ?missing+" ürün için kaynak görseli bulunamadı; görsel eklenmeden kaydedilemez."
          :"Listedeki görseller ürün kartlarına alındı. Onay ekranını kontrol edin."});
      // PDF image mismatches must not silently become unrelated web photos.
      if(!hasPdf&&missing)void findWebImages(prepared);
    }catch(error){
      toast({title:"Belge analiz edilemedi",
        description:error instanceof Error?error.message:"Bilinmeyen hata",
        variant:"destructive"});
    }finally{
      setAnalysisProgress("");
      setAnalyzing(false);
    }
  }

  async function saveApproved() {
    if (!selectedRows.length || imageSearching) return;

    const missingCoreFields = selectedRows.filter(
      (row) =>
        !row.sku.trim() ||
        !row.name.trim() ||
        !Number.isFinite(Number(row.price || 0)) ||
        Number(row.price) <= 0 ||
        !Number.isSafeInteger(Number(row.unitsPerBox)) ||
        Number(row.unitsPerBox) < 1,
    );

    if (missingCoreFields.length > 0) {
      toast({
        title: "Eksik ürün bilgisi var",
        description:
          "Stok kodu, ürün adı, pozitif fiyat ve koli içi adet zorunludur. Belgede olmayan koli bilgisini kaydetmeden önce tamamlayın.",
        variant: "destructive",
      });
      return;
    }

    const withoutImages = selectedRows.filter((row) => row.images.length === 0);
    if (withoutImages.length > 0) {
      toast({
        title: "Ürün görselleri eksik",
        description: withoutImages.length + " ürün için görsel bulunamadı. Görselleri Çek ile tekrar deneyin veya görselleri elle ekleyin.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest("POST", "/api/admin/b2b-products/bulk", {
        allowMissingImages: false,
        products: selectedRows.map((row) => ({
          sku: row.sku.trim(),
          barcode: row.barcode.trim(),
          name: row.name.trim(),
          brand: row.brand.trim(),
          category: row.category.trim(),
          description: descriptionWithProductCode(row.description, row.sku),
          price: Number(row.price || 0),
          stock: Number(row.stock || 0),
          minOrderQty: Number(row.minOrderQty || 1),
          unitsPerBox: Number(row.unitsPerBox || 1),
          collectionName: row.collectionName.trim(),
          images: row.images,
          variants: row.variants,
        })),
      });

      const result = await response.json() as { count?: number };
      const saved = Number(result.count || selectedRows.length);
      const savedKeys = new Set(selectedRows.map((row) => row.key));
      const remaining = rows.filter((row) => !savedKeys.has(row.key));

      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/b2b-products"],
      });

      setRows(remaining);
      if (!remaining.length) setFiles([]);

      toast({
        title: `${saved} ürün içe aktarıldı`,
        description:
          "Seçili ürünlerin tamamı B2B kataloğuna aktarıldı.",
      });
    } catch (error) {
      toast({
        title: "Ürün aktarımı tamamlanamadı",
        description:
          error instanceof Error
            ? error.message
            : "Ürün kaydetme sırasında hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/urunler"
              className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <Sparkles className="h-6 w-6" /> AI ile Ürün İçeri Aktar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, PNG veya JPEG dosyalarındaki ürünleri çıkarın, görselleri tamamlayın ve toplu olarak onaylayın.
            </p>
          </div>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`rounded-2xl border-2 border-dashed bg-background p-8 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="mt-3 font-semibold">Dosyaları buraya sürükleyip bırakın</div>
          <div className="mt-1 text-sm text-muted-foreground">
            PDF, PNG, JPEG · Dosya başına en fazla 10 MB
          </div>

          <label className="mt-4 inline-block">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(event) => addFiles(Array.from(event.target.files || []))}
            />
            <span className="inline-flex h-10 cursor-pointer items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
              Dosya Seç
            </span>
          </label>
        </div>

        {files.length > 0 ? (
          <div className="mt-4 rounded-2xl border bg-background p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold">Yüklenecek dosyalar ({files.length})</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Dosyadaki birim fiyatlara uygulanacak kâr oranını analizden önce seçin.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Kâr</span>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={profitPercent}
                    onChange={(event) =>
                      applyProfitPercent(Number(event.target.value || 0))
                    }
                    className="h-8 w-20 bg-background text-right"
                  />
                  <span className="text-xs font-semibold">%</span>
                </div>

                {[0, 10, 15, 20, 25, 30, 40, 50].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyProfitPercent(percent)}
                    className={`h-8 rounded-md border px-2.5 text-xs font-semibold ${
                      profitPercent === percent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    %{percent}
                  </button>
                ))}

                <Button onClick={analyze} disabled={analyzing}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyzing ? (analysisProgress||"AI sayfaları analiz ediyor…") : "AI ile Analiz Et"}
                </Button>
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Örnek: dosyadaki fiyat 100,00 ₺ ve kâr oranı %20 ise satış birim fiyatı otomatik 120,00 ₺ olur.
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {file.type === "application/pdf" ? (
                      <FileText className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileImage className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) => current.filter((_, i) => i !== index))
                    }
                    className="rounded p-2 hover:bg-muted"
                    aria-label="Dosyayı kaldır"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {analysisWarnings.length>0&&(
          <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="font-semibold text-amber-950">Belge kontrol uyarıları ({analysisWarnings.length})</div>
            <p className="mt-1 text-xs text-amber-900">Eksik sayfa, varyant veya kaynak görseli için içe aktarmadan önce doğrulama yapın.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {analysisWarnings.slice(0,30).map((warning,index)=><li key={index}>{warning}</li>)}
            </ul>
          </div>
        )}
        {rows.length > 0 ? (
          <div className="mt-6 rounded-2xl border bg-background shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-bold">AI tarafından bulunan ürünler</div>
                <div className="text-sm text-muted-foreground">
                  PDF dosyalarının tüm sayfaları okunur. Ürün fotoğrafları önce aynı PDF sayfasındaki ilgili hücreden alınır; görselleri ve ürün bilgilerini onaylamadan kaydetmeyin. Eksik görseli elle ekleyebilir veya isteğe bağlı “Görselleri Çek” kullanabilirsiniz.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void findWebImages(rows)}
                  disabled={imageSearching || !rows.some((row) => row.images.length === 0)}
                >
                  <Globe2 className="mr-2 h-4 w-4" />
                  {imageSearching ? "Görseller çekiliyor…" : "Görselleri Çek"}
                </Button>
                <Button
                  onClick={saveApproved}
                  disabled={saving || analyzing || imageSearching || !selectedRows.length}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {saving
                    ? "Kaydediliyor…"
                    : `Tüm Seçili Ürünleri İçe Aktar (${selectedRows.length})`}
                </Button>
              </div>
            </div>

            {selectedRows.length > 0 ? (
              <div className="border-b bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {selectedRows.length} ürün seçili
                {waitingImageCount > 0
                  ? ` · ${waitingImageCount} üründe görsel yok`
                  : " · tüm görseller hazır"}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[2360px] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-3">Onay</th>
                    <th className="w-[180px] px-3 py-3">Görsel *</th>
                    <th className="w-[190px] px-3 py-3">Stok kodu *</th>
                    <th className="w-[210px] px-3 py-3">Barkod</th>
                    <th className="w-[390px] px-3 py-3">Ürün adı *</th>
                    <th className="w-[240px] px-3 py-3">Marka</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Fiyat *</th>
                    <th className="px-3 py-3">Stok</th>
                    <th className="px-3 py-3">Min.</th>
                    <th className="px-3 py-3">Koli içi</th>
                    <th className="px-3 py-3">Koleksiyon</th>
                    <th className="w-12 px-3 py-3"></th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.key} className={row.selected ? "" : "opacity-50"}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            updateRow(row.key, "selected", event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <div className="min-w-[155px]">
                          <label className="block w-fit cursor-pointer">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(event) => {
                                void setRowImage(row.key, event.target.files?.[0]);
                                event.currentTarget.value = "";
                              }}
                            />
                            {row.images[0] ? (
                              <img
                                src={row.images[0]}
                                alt=""
                                className="h-14 w-14 rounded-lg border bg-white object-contain"
                              />
                            ) : (
                              <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700">
                                {row.imageStatus === "searching" ? (
                                  <Sparkles className="h-4 w-4 animate-pulse" />
                                ) : (
                                  <ImagePlus className="h-4 w-4" />
                                )}
                              </span>
                            )}
                          </label>

                          {!!row.sourceDocument&&(
                            <div className="mt-1 text-[10px] text-muted-foreground" title={row.sourceDocument}>
                              {row.sourcePage ? "Kaynak PDF sayfa "+row.sourcePage : "Yüklenen belge"}
                              {row.sourceImageReview?" · Görseli kontrol edin":""}
                            </div>
                          )}
                          <div className="mt-1.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.imageStatus === "verified"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : row.imageStatus === "searching"
                                    ? "bg-blue-50 text-blue-700"
                                    : row.imageStatus === "review"
                                      ? "bg-amber-50 text-amber-700"
                                      : row.imageStatus === "not_found"
                                        ? "bg-rose-50 text-rose-700"
                                        : "bg-slate-100 text-slate-500"
                              }`}
                              title={row.imageReason}
                            >
                              {row.imageStatus === "verified"
                                ? `Görsel eklendi${row.imageConfidence != null ? ` %${Math.round(row.imageConfidence * 100)}` : ""}`
                                : row.imageStatus === "searching"
                                  ? "Görsel çekiliyor"
                                  : row.imageStatus === "review"
                                    ? "Görsel çekiliyor"
                                    : row.imageStatus === "not_found"
                                      ? "Görsel yok"
                                      : "Görsel yok"}
                            </span>
                          </div>


                        </div>
                      </td>

                      <Cell>
                        <Input
                          value={row.sku}
                          title={row.sku}
                          className="min-w-[170px]"
                          onChange={(e) => {
                            const nextSku = e.target.value;
                            setRows((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? {
                                      ...item,
                                      sku: nextSku,
                                      description: descriptionWithProductCode(
                                        item.description,
                                        nextSku,
                                      ),
                                    }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.barcode}
                          title={row.barcode}
                          className="min-w-[190px]"
                          onChange={(e) => updateRow(row.key, "barcode", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.name}
                          title={row.name}
                          className="min-w-[360px]"
                          onChange={(e) => updateRow(row.key, "name", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.brand}
                          title={row.brand}
                          className="min-w-[220px]"
                          onChange={(e) => updateRow(row.key, "brand", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.category}
                          onChange={(e) => updateRow(row.key, "category", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <div className="min-w-[130px]">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.price}
                            onChange={(e) => updateRow(row.key, "price", e.target.value)}
                          />
                          {row.sourcePrice ? (
                            <div className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
                              Kaynak {Number(row.sourcePrice).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ₺ · +%{profitPercent}
                            </div>
                          ) : null}
                        </div>
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="0"
                          value={row.stock}
                          onChange={(e) => updateRow(row.key, "stock", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="1"
                          value={row.minOrderQty}
                          onChange={(e) =>
                            updateRow(row.key, "minOrderQty", e.target.value)
                          }
                        />
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="1"
                          value={row.unitsPerBox}
                          onChange={(e) =>
                            updateRow(row.key, "unitsPerBox", e.target.value)
                          }
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.collectionName}
                          onChange={(e) =>
                            updateRow(row.key, "collectionName", e.target.value)
                          }
                        />
                      </Cell>

                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((current) =>
                              current.filter((item) => item.key !== row.key),
                            )
                          }
                          className="rounded p-2 hover:bg-muted"
                          aria-label="Satırı sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t p-4">
              <div className="text-xs font-medium text-muted-foreground">
                Açıklamalar
              </div>
              <div className="mt-2 space-y-2">
                {rows.map((row) => (
                  <div
                    key={`desc-${row.key}`}
                    className="grid gap-2 sm:grid-cols-[180px_1fr]"
                  >
                    <div className="truncate text-xs font-medium">
                      {row.name || row.sku || "Ürün"}
                    </div>
                    <Input
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.key, "description", e.target.value)
                      }
                      placeholder="Ürün açıklaması · ürün kodu otomatik eklenir"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
