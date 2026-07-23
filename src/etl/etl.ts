import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'csv-parse/sync'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DATA_DIR = path.resolve(process.cwd(), 'data')
const BATCH_SIZE = 1000

type CsvRow = Record<string, string>

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('Cleaning tables...')
  await prisma.codigoPostal.deleteMany()
  await prisma.localidad.deleteMany()
  await prisma.provincia.deleteMany()

  console.log('Loading provincias...')
  const provinciasRaw = fs.readFileSync(path.join(DATA_DIR, 'provincias.csv'), 'utf-8')
  const provinciasData = parse<CsvRow>(provinciasRaw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  })
  await prisma.provincia.createMany({
    data: provinciasData.map((p) => ({
      id: p.id,
      nombre: p.nombre,
    })),
  })
  console.log(`  Inserted ${provinciasData.length} provincias.`)

  console.log('Loading localidades...')
  const localidadesRaw = fs.readFileSync(path.join(DATA_DIR, 'localidades.csv'), 'utf-8')
  const localidadesData = parse<CsvRow>(localidadesRaw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  })
  await prisma.localidad.createMany({
    data: localidadesData.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      provinciaId: l.provincia_id,
    })),
  })
  console.log(`  Inserted ${localidadesData.length} localidades.`)

  // Insert synthetic localidad for CABA (maestro uses "Ciudad Autonoma de Buenos Aires"
  // but Georef only has individual neighborhoods, so no match exists)
  const CABA_SYNTHETIC_ID = '02000000001'
  await prisma.localidad.create({
    data: {
      id: CABA_SYNTHETIC_ID,
      nombre: 'Ciudad Aut\u00f3noma de Buenos Aires',
      provinciaId: '02',
    },
  })
  console.log('  Inserted synthetic localidad for CABA.')

  console.log('Building localidad lookup maps...')
  const allLocalidades = await prisma.localidad.findMany()
  const localidadLookup = new Map<string, string>()
  const localidadByName = new Map<string, string>()
  for (const loc of allLocalidades) {
    const key = `${loc.provinciaId}:${normalizeName(loc.nombre)}`
    localidadLookup.set(key, loc.id)
    const nameKey = normalizeName(loc.nombre)
    if (!localidadByName.has(nameKey)) {
      localidadByName.set(nameKey, loc.id)
    }
  }
  console.log(`  Lookup maps: ${localidadLookup.size} provincia:nombre, ${localidadByName.size} nombre-only.`)

  console.log('Loading c\u00f3digos postales from maestro...')
  const cpRaw = fs.readFileSync(path.join(DATA_DIR, 'localidades_cp_maestro.csv'), 'utf-8')
  const cpData = parse<CsvRow>(cpRaw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  })

  const cpRecords: { codigo: string; nombre: string; localidadId: string | null; barrio: string | null }[] = []
  let skipped = 0
  for (const row of cpData) {
    const cp = (row.cp ?? '').trim()
    if (!cp) { skipped++; continue }

    const rawLocalidad = (row.localidad ?? '').trim()
    const rawProvinciaId = (row.id_prov_mstr ?? '').trim()

    // Exact match on provincia + nombre first, fallback to nombre-only
    const lookupKey = `${rawProvinciaId}:${normalizeName(rawLocalidad)}`
    let localidadId: string | null = localidadLookup.get(lookupKey) ?? null
    if (!localidadId) {
      localidadId = localidadByName.get(normalizeName(rawLocalidad)) ?? null
    }

    cpRecords.push({ codigo: cp, nombre: rawLocalidad, localidadId, barrio: null })
  }
  console.log(`  Parsed ${cpData.length} rows, skipped ${skipped} without CP, ${cpRecords.length} to insert.`)

  for (let i = 0; i < cpRecords.length; i += BATCH_SIZE) {
    const batch = cpRecords.slice(i, i + BATCH_SIZE)
    await prisma.codigoPostal.createMany({ data: batch })
  }
  console.log(`  Inserted ${cpRecords.length} c\u00f3digos postales.`)

  console.log('Applying CABA barrio...')
  const cabaResult = await prisma.codigoPostal.updateMany({
    where: {
      codigo: { gte: '1000', lte: '1499' },
    },
    data: { barrio: 'CABA' },
  })
  console.log(`  Updated ${cabaResult.count} CABA records with barrio='CABA'.`)

  console.log('Loading coordinates from AR.txt...')
  const arRaw = fs.readFileSync(path.join(DATA_DIR, 'AR.txt'), 'utf-8')
  const arLines = arRaw.trim().split('\n')

  const arMap = new Map<string, { lat: number; lng: number }>()
  for (const line of arLines) {
    const cols = line.split('\t')
    const codigo = cols[1]?.trim()
    const lat = cols[9]?.trim()
    const lng = cols[10]?.trim()
    if (codigo && lat && lng && !arMap.has(codigo)) {
      arMap.set(codigo, { lat: parseFloat(lat), lng: parseFloat(lng) })
    }
  }
  console.log(`  Parsed ${arMap.size} unique CPs with coordinates.`)

  const existingCPs = await prisma.codigoPostal.findMany({ select: { codigo: true } })
  const existingSet = new Set(existingCPs.map((c) => c.codigo))

  const toUpdate: { codigo: string; lat: number; lng: number }[] = []
  const toInsert: { codigo: string; lat: number; lng: number }[] = []

  for (const [codigo, coords] of arMap) {
    if (existingSet.has(codigo)) {
      toUpdate.push({ codigo, ...coords })
    } else {
      toInsert.push({ codigo, ...coords })
    }
  }

  let updatedCount = 0
  for (const rec of toUpdate) {
    const r = await prisma.codigoPostal.updateMany({
      where: { codigo: rec.codigo, latitud: null },
      data: { latitud: rec.lat, longitud: rec.lng },
    })
    updatedCount += r.count
  }
  console.log(`  Updated ${updatedCount} existing records with coordinates.`)

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      await prisma.codigoPostal.createMany({
        data: batch.map((r) => ({
          codigo: r.codigo,
          latitud: r.lat,
          longitud: r.lng,
        })),
      })
    }
  }
  console.log(`  Inserted ${toInsert.length} new records from AR.txt.`)

  const total = await prisma.codigoPostal.count()
  console.log(`ETL complete. Total CodigoPostal records: ${total}`)
}

main()
  .catch((e) => {
    console.error('ETL failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
