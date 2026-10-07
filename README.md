# Melissa

SaaS multi-negocio de **operación, fidelización y crecimiento** para clínicas estéticas, salones de
belleza, salones de uñas y spas (Honduras y España). React + Vite + Tailwind + Supabase, desplegado en Vercel.

- App: https://melissa-app.vercel.app
- Estado del producto y decisiones por fase: [`docs/FASE_A.md`](docs/FASE_A.md) · [`docs/FASE_B.md`](docs/FASE_B.md) · [`docs/CANJES.md`](docs/CANJES.md)

## Estructura

```
src/
  App.jsx            orquestador (navegación por estado, sin react-router)
  pages/             pantallas de cliente, panel del negocio (AdminPanel) y panel de Melissa
  components/        TabBar, EscanerBarras, CampoContrasena, …
  lib/               supabaseClient, auth, tenant, aplicarTema, fidelidad, exportarDatosClinica, …
supabase/migrations/ migraciones SQL aplicadas, en orden (fuente de verdad del esquema y la seguridad)
supabase/tests/      pruebas SQL contra la base (crean datos y se revierten solas)
docs/                informes por fase
```

## Multi-tenant

Todo dato pertenece a un negocio y se aísla por `clinica_id` con RLS (`clinica_actual()`,
`es_admin_clinica()`, `paciente_actual()`, `es_super_admin_global()`).

El negocio se resuelve en `src/lib/tenant.js`: `slug → clínica → clinica_id`.

| Forma | Estado |
|---|---|
| `https://<dominio>/<slug>` | activa |
| `?clinica=<slug>` | activa (QR ya impresos) |
| `https://<slug>.<VITE_BASE_DOMAIN>` | preparada: se activa definiendo `VITE_BASE_DOMAIN` |

No existe negocio por defecto: sin link o QR de un negocio no se puede crear una cuenta de cliente.

## Reglas de seguridad (no romper)

- El navegador **no es de confianza**: lo que importa debe estar en RLS o en funciones de la base.
- Un usuario solo edita datos personales de su perfil (permiso por columna); `rol`, `clinica_id` y
  `es_super_admin` no son editables desde la API.
- Puntos: libro mayor de solo-anexar (sin update/delete), sin saldo negativo. Los clientes **solicitan** canjes
  con `solicitar_canje()` (puntos reservados; el costo viene de `recompensas`) y el negocio los aprueba con
  `aplicar_canje()` o los rechaza con `rechazar_canje()`.
- Caja: un descuento solo puede crearse aprobando un canje; `pagos.monto` es lo realmente cobrado.
- Pedidos: se crean con `crear_pedido()`, que calcula precios y total en el servidor.
- Citas: el cliente solo solicita (`pendiente`); confirmar/completar es del admin.
- Plan, estado y slug del negocio solo los cambia el super admin.
- Fotos de tratamientos: bucket privado con URLs firmadas; logos y fotos de producto: públicos.

## Desarrollo local

```bash
npm install
cp .env.example .env   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

## Despliegue (sin git CLI)

1. Sube los archivos a GitHub (Add file → Upload files, o `github.dev`). No subas `.env`.
2. En Vercel define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (y `VITE_BASE_DOMAIN` si usas subdominios).
3. `vercel.json` redirige cualquier ruta a `index.html` para que `/<slug>` funcione.

## Migraciones

Cada cambio de esquema o de políticas va como archivo nuevo en `supabase/migrations/` (nunca editar uno
ya aplicado) y se ejecuta en el SQL Editor de Supabase en orden de nombre.
Después de aplicar una migración, correr la prueba de `supabase/tests/` correspondiente.
