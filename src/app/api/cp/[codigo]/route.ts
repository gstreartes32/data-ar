import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params

  const results = await prisma.codigoPostal.findMany({
    where: { codigo },
    include: {
      localidad: {
        include: {
          provincia: true,
        },
      },
    },
  })

  if (results.length === 0) {
    return NextResponse.json({ error: 'Código postal no encontrado' }, { status: 404 })
  }

  return NextResponse.json(results)
}
