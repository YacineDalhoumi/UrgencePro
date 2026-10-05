import * as React from 'react'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/primitives'
import { copyText } from '@/lib/utils'

/** Export CSV : dans l'application réelle, téléchargement CSV / Excel. Ici, aperçu + copie. */
export function CsvExport({ filename, build, label = 'Exporter' }: { filename: string; build: () => string; label?: string }) {
  const [open, setOpen] = React.useState(false)
  const [csv, setCsv] = React.useState('')
  const ref = React.useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <Button
        onClick={() => {
          setCsv(build())
          setOpen(true)
        }}
      >
        <Download /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Export ${filename}`} description="Format CSV (séparateur point-virgule, compatible Excel). Dans l’application, le fichier se télécharge directement ; ici, copiez-le." wide>
        <textarea ref={ref} id="csv-export" readOnly value={csv} className="h-72 w-full rounded border border-border bg-sunken p-3 font-mono text-[12px]" />
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            onClick={async () => {
              if (await copyText(csv)) toast.success('CSV copié dans le presse-papiers')
              else {
                ref.current?.select()
                toast('Texte sélectionné : copiez-le avec Ctrl+C')
              }
            }}
          >
            <Copy /> Copier le CSV
          </Button>
        </div>
      </Dialog>
    </>
  )
}
