-- CreateTable
CREATE TABLE "Provincia" (
    "id" CHAR(2) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Localidad" (
    "id" CHAR(11) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "provinciaId" CHAR(2) NOT NULL,

    CONSTRAINT "Localidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoPostal" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(4) NOT NULL,
    "barrio" VARCHAR(150),
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "localidadId" CHAR(11),

    CONSTRAINT "CodigoPostal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodigoPostal_codigo_idx" ON "CodigoPostal"("codigo");

-- AddForeignKey
ALTER TABLE "Localidad" ADD CONSTRAINT "Localidad_provinciaId_fkey" FOREIGN KEY ("provinciaId") REFERENCES "Provincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoPostal" ADD CONSTRAINT "CodigoPostal_localidadId_fkey" FOREIGN KEY ("localidadId") REFERENCES "Localidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
