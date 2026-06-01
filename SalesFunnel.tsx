import { Upload } from "lucide-react";
import { useRef } from "react";

export function FileUpload({ onFile }: { onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium glass hover:glow transition-all"
      >
        <Upload size={14} /> Importar planilha
      </button>
    </>
  );
}
