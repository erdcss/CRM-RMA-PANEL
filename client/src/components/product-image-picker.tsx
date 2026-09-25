import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fileToCompressedDataUrl } from "@/lib/compress-image";
import { apiRequest } from "@/lib/queryClient";

interface ProductImagePickerProps {
  imageUrl?: string;
  onChange: (url: string | undefined) => void;
  testId?: string;
}

async function uploadImage(dataUrl: string): Promise<string> {
  const res = await apiRequest("POST", "/api/uploads", { dataUrl });
  const payload = await res.json();
  if (!payload?.url) {
    throw new Error("Görsel kaydedilemedi");
  }
  return payload.url as string;
}

export function ProductImagePicker({ imageUrl, onChange, testId }: ProductImagePickerProps) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sourceDataUrl, setSourceDataUrl] = useState<string>();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);

    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setSourceDataUrl(dataUrl);
      onChange(dataUrl);

      try {
        const uploadedUrl = await uploadImage(dataUrl);
        onChange(uploadedUrl);
      } catch (uploadError) {
        toast({
          title: "Görsel hazır",
          description: "Önizleme eklendi. Sunucuya yükleme başarısız oldu; fiş kaydedilirken tekrar denenecek.",
        });
        if (uploadError instanceof Error && uploadError.message.includes("Giriş")) {
          throw uploadError;
        }
      }
    } catch (error) {
      onChange(undefined);
      toast({
        title: "Görsel eklenemedi",
        description: error instanceof Error ? error.message : "Lütfen tekrar deneyin",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const prepareImage = async () => {
    if (!sourceDataUrl) return;
    setPreparing(true);
    try {
      const mime = sourceDataUrl.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg";
      const response = await fetch("/api/product-ai/prepare-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl: sourceDataUrl, mime }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Görsel hazırlanamadı.");
      if (!body.imageData) throw new Error("Görsel servisi boş yanıt döndürdü.");
      onChange(body.imageData);
      const uploadedUrl = await uploadImage(body.imageData);
      onChange(uploadedUrl);
      setSourceDataUrl(body.imageData);
    } catch (error) {
      toast({
        title: "AI görsel hazırlama başarısız",
        description: error instanceof Error ? error.message : "Görsel değiştirilemedi.",
        variant: "destructive",
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="col-span-1 space-y-2">
      <label className="text-sm font-medium block">Ürün görseli</label>
      {imageUrl ? (
        <div className="flex items-start gap-3">
          <img
            src={imageUrl}
            alt="Ürün görseli"
            className="h-24 w-24 rounded-md object-cover border bg-muted"
          />
          <div className="flex flex-col gap-2">
            {(uploading || preparing) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {preparing ? "Arka plan hazırlanıyor..." : "Yükleniyor..."}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void prepareImage()}
              disabled={uploading || preparing || !sourceDataUrl}
            >
              {preparing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Beyaz arka planla hazırla
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSourceDataUrl(undefined);
                onChange(undefined);
              }}
              disabled={uploading || preparing}
              data-testid={testId ? `${testId}-remove` : undefined}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Kaldır
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            id={testId ? `${testId}-camera-input` : undefined}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryInputRef}
            id={testId ? `${testId}-gallery-input` : undefined}
            type="file"
            accept="image/*,.heic,.heif"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || preparing}
            onClick={() => cameraInputRef.current?.click()}
            data-testid={testId ? `${testId}-camera` : undefined}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Fotoğraf çek
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || preparing}
            onClick={() => galleryInputRef.current?.click()}
            data-testid={testId ? `${testId}-gallery` : undefined}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            Galeriden seç
          </Button>
        </div>
      )}
    </div>
  );
}
