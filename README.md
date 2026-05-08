# SimuladorVentas

Simulador de ventas y financiacion VWFS para Autosol, construido con React y Vite.

## Desarrollo local

Requisitos: Node.js 20 o superior.

1. Instalar dependencias con `npm install`
2. Iniciar el entorno local con `npm run dev`

## Build

- Generar build de produccion: `npm run build`
- Validar TypeScript: `npm run lint`

## Plantillas para Google Sheets

- `VWFS_DATA_TEMPLATE.csv`: plantilla de modelos y precios
- `VWFS_CONFIG_TEMPLATE.csv`: plantilla completa de variables mensuales, tasas, topes, UVA, prenda y leasing
- `VWFS_DATA_EDITABLE_TEMPLATE.csv`: version simple para editar modelos con columnas amigables
- `VWFS_CONFIG_EDITABLE_TEMPLATE.csv`: version simple para editar parametros por grupo, categoria, linea, plazo y campana

Para actualizar un nuevo mes:

1. Duplica la sheet del mes anterior
2. En la plantilla editable, cambia solo `Valor`, `Precio_Lista` y `Elegible` cuando haga falta
3. Mantén intactas las columnas estructurales como `Clave` o `Grupo/Categoria/Linea/Plazo/Campana/Variable`
4. Pega la URL publicada del CSV en el panel de administración de la app

## Deploy en GitHub Pages

El repositorio ya quedo preparado para publicar automaticamente en GitHub Pages cada vez que hagas push a `main`.

URL esperada del sitio:

`https://nelsoncalidad15-ops.github.io/SimuladorVentas/`

Ultima actualizacion de deploy: 2026-05-08

Si es la primera vez que lo activas en GitHub:

1. Entra a `Settings > Pages`
2. En `Source`, selecciona `GitHub Actions`
3. Haz un nuevo push a `main` si GitHub no dispara el workflow automaticamente
