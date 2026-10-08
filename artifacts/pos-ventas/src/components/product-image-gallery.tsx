import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/components/image-upload";

interface ProductImageGalleryProps {
  value: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ProductImageGallery({ value, onChange, maxImages = 8 }: ProductImageGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (value.length + selected.length > maxImages) {
      setError(`Puedes guardar hasta ${maxImages} fotos por producto.`);
      return;
    }
    const invalidFile = selected.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setError("Selecciona únicamente archivos de imagen.");
      return;
    }
    const oversizedFile = selected.find((file) => file.size > 8 * 1024 * 1024);
    if (oversizedFile) {
      setError("Cada imagen debe pesar menos de 8 MB.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const compressed = await Promise.all(
        selected.map((file) => compressImage(file, 500, 500, 0.75)),
      );
      onChange([...value, ...compressed]);
    } catch {
      setError("No se pudieron procesar una o más imágenes.");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeImage = (index: number) => onChange(value.filter((_, imageIndex) => imageIndex !== index));

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((image, index) => (
          <div key={`${index}-${image.slice(0, 32)}`} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            <img src={image} alt={`Foto ${index + 1} del producto`} className="h-full w-full object-cover" />
            {index === 0 && (
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                <Star className="h-3 w-3" /> Principal
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-1 top-1 h-7 w-7"
              aria-label={`Eliminar foto ${index + 1}`}
              disabled={isProcessing}
              onClick={() => removeImage(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {value.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            {isProcessing ? <Upload className="h-5 w-5 animate-pulse" /> : <ImagePlus className="h-5 w-5" />}
            <span>{isProcessing ? "Procesando..." : "Agregar fotos"}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Selecciona varias imágenes a la vez. La primera será la foto principal. Máximo {maxImages} fotos.</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
