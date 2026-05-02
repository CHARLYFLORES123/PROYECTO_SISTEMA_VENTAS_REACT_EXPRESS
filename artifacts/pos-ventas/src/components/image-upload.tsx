import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (base64: string | null) => void;
  maxWidthPx?: number;
  maxHeightPx?: number;
  quality?: number;
  label?: string;
  className?: string;
}

function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const ratio = Math.min(maxW / width, maxH / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({
  value,
  onChange,
  maxWidthPx = 600,
  maxHeightPx = 600,
  quality = 0.75,
  label = "Subir imagen",
  className = "",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes (PNG, JPG, WEBP, GIF).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("El archivo no debe superar 8 MB.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const base64 = await compressImage(file, maxWidthPx, maxHeightPx, quality);
      onChange(base64);
    } catch {
      setError("Error al procesar la imagen.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />

      {value ? (
        <div className="flex items-start gap-3">
          {/* Preview */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={value}
                alt="Preview"
                className="max-w-full max-h-full object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
              title="Eliminar imagen"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Change button */}
          <div className="flex-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Cambiar imagen
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1.5">JPG, PNG, WEBP · máx. 8 MB</p>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Procesando imagen...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-[11px] mt-0.5">Arrastra o haz clic · JPG, PNG, WEBP · máx. 8 MB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
