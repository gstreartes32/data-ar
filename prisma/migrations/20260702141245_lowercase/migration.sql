/*
  Warnings:

  - You are about to drop the `CodigoPostal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Localidad` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Provincia` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CodigoPostal" DROP CONSTRAINT "CodigoPostal_localidadId_fkey";

-- DropForeignKey
ALTER TABLE "Localidad" DROP CONSTRAINT "Localidad_provinciaId_fkey";

-- DropTable
DROP TABLE "CodigoPostal";

-- DropTable
DROP TABLE "Localidad";

-- DropTable
DROP TABLE "Provincia";

-- CreateTable
CREATE TABLE "provincia" (
    "id" CHAR(2) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "provincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localidad" (
    "id" CHAR(11) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "provinciaId" CHAR(2) NOT NULL,

    CONSTRAINT "localidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_postal" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(4) NOT NULL,
    "nombre" VARCHAR(200),
    "barrio" VARCHAR(150),
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "localidadId" CHAR(11),

    CONSTRAINT "codigo_postal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigo_postal_codigo_idx" ON "codigo_postal"("codigo");

-- AddForeignKey
ALTER TABLE "localidad" ADD CONSTRAINT "localidad_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "provincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_postal" ADD CONSTRAINT "codigo_postal_localidadId_fkey" FOREIGN KEY ("localidadId") REFERENCES "localidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
