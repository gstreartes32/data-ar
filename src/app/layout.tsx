import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Envío - Proyecto Datos AR',
  description: 'Formulario de envío con validación de código postal',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
