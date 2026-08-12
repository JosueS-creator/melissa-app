# Melissa

App de fidelización para clínicas estéticas y salones de belleza — React + Vite + Tailwind + Supabase.

## Backend

- Proyecto Supabase: `mpbfqbixzwcbwipfegmn` (región `us-east-1`, org Enerpetrol, plan free)
- URL: https://mpbfqbixzwcbwipfegmn.supabase.co
- Esquema aplicado: `temas_base`, `clinicas`, `perfiles`, `especialistas`, `pacientes`, `citas`,
  `tratamientos_paciente`, `membresias`, `paciente_membresias`, `puntos_movimientos`, `productos`,
  `pedidos`, `pedido_items`, `wallet_movimientos`, `referidos` — todas con RLS por `clinica_id`.

## Setup local

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env` (ya trae la URL y la anon key reales de Melissa).
3. Corre `npm run dev`.

## Subir a GitHub (sin git CLI)

1. Crea el repo vacío en GitHub (ej. `melissa-app`).
2. Sube todos estos archivos vía "Add file → Upload files" en la web de GitHub,
   o ábrelo con `github.dev` para editar directo en el navegador.
3. **No subas el archivo `.env`** (ya está en `.gitignore`) — en Vercel, configura
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno del proyecto.

## Cómo funciona el theming por clínica

Cada clínica tiene su fila en la tabla `clinicas` con `tema_base_id` (uno de los 3 temas
predefinidos) y colores propios opcionales. Al cargar la app, `src/lib/aplicarTema.js`
consulta la clínica activa e inyecta sus colores como variables CSS (`--color-primary`, etc.),
que Tailwind y todos los componentes ya usan automáticamente — no hay que tocar código para
que una clínica nueva se vea con su marca.

Por ahora el slug de la clínica está fijo como `'demo'` en `App.jsx` (línea `SLUG_CLINICA_DEMO`) —
falta resolverlo dinámicamente por subdominio cuando tengamos más de una clínica real.

## Próximos pasos

- Insertar una clínica de prueba en la tabla `clinicas` para que el theming tenga datos reales.
- Autenticación (Supabase Auth) y flujo de registro de paciente.
- Pantallas de Agenda, Historial, Tienda, Tarjeta VIP (ver conversación de diseño / Claude Design).
