import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
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

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);

    try {
      const dataUrl = await fileToCompressedDataUrl(file);
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

  return (
    <div className="col-span-1 sm:col-span-2 space-y-2">
      <label className="text-sm font-medium block">Ürün görseli</label>
      {imageUrl ? (
        <div className="flex items-start gap-3">
          <img
            src={imageUrl}
            alt="Ürün görseli"
            className="h-24 w-24 rounded-md object-cover border bg-muted"
          />
          <div className="flex flex-col gap-2">
            {uploading && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Yükleniyor...
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(undefined)}
              disabled={uploading}
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
            disabled={uploading}
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
            disabled={uploading}
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
