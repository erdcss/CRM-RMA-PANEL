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
      const res = await apiRequest("POST", "/api/uploads", { dataUrl });
      const payload = await res.json();
      if (!payload?.url) {
        throw new Error("Görsel kaydedilemedi");
      }
      onChange(payload.url);
    } catch (error) {
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
            className="h-24 w-24 rounded-md object-cover border"
          />
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
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
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
