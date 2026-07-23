'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MapPin, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import barriosCaba from '@/data/barrios_caba.json'

interface CpRecord {
  id: number
  codigo: string
  nombre: string | null
  barrio: string | null
  latitud: string | null
  longitud: string | null
  localidadId: string | null
  localidad: {
    id: string
    nombre: string
    provinciaId: string
    provincia: { id: string; nombre: string }
  } | null
}

const formSchema = z.object({
  codigoPostal: z
    .string()
    .regex(/^\d{4}$/, 'El CP debe tener 4 dígitos'),
  calle: z.string().min(1, 'Ingresá la calle'),
  altura: z.string().min(1, 'Ingresá la altura'),
  barrio: z.string().optional(),
}).refine(
  (data) => {
    const cp = parseInt(data.codigoPostal, 10)
    if (cp >= 1000 && cp <= 1499) {
      return data.barrio && data.barrio.length > 0
    }
    return true
  },
  { message: 'Seleccioná tu barrio', path: ['barrio'] }
)

type FormValues = z.infer<typeof formSchema>

export function ShippingForm() {
  const [results, setResults] = useState<CpRecord[] | null>(null)
  const [selected, setSelected] = useState<CpRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const prevCpRef = useRef('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
    defaultValues: { codigoPostal: '', calle: '', altura: '', barrio: '' },
  })

  const codigoPostal = watch('codigoPostal')
  const cpNum = codigoPostal ? parseInt(codigoPostal, 10) : 0
  const isCaba = cpNum >= 1000 && cpNum <= 1499

  const fetchCp = useCallback(async (cp: string) => {
    if (cp.length !== 4 || !/^\d{4}$/.test(cp)) {
      setResults(null)
      setSelected(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)
    setSelected(null)

    try {
      const res = await fetch(`/api/cp/${cp}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Código postal no encontrado')
        } else {
          setError('Error al consultar el código postal')
        }
        return
      }
      const data: CpRecord[] = await res.json()
      setResults(data)

      if (data.length === 1) {
        setSelected(data[0])
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cp = codigoPostal ?? ''

    if (cp === prevCpRef.current) return
    prevCpRef.current = cp

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (cp.length === 4 && /^\d{4}$/.test(cp)) {
      debounceRef.current = setTimeout(() => fetchCp(cp), 300)
    } else {
      setResults(null)
      setSelected(null)
      setError(null)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [codigoPostal, fetchCp])

  const handleSelect = (index: string) => {
    if (!results) return
    const rec = results[parseInt(index, 10)]
    setSelected(rec)
  }

  const canSubmit = isValid && selected !== null

  const onSubmit = (data: FormValues) => {
    if (!selected) return
    const payload = {
      codigoPostal: data.codigoPostal,
      calle: data.calle,
      altura: data.altura,
      barrio: isCaba ? data.barrio : selected.barrio,
      nombre: selected.nombre,
      localidad: selected.localidad?.nombre ?? null,
      provincia: selected.localidad?.provincia.nombre ?? null,
    }
    alert(JSON.stringify(payload, null, 2))
  }

  const provinciaNombre = selected?.localidad?.provincia.nombre ?? null
  const localidadNombre = selected?.localidad?.nombre ?? null
  const hasMultipleResults = results && results.length > 1

  return (
    <Card className="w-full max-w-md mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MapPin className="h-5 w-5 text-primary" />
          Datos de envío
        </CardTitle>
        <CardDescription>
          Ingresá tu código postal para que busquemos tu ubicación
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="codigoPostal">Código Postal</Label>
          <div className="relative">
            <Input
              id="codigoPostal"
              placeholder="Ej: 1642"
              maxLength={4}
              className="pr-10"
              {...register('codigoPostal')}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {errors.codigoPostal && (
            <p className="text-sm text-destructive">{errors.codigoPostal.message}</p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {hasMultipleResults && !selected && (
          <div className="space-y-2">
            <Label>Seleccioná tu localidad</Label>
            <Select onValueChange={handleSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí una opción..." />
              </SelectTrigger>
              <SelectContent>
                {results.map((r, i) => (
                  <SelectItem key={r.id} value={String(i)}>
                    {r.nombre ?? 'Sin nombre'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {results && results.length === 1 && !selected && (
          <p className="text-sm text-muted-foreground">Buscando...</p>
        )}

        {selected && (
          <div className="rounded-md border bg-muted/50 p-3 space-y-1 text-sm">
            {!isCaba && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provincia</span>
                <span className="font-medium">{provinciaNombre ?? '—'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Localidad</span>
              <span className="font-medium">{localidadNombre ?? selected.nombre ?? '—'}</span>
            </div>
            {selected.barrio && !isCaba && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Barrio</span>
                <span className="font-medium">{selected.barrio}</span>
              </div>
            )}
          </div>
        )}

        {isCaba && (
          <div className="space-y-2">
            <Label htmlFor="barrio">Barrio</Label>
            <input type="hidden" {...register('barrio')} />
            <Select
              onValueChange={(v) => {
                setValue('barrio', v)
                trigger('barrio')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná tu barrio..." />
              </SelectTrigger>
              <SelectContent>
                {barriosCaba.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.barrio && (
              <p className="text-sm text-destructive">{errors.barrio.message}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="calle">Calle</Label>
          <Input
            id="calle"
            placeholder="Av. Siempre Viva"
            {...register('calle')}
          />
          {errors.calle && (
            <p className="text-sm text-destructive">{errors.calle.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="altura">Altura</Label>
          <Input
            id="altura"
            placeholder="123"
            {...register('altura')}
          />
          {errors.altura && (
            <p className="text-sm text-destructive">{errors.altura.message}</p>
          )}
        </div>

      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          disabled={!canSubmit}
          onClick={handleSubmit(onSubmit)}
        >
          Confirmar envío
        </Button>
      </CardFooter>
    </Card>
  )
}
