import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  title?: string;
  expectedValue?: string | null;
  onClose: () => void;
  onScanned: (value: string) => void;
};

export function BarcodeScannerModal({
  open,
  title = "Barkodu Tara",
  expectedValue,
  onClose,
  onScanned,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setManual("");
      setCameraError(null);
      return;
    }

    let cancelled = false;
    let raf = 0;

    const start = async () => {
      if (!("BarcodeDetector" in window)) {
        setCameraError("Tarayıcı kamera taramasını desteklemiyor. Manuel girin veya USB okuyucu kullanın.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0].rawValue?.trim();
              if (value) {
                onScanned(value);
                return;
              }
            }
          } catch {
            // ignore frame errors
          }
          raf = requestAnimationFrame(tick);
        };
        setScanning(true);
        raf = requestAnimationFrame(tick);
      } catch {
        setCameraError("Kamera açılamadı. Manuel giriş veya USB barkod okuyucu kullanın.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setScanning(false);
    };
  }, [open, onScanned]);

  const submitManual = () => {
    const value = manual.trim();
    if (!value) return;
    onScanned(value);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!cameraError ? (
            <div className="relative aspect-video rounded-md overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {scanning ? (
                <div className="absolute inset-0 border-2 border-primary/60 m-6 rounded-md pointer-events-none" />
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground flex gap-2">
              <Camera className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {expectedValue ? (
            <p className="text-xs text-muted-foreground font-mono break-all">
              Beklenen: {expectedValue}
            </p>
          ) : null}

          <Input
            placeholder="Barkod / QR değeri..."
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitManual();
              }
            }}
            className="font-mono"
            autoFocus={Boolean(cameraError)}
          />
          <Button className="w-full" onClick={submitManual}>
            Doğrula
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
