-- ============================================================
-- ESQUEMA COMPLETO DE MELISSA (solo estructura, SIN datos)
-- Copia de referencia del esquema de producción (proyecto Supabase mpbfqbixzwcbwipfegmn),
-- generada desde la base el 2026-10-09, después del cierre de privacidad (catálogos y clínicas). Incluye las ~37 migraciones antiguas (ago–sep 2026)
-- que nunca se guardaron en el repositorio, más todo lo aplicado después.
--
-- NO SE APLICA en la base actual (ya existe). Sirve para:
--   * reconstruir Melissa desde cero en un proyecto nuevo (orden: extensiones → tablas →
--     restricciones → índices → funciones → permisos → triggers → RLS → políticas → buckets);
--   * auditar el esquema y comparar cambios futuros.
-- Melissa (código y esquema) es propiedad de su autor; los negocios la usan bajo licencia.
-- ============================================================

-- MELISSA_SCHEMA_DUMP_START
-- ===== EXTENSIONES =====
create extension if not exists pg_stat_statements;
create extension if not exists pgcrypto;
create extension if not exists supabase_vault;
create extension if not exists "uuid-ossp";

-- ===== TABLAS =====
create table public.canjes (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  recompensa_id uuid,
  recompensa_nombre text not null,
  puntos integer not null,
  valor_descuento numeric,
  codigo text not null,
  estado text default 'pendiente'::text not null,
  fecha_solicitud timestamp with time zone default now() not null,
  fecha_resolucion timestamp with time zone,
  resuelto_por uuid,
  descuento_aplicado numeric,
  pago_id uuid,
  nota text
);

create table public.citas (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  especialista_id uuid,
  fecha_hora timestamp with time zone not null,
  estado text default 'pendiente'::text,
  tratamiento text,
  servicio_id uuid,
  creada_at timestamp with time zone default now(),
  promocion_id uuid
);

create table public.claves_supervisor (
  clinica_id uuid not null,
  pin_hash text not null,
  intentos_fallidos integer default 0 not null,
  bloqueado_hasta timestamp with time zone
);

create table public.clinica_contacto (
  clinica_id uuid not null,
  telefono_contacto text,
  whatsapp_contacto text,
  actualizado_at timestamp with time zone default now() not null,
  actualizado_por uuid default auth.uid()
);

create table public.clinicas (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  slug text not null,
  dominio_propio text,
  plan text default 'starter'::text not null,
  pais text not null,
  moneda text default 'HNL'::text not null,
  logo_url text,
  tema_base_id text default 'elegante_dorado'::text,
  color_primario text,
  color_secundario text,
  color_acento text,
  fuente text default 'Inter'::text,
  activa boolean default true not null,
  fecha_creacion timestamp with time zone default now() not null,
  ciudad text,
  tipo_negocio text default 'clinica_estetica'::text not null,
  umbral_oro integer default 800 not null,
  umbral_platino integer default 3200 not null,
  dias_inactividad integer default 45 not null,
  valor_punto numeric(10,4) default 0.10 not null,
  promo_frecuencia_dias integer default 3 not null
);

create table public.crm_reactivaciones (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  canal text default 'whatsapp'::text not null,
  evento text default 'contacto_iniciado'::text not null,
  plantilla text not null,
  promocion_id uuid,
  prioridad text not null,
  ultima_visita_previa timestamp with time zone not null,
  dias_inactivo integer not null,
  visitas_previas integer not null,
  creado_por uuid default auth.uid(),
  created_at timestamp with time zone default now() not null
);

create table public.especialistas (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  nombre text not null,
  especialidad text,
  activo boolean default true
);

create table public.invitaciones_admin (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  codigo text not null,
  usado boolean default false not null,
  usado_por uuid,
  creado_at timestamp with time zone default now() not null
);

create table public.membresias (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  nombre text not null,
  nivel text not null,
  precio_mensual numeric(10,2) default 0 not null,
  descuento_porcentaje numeric(5,2) default 0,
  tratamientos_incluidos text,
  prioridad_citas boolean default false,
  activa boolean default true
);

create table public.paciente_membresias (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  membresia_id uuid not null,
  fecha_inicio date default CURRENT_DATE not null,
  fecha_fin date,
  estado text default 'activa'::text
);

create table public.pacientes (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  perfil_id uuid,
  nombre text not null,
  telefono text,
  fecha_nacimiento date,
  tipo_piel text,
  fecha_registro timestamp with time zone default now(),
  pais text,
  email text
);

create table public.pagos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid,
  concepto text not null,
  tipo text not null,
  monto numeric(10,2) not null,
  metodo_pago text not null,
  registrado_por uuid,
  fecha timestamp with time zone default now() not null,
  direccion text default 'ingreso'::text not null,
  anulado_at timestamp with time zone,
  anulado_por uuid,
  motivo_anulacion text,
  descuento numeric default 0 not null,
  canje_id uuid,
  clave_operacion uuid,
  promocion_id uuid
);

create table public.pedido_items (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  producto_id uuid not null,
  cantidad integer default 1 not null,
  precio_unitario numeric(10,2) not null,
  puntos_unitarios integer default 0 not null
);

create table public.pedidos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  total numeric(10,2) default 0 not null,
  metodo_pago text,
  entrega text default 'domicilio'::text,
  estado text default 'pendiente'::text,
  fecha timestamp with time zone default now()
);

create table public.perfiles (
  id uuid not null,
  clinica_id uuid,
  nombre text,
  telefono text,
  rol text default 'paciente'::text not null,
  fecha_creacion timestamp with time zone default now() not null,
  pais text,
  recordatorios_citas boolean default true not null,
  promociones_ofertas boolean default true not null,
  compartir_fotos_progreso boolean default false not null,
  es_super_admin boolean default false not null
);

create table public.productos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  nombre text not null,
  descripcion text,
  categoria text,
  precio numeric(10,2) not null,
  imagen_url text,
  stock integer default 0,
  activo boolean default true,
  codigo_barras text,
  puntos_otorga integer default 0 not null
);

create table public.promocion_clientes (
  promocion_id uuid not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  estado text default 'disponible'::text not null,
  veces_mostrada integer default 0 not null,
  ultima_vez_mostrada timestamp with time zone,
  vista_at timestamp with time zone,
  utilizada_at timestamp with time zone,
  pago_id uuid
);

create table public.promociones (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  titulo text not null,
  descripcion text,
  descuento_porcentaje numeric(5,2) not null,
  segmento text not null,
  servicio_id uuid,
  inicio date default CURRENT_DATE not null,
  fin date not null,
  estado text default 'borrador'::text not null,
  creada_por uuid default auth.uid(),
  creada_at timestamp with time zone default now() not null
);

create table public.puntos_movimientos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  tipo text not null,
  puntos integer not null,
  motivo text,
  fecha timestamp with time zone default now(),
  canje_id uuid,
  origen_tipo text,
  origen_id uuid
);

create table public.recompensas (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  nombre text not null,
  costo_puntos integer not null,
  activa boolean default true not null,
  orden integer default 0 not null,
  valor_descuento numeric
);

create table public.referidos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_referidor_id uuid not null,
  paciente_referido_id uuid,
  telefono_referido text,
  estado text default 'invitado'::text,
  fecha timestamp with time zone default now(),
  codigo text
);

create table public.servicios (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null,
  duracion_minutos integer default 30,
  activo boolean default true not null,
  puntos_otorga integer default 0 not null,
  imagen_url text
);

create table public.temas_base (
  id text not null,
  nombre text not null,
  color_primario_default text not null,
  color_secundario_default text not null,
  color_acento_default text not null,
  descripcion text,
  tokens jsonb default '{}'::jsonb
);

create table public.tratamientos_paciente (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  cita_id uuid,
  procedimiento text not null,
  productos_usados text,
  recomendaciones text,
  foto_antes_url text,
  fecha timestamp with time zone default now(),
  foto_despues_url text
);

create table public.wallet_movimientos (
  id uuid default gen_random_uuid() not null,
  clinica_id uuid not null,
  paciente_id uuid not null,
  tipo text not null,
  monto numeric(10,2) not null,
  referencia text,
  fecha timestamp with time zone default now()
);

-- ===== RESTRICCIONES (PK, UNIQUE, CHECK, FK) =====
alter table public.canjes add constraint canjes_pkey PRIMARY KEY (id);
alter table public.citas add constraint citas_pkey PRIMARY KEY (id);
alter table public.claves_supervisor add constraint claves_supervisor_pkey PRIMARY KEY (clinica_id);
alter table public.clinica_contacto add constraint clinica_contacto_pkey PRIMARY KEY (clinica_id);
alter table public.clinicas add constraint clinicas_pkey PRIMARY KEY (id);
alter table public.crm_reactivaciones add constraint crm_reactivaciones_pkey PRIMARY KEY (id);
alter table public.especialistas add constraint especialistas_pkey PRIMARY KEY (id);
alter table public.invitaciones_admin add constraint invitaciones_admin_pkey PRIMARY KEY (id);
alter table public.membresias add constraint membresias_pkey PRIMARY KEY (id);
alter table public.paciente_membresias add constraint paciente_membresias_pkey PRIMARY KEY (id);
alter table public.pacientes add constraint pacientes_pkey PRIMARY KEY (id);
alter table public.pagos add constraint pagos_pkey PRIMARY KEY (id);
alter table public.pedido_items add constraint pedido_items_pkey PRIMARY KEY (id);
alter table public.pedidos add constraint pedidos_pkey PRIMARY KEY (id);
alter table public.perfiles add constraint perfiles_pkey PRIMARY KEY (id);
alter table public.productos add constraint productos_pkey PRIMARY KEY (id);
alter table public.promocion_clientes add constraint promocion_clientes_pkey PRIMARY KEY (promocion_id, paciente_id);
alter table public.promociones add constraint promociones_pkey PRIMARY KEY (id);
alter table public.puntos_movimientos add constraint puntos_movimientos_pkey PRIMARY KEY (id);
alter table public.recompensas add constraint recompensas_pkey PRIMARY KEY (id);
alter table public.referidos add constraint referidos_pkey PRIMARY KEY (id);
alter table public.servicios add constraint servicios_pkey PRIMARY KEY (id);
alter table public.temas_base add constraint temas_base_pkey PRIMARY KEY (id);
alter table public.tratamientos_paciente add constraint tratamientos_paciente_pkey PRIMARY KEY (id);
alter table public.wallet_movimientos add constraint wallet_movimientos_pkey PRIMARY KEY (id);
alter table public.clinicas add constraint clinicas_dominio_propio_key UNIQUE (dominio_propio);
alter table public.clinicas add constraint clinicas_slug_key UNIQUE (slug);
alter table public.invitaciones_admin add constraint invitaciones_admin_codigo_key UNIQUE (codigo);
alter table public.promociones add constraint promociones_id_clinica UNIQUE (id, clinica_id);
alter table public.servicios add constraint servicios_id_clinica_unico UNIQUE (id, clinica_id);
alter table public.canjes add constraint canjes_descuento_aplicado_check CHECK (((descuento_aplicado IS NULL) OR (descuento_aplicado >= (0)::numeric)));
alter table public.canjes add constraint canjes_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aplicado'::text, 'rechazado'::text, 'cancelado'::text])));
alter table public.canjes add constraint canjes_puntos_check CHECK ((puntos > 0));
alter table public.canjes add constraint canjes_resolucion_coherente CHECK ((((estado = 'pendiente'::text) AND (fecha_resolucion IS NULL)) OR ((estado <> 'pendiente'::text) AND (fecha_resolucion IS NOT NULL))));
alter table public.citas add constraint citas_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'confirmada'::text, 'completada'::text, 'cancelada'::text])));
alter table public.clinica_contacto add constraint contacto_telefono_valido CHECK (((telefono_contacto IS NULL) OR ((telefono_contacto ~ '^\+?[0-9().\s-]+$'::text) AND ((length(regexp_replace(telefono_contacto, '\D'::text, ''::text, 'g'::text)) >= 7) AND (length(regexp_replace(telefono_contacto, '\D'::text, ''::text, 'g'::text)) <= 15)))));
alter table public.clinica_contacto add constraint contacto_whatsapp_valido CHECK (((whatsapp_contacto IS NULL) OR ((whatsapp_contacto ~ '^\+?[0-9().\s-]+$'::text) AND ((length(regexp_replace(whatsapp_contacto, '\D'::text, ''::text, 'g'::text)) >= 7) AND (length(regexp_replace(whatsapp_contacto, '\D'::text, ''::text, 'g'::text)) <= 15)))));
alter table public.clinicas add constraint clinicas_moneda_check CHECK ((moneda = ANY (ARRAY['HNL'::text, 'EUR'::text, 'USD'::text])));
alter table public.clinicas add constraint clinicas_pais_check CHECK ((pais = ANY (ARRAY['HN'::text, 'ES'::text])));
alter table public.clinicas add constraint clinicas_plan_check CHECK ((plan = ANY (ARRAY['starter'::text, 'pro'::text, 'clinic_plus'::text])));
alter table public.clinicas add constraint clinicas_promo_frecuencia_dias_check CHECK (((promo_frecuencia_dias >= 1) AND (promo_frecuencia_dias <= 365)));
alter table public.clinicas add constraint clinicas_tipo_negocio_check CHECK ((tipo_negocio = ANY (ARRAY['clinica_estetica'::text, 'salon_belleza'::text, 'salon_unas'::text, 'spa'::text, 'otro'::text])));
alter table public.clinicas add constraint clinicas_umbrales_validos CHECK (((umbral_oro > 0) AND (umbral_platino > umbral_oro) AND (dias_inactividad > 0)));
alter table public.clinicas add constraint clinicas_valor_punto_check CHECK ((valor_punto > (0)::numeric));
alter table public.crm_reactivaciones add constraint crm_reactivaciones_canal_check CHECK ((canal = 'whatsapp'::text));
alter table public.crm_reactivaciones add constraint crm_reactivaciones_evento_check CHECK ((evento = 'contacto_iniciado'::text));
alter table public.crm_reactivaciones add constraint crm_reactivaciones_plantilla_check CHECK ((plantilla = ANY (ARRAY['sin_promocion'::text, 'con_promocion'::text, 'frecuente_vip'::text])));
alter table public.crm_reactivaciones add constraint crm_reactivaciones_prioridad_check CHECK ((prioridad = ANY (ARRAY['alta'::text, 'media'::text, 'baja'::text])));
alter table public.membresias add constraint membresias_nivel_check CHECK ((nivel = ANY (ARRAY['silver'::text, 'gold'::text, 'platinum'::text])));
alter table public.paciente_membresias add constraint paciente_membresias_estado_check CHECK ((estado = ANY (ARRAY['activa'::text, 'cancelada'::text, 'vencida'::text])));
alter table public.pagos add constraint pagos_descuento_check CHECK ((descuento >= (0)::numeric));
alter table public.pagos add constraint pagos_descuento_con_origen CHECK (((descuento = (0)::numeric) OR (canje_id IS NOT NULL) OR (promocion_id IS NOT NULL)));
alter table public.pagos add constraint pagos_direccion_check CHECK ((direccion = ANY (ARRAY['ingreso'::text, 'egreso'::text])));
alter table public.pagos add constraint pagos_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text])));
alter table public.pagos add constraint pagos_tipo_check CHECK ((tipo = ANY (ARRAY['servicio'::text, 'producto'::text, 'membresia'::text, 'otro'::text])));
alter table public.pedido_items add constraint pedido_items_puntos_unitarios_check CHECK ((puntos_unitarios >= 0));
alter table public.pedidos add constraint pedidos_entrega_check CHECK ((entrega = ANY (ARRAY['domicilio'::text, 'recoger_clinica'::text])));
alter table public.pedidos add constraint pedidos_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'enviado'::text, 'entregado'::text, 'cancelado'::text])));
alter table public.pedidos add constraint pedidos_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['wallet'::text, 'tarjeta'::text, 'efectivo'::text])));
alter table public.perfiles add constraint perfiles_rol_check CHECK ((rol = ANY (ARRAY['paciente'::text, 'especialista'::text, 'admin'::text])));
alter table public.productos add constraint productos_categoria_check CHECK ((categoria = ANY (ARRAY['cremas'::text, 'protector_solar'::text, 'sueros'::text, 'vitaminas'::text, 'kits'::text])));
alter table public.productos add constraint productos_puntos_otorga_check CHECK (((puntos_otorga >= 0) AND (puntos_otorga <= 1000000)));
alter table public.promocion_clientes add constraint promocion_clientes_estado_check CHECK ((estado = ANY (ARRAY['disponible'::text, 'vista'::text, 'descartada'::text, 'utilizada'::text])));
alter table public.promocion_clientes add constraint promocion_clientes_veces_mostrada_check CHECK ((veces_mostrada >= 0));
alter table public.promociones add constraint promociones_descripcion_check CHECK (((descripcion IS NULL) OR (length(descripcion) <= 500)));
alter table public.promociones add constraint promociones_descuento_porcentaje_check CHECK (((descuento_porcentaje > (0)::numeric) AND (descuento_porcentaje <= (100)::numeric)));
alter table public.promociones add constraint promociones_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'activa'::text, 'pausada'::text])));
alter table public.promociones add constraint promociones_fechas CHECK ((fin >= inicio));
alter table public.promociones add constraint promociones_segmento_check CHECK ((segmento = ANY (ARRAY['todos'::text, 'nuevos'::text, 'frecuentes'::text, 'vip'::text, 'inactivos'::text, 'sin_proxima'::text, 'cumple'::text, 'membresia'::text])));
alter table public.promociones add constraint promociones_titulo_check CHECK (((length(TRIM(BOTH FROM titulo)) >= 1) AND (length(TRIM(BOTH FROM titulo)) <= 80)));
alter table public.puntos_movimientos add constraint puntos_movimientos_origen_tipo_check CHECK ((origen_tipo = ANY (ARRAY['cita'::text, 'venta'::text, 'pedido'::text])));
alter table public.puntos_movimientos add constraint puntos_movimientos_tipo_check CHECK ((tipo = ANY (ARRAY['acumulacion'::text, 'canje'::text, 'ajuste'::text])));
alter table public.puntos_movimientos add constraint puntos_origen_completo CHECK (((origen_tipo IS NULL) = (origen_id IS NULL)));
alter table public.puntos_movimientos add constraint puntos_signo_coherente CHECK ((((tipo = 'acumulacion'::text) AND (puntos > 0)) OR ((tipo = 'canje'::text) AND (puntos < 0)) OR (tipo = 'ajuste'::text)));
alter table public.recompensas add constraint recompensas_costo_puntos_check CHECK ((costo_puntos > 0));
alter table public.recompensas add constraint recompensas_valor_descuento_check CHECK (((valor_descuento IS NULL) OR (valor_descuento > (0)::numeric)));
alter table public.referidos add constraint referidos_estado_check CHECK ((estado = ANY (ARRAY['invitado'::text, 'registrado'::text, 'recompensado'::text])));
alter table public.servicios add constraint servicios_imagen_url_valida CHECK (((imagen_url IS NULL) OR (imagen_url ~ '^(https://|/)'::text)));
alter table public.servicios add constraint servicios_puntos_otorga_check CHECK (((puntos_otorga >= 0) AND (puntos_otorga <= 1000000)));
alter table public.wallet_movimientos add constraint wallet_movimientos_tipo_check CHECK ((tipo = ANY (ARRAY['recarga'::text, 'pago'::text, 'reembolso'::text])));
alter table public.canjes add constraint canjes_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.canjes add constraint canjes_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.canjes add constraint canjes_pago_fk FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE SET NULL;
alter table public.canjes add constraint canjes_recompensa_id_fkey FOREIGN KEY (recompensa_id) REFERENCES recompensas(id) ON DELETE SET NULL;
alter table public.canjes add constraint canjes_resuelto_por_fkey FOREIGN KEY (resuelto_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.citas add constraint citas_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.citas add constraint citas_especialista_id_fkey FOREIGN KEY (especialista_id) REFERENCES especialistas(id);
alter table public.citas add constraint citas_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.citas add constraint citas_promocion_misma_clinica FOREIGN KEY (promocion_id, clinica_id) REFERENCES promociones(id, clinica_id) ON DELETE SET NULL (promocion_id);
alter table public.citas add constraint citas_servicio_misma_clinica FOREIGN KEY (servicio_id, clinica_id) REFERENCES servicios(id, clinica_id) ON DELETE SET NULL (servicio_id);
alter table public.claves_supervisor add constraint claves_supervisor_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.clinica_contacto add constraint clinica_contacto_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.clinica_contacto add constraint clinica_contacto_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.clinicas add constraint clinicas_tema_base_id_fkey FOREIGN KEY (tema_base_id) REFERENCES temas_base(id);
alter table public.crm_reactivaciones add constraint crm_reactivaciones_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.crm_reactivaciones add constraint crm_reactivaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.crm_reactivaciones add constraint crm_reactivaciones_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.crm_reactivaciones add constraint crm_reactivaciones_promocion_id_clinica_id_fkey FOREIGN KEY (promocion_id, clinica_id) REFERENCES promociones(id, clinica_id) ON DELETE SET NULL (promocion_id);
alter table public.especialistas add constraint especialistas_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.invitaciones_admin add constraint invitaciones_admin_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.invitaciones_admin add constraint invitaciones_admin_usado_por_fkey FOREIGN KEY (usado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.membresias add constraint membresias_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.paciente_membresias add constraint paciente_membresias_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.paciente_membresias add constraint paciente_membresias_membresia_id_fkey FOREIGN KEY (membresia_id) REFERENCES membresias(id);
alter table public.paciente_membresias add constraint paciente_membresias_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.pacientes add constraint pacientes_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.pacientes add constraint pacientes_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.pagos add constraint pagos_anulado_por_fkey FOREIGN KEY (anulado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.pagos add constraint pagos_canje_id_fkey FOREIGN KEY (canje_id) REFERENCES canjes(id) ON DELETE SET NULL;
alter table public.pagos add constraint pagos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.pagos add constraint pagos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.pagos add constraint pagos_promocion_id_fkey FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE SET NULL;
alter table public.pagos add constraint pagos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.pedido_items add constraint pedido_items_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.pedido_items add constraint pedido_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES productos(id);
alter table public.pedidos add constraint pedidos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.pedidos add constraint pedidos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.perfiles add constraint perfiles_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.perfiles add constraint perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.productos add constraint productos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.promocion_clientes add constraint promocion_clientes_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.promocion_clientes add constraint promocion_clientes_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.promocion_clientes add constraint promocion_clientes_pago_id_fkey FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE SET NULL;
alter table public.promocion_clientes add constraint promocion_clientes_promocion_id_clinica_id_fkey FOREIGN KEY (promocion_id, clinica_id) REFERENCES promociones(id, clinica_id) ON DELETE CASCADE;
alter table public.promociones add constraint promociones_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.promociones add constraint promociones_creada_por_fkey FOREIGN KEY (creada_por) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.promociones add constraint promociones_servicio_id_clinica_id_fkey FOREIGN KEY (servicio_id, clinica_id) REFERENCES servicios(id, clinica_id) ON DELETE SET NULL (servicio_id);
alter table public.puntos_movimientos add constraint puntos_movimientos_canje_id_fkey FOREIGN KEY (canje_id) REFERENCES canjes(id) ON DELETE SET NULL;
alter table public.puntos_movimientos add constraint puntos_movimientos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.puntos_movimientos add constraint puntos_movimientos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.recompensas add constraint recompensas_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.referidos add constraint referidos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.referidos add constraint referidos_paciente_referido_id_fkey FOREIGN KEY (paciente_referido_id) REFERENCES pacientes(id);
alter table public.referidos add constraint referidos_paciente_referidor_id_fkey FOREIGN KEY (paciente_referidor_id) REFERENCES pacientes(id);
alter table public.servicios add constraint servicios_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.tratamientos_paciente add constraint tratamientos_paciente_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES citas(id);
alter table public.tratamientos_paciente add constraint tratamientos_paciente_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.tratamientos_paciente add constraint tratamientos_paciente_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);
alter table public.wallet_movimientos add constraint wallet_movimientos_clinica_id_fkey FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE;
alter table public.wallet_movimientos add constraint wallet_movimientos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES pacientes(id);

-- ===== ÍNDICES =====
CREATE INDEX idx_referidos_referido ON public.referidos USING btree (paciente_referido_id);
CREATE INDEX idx_invitaciones_usado_por ON public.invitaciones_admin USING btree (usado_por);
CREATE INDEX idx_canjes_clinica_estado ON public.canjes USING btree (clinica_id, estado, fecha_solicitud);
CREATE INDEX idx_pagos_paciente ON public.pagos USING btree (paciente_id);
CREATE INDEX idx_promociones_clinica ON public.promociones USING btree (clinica_id, estado, fin);
CREATE UNIQUE INDEX idx_productos_codigo_barras ON public.productos USING btree (clinica_id, codigo_barras) WHERE (codigo_barras IS NOT NULL);
CREATE INDEX idx_pagos_fecha ON public.pagos USING btree (fecha);
CREATE UNIQUE INDEX idx_canjes_codigo ON public.canjes USING btree (clinica_id, codigo);
CREATE INDEX idx_puntos_clinica ON public.puntos_movimientos USING btree (clinica_id);
CREATE INDEX idx_canjes_paciente ON public.canjes USING btree (paciente_id);
CREATE UNIQUE INDEX idx_pagos_clave_operacion ON public.pagos USING btree (clinica_id, clave_operacion) WHERE (clave_operacion IS NOT NULL);
CREATE INDEX idx_invitaciones_clinica ON public.invitaciones_admin USING btree (clinica_id);
CREATE INDEX idx_citas_clinica ON public.citas USING btree (clinica_id);
CREATE INDEX idx_paciente_membresias_membresia ON public.paciente_membresias USING btree (membresia_id);
CREATE INDEX idx_clinicas_dominio ON public.clinicas USING btree (dominio_propio) WHERE (dominio_propio IS NOT NULL);
CREATE INDEX idx_perfiles_clinica ON public.perfiles USING btree (clinica_id);
CREATE INDEX idx_tratamientos_clinica ON public.tratamientos_paciente USING btree (clinica_id);
CREATE INDEX idx_tratamientos_paciente ON public.tratamientos_paciente USING btree (paciente_id);
CREATE INDEX idx_puntos_paciente ON public.puntos_movimientos USING btree (paciente_id);
CREATE INDEX idx_servicios_clinica ON public.servicios USING btree (clinica_id);
CREATE INDEX idx_citas_paciente ON public.citas USING btree (paciente_id);
CREATE INDEX idx_clinicas_tema ON public.clinicas USING btree (tema_base_id);
CREATE INDEX idx_pedidos_clinica ON public.pedidos USING btree (clinica_id);
CREATE INDEX idx_pedido_items_pedido ON public.pedido_items USING btree (pedido_id);
CREATE INDEX idx_pagos_clinica ON public.pagos USING btree (clinica_id);
CREATE INDEX idx_especialistas_clinica ON public.especialistas USING btree (clinica_id);
CREATE INDEX idx_citas_especialista ON public.citas USING btree (especialista_id);
CREATE INDEX idx_paciente_membresias_clinica ON public.paciente_membresias USING btree (clinica_id);
CREATE INDEX idx_citas_servicio ON public.citas USING btree (servicio_id);
CREATE INDEX idx_reactivaciones_clinica ON public.crm_reactivaciones USING btree (clinica_id, created_at DESC);
CREATE INDEX idx_productos_clinica ON public.productos USING btree (clinica_id);
CREATE INDEX idx_recompensas_clinica ON public.recompensas USING btree (clinica_id);
CREATE INDEX idx_membresias_clinica ON public.membresias USING btree (clinica_id);
CREATE INDEX idx_pagos_anulado_por ON public.pagos USING btree (anulado_por);
CREATE INDEX idx_clinicas_slug ON public.clinicas USING btree (slug);
CREATE INDEX idx_pedidos_paciente ON public.pedidos USING btree (paciente_id);
CREATE INDEX idx_pedido_items_producto ON public.pedido_items USING btree (producto_id);
CREATE INDEX idx_reactivaciones_paciente ON public.crm_reactivaciones USING btree (paciente_id, created_at DESC);
CREATE INDEX idx_paciente_membresias_paciente ON public.paciente_membresias USING btree (paciente_id);
CREATE INDEX idx_pacientes_clinica ON public.pacientes USING btree (clinica_id);
CREATE INDEX idx_wallet_paciente ON public.wallet_movimientos USING btree (paciente_id);
CREATE INDEX idx_referidos_referidor ON public.referidos USING btree (paciente_referidor_id);
CREATE INDEX idx_pagos_registrado_por ON public.pagos USING btree (registrado_por);
CREATE INDEX idx_wallet_clinica ON public.wallet_movimientos USING btree (clinica_id);
CREATE INDEX idx_tratamientos_cita ON public.tratamientos_paciente USING btree (cita_id);
CREATE INDEX idx_puntos_canje ON public.puntos_movimientos USING btree (canje_id);
CREATE UNIQUE INDEX idx_puntos_origen_unico ON public.puntos_movimientos USING btree (origen_tipo, origen_id) WHERE (origen_tipo IS NOT NULL);
CREATE INDEX idx_pagos_canje ON public.pagos USING btree (canje_id);
CREATE UNIQUE INDEX idx_pagos_promocion_unica ON public.pagos USING btree (promocion_id, paciente_id) WHERE (promocion_id IS NOT NULL);
CREATE INDEX idx_pacientes_perfil ON public.pacientes USING btree (perfil_id);
CREATE INDEX idx_referidos_clinica ON public.referidos USING btree (clinica_id);

-- ===== FUNCIONES =====
CREATE OR REPLACE FUNCTION public.anular_pago(p_pago_id uuid, p_pin text, p_motivo text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_fila claves_supervisor%rowtype;
begin
  if not coalesce(es_admin_clinica(), false) then
    raise exception 'No autorizado';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    return 'motivo_requerido';
  end if;

  select * into v_fila from claves_supervisor where clinica_id = v_clinica for update;
  if not found then
    return 'sin_clave';
  end if;
  if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > now() then
    return 'bloqueado';
  end if;

  if p_pin is null or v_fila.pin_hash <> crypt(p_pin, v_fila.pin_hash) then
    update claves_supervisor
       set intentos_fallidos = intentos_fallidos + 1,
           bloqueado_hasta = case when intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' else bloqueado_hasta end
     where clinica_id = v_clinica;
    return 'pin_incorrecto';
  end if;

  update claves_supervisor set intentos_fallidos = 0, bloqueado_hasta = null where clinica_id = v_clinica;

  update pagos
     set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = trim(p_motivo)
   where id = p_pago_id and clinica_id = v_clinica and anulado_at is null;
  if not found then
    return 'no_encontrado';
  end if;

  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aplicar_canje(p_canje_id uuid, p_monto_bruto numeric, p_descuento numeric, p_tipo text, p_metodo_pago text, p_concepto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c canjes%rowtype;
  v_pago uuid;
  v_neto numeric;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;

  if p_tipo not in ('servicio', 'producto', 'membresia', 'otro')
     or p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    return jsonb_build_object('resultado', 'datos_invalidos');
  end if;
  if coalesce(trim(p_concepto), '') = '' then return jsonb_build_object('resultado', 'concepto_requerido'); end if;
  if p_monto_bruto is null or p_monto_bruto <= 0 then return jsonb_build_object('resultado', 'monto_invalido'); end if;
  if p_descuento is null or p_descuento <= 0 or p_descuento > p_monto_bruto then
    return jsonb_build_object('resultado', 'descuento_invalido');
  end if;
  if v_c.valor_descuento is not null and p_descuento > v_c.valor_descuento then
    return jsonb_build_object('resultado', 'descuento_excede_recompensa', 'maximo', v_c.valor_descuento);
  end if;

  v_neto := p_monto_bruto - p_descuento;
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, descuento, metodo_pago, direccion, registrado_por, canje_id)
  values (v_c.clinica_id, v_c.paciente_id,
          trim(p_concepto) || ' · Canje ' || v_c.codigo || ': ' || v_c.recompensa_nombre,
          p_tipo, v_neto, p_descuento, p_metodo_pago, 'ingreso', auth.uid(), v_c.id)
  returning id into v_pago;

  update canjes set estado = 'aplicado', fecha_resolucion = now(), resuelto_por = auth.uid(),
    descuento_aplicado = p_descuento, pago_id = v_pago
  where id = v_c.id;

  return jsonb_build_object('resultado', 'ok', 'pago_id', v_pago, 'cobrado', v_neto);
end $function$
;

CREATE OR REPLACE FUNCTION public.aplicar_promocion(p_clave uuid, p_promocion uuid, p_paciente uuid, p_monto_bruto numeric, p_tipo text, p_metodo_pago text, p_concepto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_promo promociones%rowtype;
  v_pago uuid;
  v_desc numeric;
  v_aplica boolean;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_clave is null then return jsonb_build_object('resultado', 'clave_requerida'); end if;
  perform pg_advisory_xact_lock(hashtext(p_promocion::text || p_paciente::text));

  select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
  if found then
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago);
  end if;

  select * into v_promo from promociones where id = p_promocion and clinica_id = v_clinica;
  if not found then return jsonb_build_object('resultado', 'no_encontrada'); end if;
  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;
  if v_promo.estado <> 'activa' or current_date not between v_promo.inicio and v_promo.fin then
    return jsonb_build_object('resultado', 'no_vigente');
  end if;
  select promo_aplica_segmento(v_promo.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
    into v_aplica from crm_calcular(v_clinica, p_paciente) f;
  if not coalesce(v_aplica, false) then return jsonb_build_object('resultado', 'no_elegible'); end if;
  if exists (select 1 from promocion_clientes where promocion_id = p_promocion and paciente_id = p_paciente and estado = 'utilizada') then
    return jsonb_build_object('resultado', 'ya_utilizada');
  end if;
  if p_tipo not in ('servicio', 'producto', 'membresia', 'otro') or p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    return jsonb_build_object('resultado', 'datos_invalidos');
  end if;
  if coalesce(trim(p_concepto), '') = '' then return jsonb_build_object('resultado', 'concepto_requerido'); end if;
  if p_monto_bruto is null or p_monto_bruto <= 0 then return jsonb_build_object('resultado', 'monto_invalido'); end if;

  v_desc := round(p_monto_bruto * v_promo.descuento_porcentaje / 100, 2);
  insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, descuento, metodo_pago, direccion, registrado_por, clave_operacion, promocion_id)
  values (v_clinica, p_paciente, trim(p_concepto) || ' · Promoción: ' || v_promo.titulo,
          p_tipo, p_monto_bruto - v_desc, v_desc, p_metodo_pago, 'ingreso', auth.uid(), p_clave, v_promo.id)
  returning id into v_pago;

  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, utilizada_at, pago_id)
  values (v_promo.id, v_clinica, p_paciente, 'utilizada', now(), v_pago)
  on conflict (promocion_id, paciente_id) do update set estado = 'utilizada', utilizada_at = now(), pago_id = v_pago;

  return jsonb_build_object('resultado', 'ok', 'repetido', false, 'pago_id', v_pago, 'descuento', v_desc, 'cobrado', p_monto_bruto - v_desc);
end $function$
;

CREATE OR REPLACE FUNCTION public.cancelar_canje(p_canje_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pac uuid := paciente_actual();
  v_c canjes%rowtype;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and paciente_id = v_pac for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;

  update canjes set estado = 'cancelado', fecha_resolucion = now() where id = v_c.id;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_c.clinica_id, v_c.paciente_id, 'ajuste', v_c.puntos,
          'Canje cancelado: ' || v_c.recompensa_nombre || ' (' || v_c.codigo || ')', v_c.id);
  return jsonb_build_object('resultado', 'ok', 'puntos_devueltos', v_c.puntos);
end $function$
;

CREATE OR REPLACE FUNCTION public.clinica_actual()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select clinica_id from perfiles where id = auth.uid() $function$
;

CREATE OR REPLACE FUNCTION public.clinica_publica_por_slug(p_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'activa', c.activa,
    'pais', c.pais, 'moneda', c.moneda, 'ciudad', c.ciudad, 'tipo_negocio', c.tipo_negocio,
    'logo_url', c.logo_url, 'fuente', c.fuente,
    'color_primario', c.color_primario, 'color_secundario', c.color_secundario, 'color_acento', c.color_acento,
    'tema_base_id', c.tema_base_id,
    'temas_base', to_jsonb(t))
  from clinicas c
  left join temas_base t on t.id = c.tema_base_id
  where c.slug = lower(trim(p_slug)) and c.activa = true
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.completar_pedido(p_pedido_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ped pedidos%rowtype;
  v_puntos integer;
  v_otorgado boolean;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_ped from pedidos where id = p_pedido_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_ped.estado = 'cancelado' then return jsonb_build_object('resultado', 'cancelado'); end if;

  select coalesce(sum(cantidad * puntos_unitarios), 0) into v_puntos from pedido_items where pedido_id = v_ped.id;
  if v_ped.estado <> 'entregado' then update pedidos set estado = 'entregado' where id = v_ped.id; end if;
  v_otorgado := otorgar_puntos(v_ped.clinica_id, v_ped.paciente_id, v_puntos, 'Compra en tienda completada', 'pedido', v_ped.id);
  return jsonb_build_object('resultado', 'ok', 'repetido', v_ped.estado = 'entregado',
                            'puntos_otorgados', case when v_otorgado then v_puntos else 0 end);
end $function$
;

CREATE OR REPLACE FUNCTION public.contacto_de_mi_clinica()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_pais text;
  r public.clinica_contacto%rowtype;
begin
  if v_clinica is null then return null; end if;
  select c.pais into v_pais from clinicas c where c.id = v_clinica;
  select * into r from clinica_contacto where clinica_id = v_clinica;
  return jsonb_build_object(
    'telefono', r.telefono_contacto,
    'telefono_marcar', case when r.telefono_contacto is null then null else regexp_replace(r.telefono_contacto, '[^0-9+]', '', 'g') end,
    'whatsapp', r.whatsapp_contacto,
    'whatsapp_wa', case when r.whatsapp_contacto is null then null else telefono_whatsapp(r.whatsapp_contacto, v_pais) end);
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_pedido(p_items jsonb, p_entrega text DEFAULT 'domicilio'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_total numeric := 0;
  v_pedido uuid;
  v_item jsonb;
  v_prod productos%rowtype;
  v_cant int;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  if p_entrega not in ('domicilio', 'recoger_clinica') then raise exception 'Entrega inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Pedido vacío'; end if;

  insert into pedidos (clinica_id, paciente_id, total, metodo_pago, entrega, estado)
  values (v_clinica, v_pac, 0, 'wallet', p_entrega, 'pendiente') returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::int;
    if v_cant is null or v_cant < 1 or v_cant > 100 then raise exception 'Cantidad inválida'; end if;
    select * into v_prod from productos
      where id = (v_item->>'producto_id')::uuid and clinica_id = v_clinica and activo;
    if not found then raise exception 'Producto no disponible'; end if;
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario, puntos_unitarios)
    values (v_pedido, v_prod.id, v_cant, v_prod.precio, v_prod.puntos_otorga);
    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido;
  return jsonb_build_object('pedido_id', v_pedido, 'total', v_total);
end $function$
;

CREATE OR REPLACE FUNCTION public.crear_perfil_y_paciente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid;
  v_nombre text;
  v_telefono text;
  v_pais text;
  v_fecha_nac date;
  v_rol text := 'paciente';
  v_codigo_invitacion text;
  v_invitacion_id uuid;
begin
  v_nombre := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1));
  v_telefono := new.raw_user_meta_data->>'telefono';
  v_pais := new.raw_user_meta_data->>'pais';
  v_codigo_invitacion := new.raw_user_meta_data->>'invitacion_codigo';

  -- una fecha inválida nunca debe impedir el registro
  begin
    v_fecha_nac := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
  exception when others then
    v_fecha_nac := null;
  end;
  if v_fecha_nac is not null and (v_fecha_nac < date '1900-01-01' or v_fecha_nac > current_date) then
    v_fecha_nac := null;
  end if;

  if v_codigo_invitacion is not null then
    select id, clinica_id into v_invitacion_id, v_clinica_id from invitaciones_admin
      where codigo = v_codigo_invitacion and usado = false for update;
    if v_invitacion_id is not null then v_rol := 'admin'; end if;
  end if;

  if v_clinica_id is null then
    v_clinica_id := (new.raw_user_meta_data->>'clinica_id')::uuid;
    if v_clinica_id is null then
      raise exception 'Registro sin negocio: usa el link o el QR de tu negocio';
    end if;
    if not exists (select 1 from clinicas where id = v_clinica_id and activa) then
      raise exception 'Este negocio no está disponible';
    end if;
  end if;

  insert into perfiles (id, clinica_id, nombre, telefono, pais, rol)
  values (new.id, v_clinica_id, v_nombre, v_telefono, v_pais, v_rol)
  on conflict (id) do nothing;

  if v_rol = 'admin' then
    update invitaciones_admin set usado = true, usado_por = new.id where id = v_invitacion_id;
  end if;

  if v_rol = 'paciente' then
    insert into pacientes (clinica_id, perfil_id, nombre, telefono, pais, email, fecha_nacimiento)
    values (v_clinica_id, new.id, v_nombre, v_telefono, v_pais, new.email, v_fecha_nac)
    on conflict do nothing;
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_calcular(p_clinica uuid, p_paciente uuid DEFAULT NULL::uuid)
 RETURNS TABLE(paciente_id uuid, nombre text, telefono text, email text, fecha_nacimiento date, fecha_registro timestamp with time zone, puntos bigint, nivel text, ultima_visita timestamp with time zone, proxima_cita timestamp with time zone, visitas_completadas integer, visitas_90d integer, ultimo_servicio text, dias_inactivo integer, total_cobrado numeric, pedidos integer, referidos integer, membresia_activa boolean, es_nuevo boolean, es_frecuente boolean, es_vip boolean, es_inactivo boolean, sin_proxima_cita boolean, cumple_este_mes boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_clinica uuid := p_clinica;
  v_dias integer;
begin
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  return query
  with pts as (
    select m.paciente_id, sum(m.puntos)::bigint as total
    from puntos_movimientos m where m.clinica_id = v_clinica and (p_paciente is null or m.paciente_id = p_paciente) group by m.paciente_id),
  cit as (
    select c.paciente_id,
      max(c.fecha_hora) filter (where c.estado = 'completada') as ultima,
      min(c.fecha_hora) filter (where c.estado in ('pendiente', 'confirmada') and c.fecha_hora > now()) as proxima,
      (count(*) filter (where c.estado = 'completada'))::integer as visitas,
      (count(*) filter (where c.estado = 'completada' and c.fecha_hora >= now() - interval '90 days'))::integer as visitas90
    from citas c where c.clinica_id = v_clinica and (p_paciente is null or c.paciente_id = p_paciente) group by c.paciente_id),
  ult as (
    select distinct on (c.paciente_id) c.paciente_id, coalesce(s.nombre, c.tratamiento) as servicio
    from citas c left join servicios s on s.id = c.servicio_id
    where c.clinica_id = v_clinica and c.estado = 'completada' and (p_paciente is null or c.paciente_id = p_paciente)
    order by c.paciente_id, c.fecha_hora desc),
  pag as (
    select g.paciente_id, sum(g.monto) as total
    from pagos g where g.clinica_id = v_clinica and g.direccion = 'ingreso'
      and g.anulado_at is null and g.paciente_id is not null and (p_paciente is null or g.paciente_id = p_paciente) group by g.paciente_id),
  ped as (
    select d.paciente_id, (count(*))::integer as n
    from pedidos d where d.clinica_id = v_clinica and d.estado <> 'cancelado' and (p_paciente is null or d.paciente_id = p_paciente) group by d.paciente_id),
  ref as (
    select r.paciente_referidor_id as paciente_id, (count(*))::integer as n
    from referidos r where r.clinica_id = v_clinica and (p_paciente is null or r.paciente_referidor_id = p_paciente) group by r.paciente_referidor_id),
  mem as (
    select distinct pm.paciente_id from paciente_membresias pm
    where pm.clinica_id = v_clinica and pm.estado = 'activa' and (p_paciente is null or pm.paciente_id = p_paciente)
      and (pm.fecha_fin is null or pm.fecha_fin >= current_date)),
  base as (
    select p.id as pid, p.nombre as pnombre, p.telefono as ptel, p.email as pemail,
      p.fecha_nacimiento as pnac, p.fecha_registro as preg,
      coalesce(pts.total, 0)::bigint as ppuntos,
      cit.ultima as pultima, cit.proxima as pproxima,
      coalesce(cit.visitas, 0) as pvisitas, coalesce(cit.visitas90, 0) as pvisitas90,
      ult.servicio as pservicio,
      case when cit.ultima is null then null else (current_date - cit.ultima::date) end as pdias,
      pag.total as pcobrado, coalesce(ped.n, 0) as ppedidos, coalesce(ref.n, 0) as preferidos,
      (mem.paciente_id is not null) as pmem
    from pacientes p
      left join pts on pts.paciente_id = p.id
      left join cit on cit.paciente_id = p.id
      left join ult on ult.paciente_id = p.id
      left join pag on pag.paciente_id = p.id
      left join ped on ped.paciente_id = p.id
      left join ref on ref.paciente_id = p.id
      left join mem on mem.paciente_id = p.id
    where p.clinica_id = v_clinica and (p_paciente is null or p.id = p_paciente))
  select b.pid, b.pnombre, b.ptel, b.pemail, b.pnac, b.preg,
    b.ppuntos, nivel_por_puntos(v_clinica, b.ppuntos),
    b.pultima, b.pproxima, b.pvisitas, b.pvisitas90, b.pservicio, b.pdias,
    b.pcobrado, b.ppedidos, b.preferidos, b.pmem,
    (b.preg >= now() - interval '30 days'),
    (b.pvisitas90 >= 3),
    (nivel_por_puntos(v_clinica, b.ppuntos) in ('gold', 'platinum')),
    (b.pultima is not null and b.pproxima is null and b.pdias >= v_dias),
    (b.pvisitas > 0 and b.pproxima is null),
    (b.pnac is not null and extract(month from b.pnac) = extract(month from current_date))
  from base b;
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_cliente_360(p_paciente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_pac pacientes%rowtype;
  v_cfg clinicas%rowtype;
  v_puntos bigint;
  v_ultima timestamptz;
  v_proxima timestamptz;
begin
  select * into v_pac from pacientes where id = p_paciente_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
  if not crm_puede_ver(v_pac.clinica_id) then raise exception 'No autorizado'; end if;
  select * into v_cfg from clinicas where id = v_pac.clinica_id;

  select coalesce(sum(m.puntos), 0) into v_puntos from puntos_movimientos m where m.paciente_id = p_paciente_id;
  select max(c.fecha_hora) filter (where c.estado = 'completada'),
         min(c.fecha_hora) filter (where c.estado in ('pendiente', 'confirmada') and c.fecha_hora > now())
    into v_ultima, v_proxima from citas c where c.paciente_id = p_paciente_id;

  return jsonb_build_object(
    'moneda', v_cfg.moneda,
    'dias_inactividad', v_cfg.dias_inactividad,
    'paciente', jsonb_build_object(
      'id', v_pac.id, 'clinica_id', v_pac.clinica_id, 'nombre', v_pac.nombre, 'telefono', v_pac.telefono,
      'email', v_pac.email, 'fecha_nacimiento', v_pac.fecha_nacimiento, 'fecha_registro', v_pac.fecha_registro),
    'fidelidad', jsonb_build_object(
      'puntos', v_puntos,
      'nivel', nivel_por_puntos(v_pac.clinica_id, v_puntos),
      'recientes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
          select m.fecha, m.tipo, m.puntos, m.motivo from puntos_movimientos m
          where m.paciente_id = p_paciente_id order by m.fecha desc nulls last limit 5) x),
      'canjes', (select jsonb_build_object('cantidad', count(*), 'puntos', coalesce(sum(-m.puntos), 0),
            'pendientes', (select count(*) from canjes k where k.paciente_id = p_paciente_id and k.estado = 'pendiente'))
          from puntos_movimientos m left join canjes c on c.id = m.canje_id
          where m.paciente_id = p_paciente_id and m.tipo = 'canje' and (c.id is null or c.estado = 'aplicado')),
      'membresia', (select to_jsonb(y) from (
          select mb.nombre, mb.nivel, pm.estado, pm.fecha_inicio, pm.fecha_fin
          from paciente_membresias pm join membresias mb on mb.id = pm.membresia_id
          where pm.paciente_id = p_paciente_id and pm.estado = 'activa'
            and (pm.fecha_fin is null or pm.fecha_fin >= current_date)
          order by pm.fecha_inicio desc limit 1) y)),
    'actividad', jsonb_build_object(
      'ultima_visita', v_ultima,
      'proxima_cita', v_proxima,
      'dias_inactivo', case when v_ultima is null then null else (current_date - v_ultima::date) end,
      'citas_completadas', (select count(*) from citas c where c.paciente_id = p_paciente_id and c.estado = 'completada'),
      'citas_canceladas', (select count(*) from citas c where c.paciente_id = p_paciente_id and c.estado = 'cancelada'),
      'ultimo_servicio', (select coalesce(s.nombre, c.tratamiento) from citas c left join servicios s on s.id = c.servicio_id
          where c.paciente_id = p_paciente_id and c.estado = 'completada' order by c.fecha_hora desc limit 1),
      'servicios', (select coalesce(jsonb_agg(jsonb_build_object('nombre', t.n, 'veces', t.v) order by t.v desc), '[]'::jsonb) from (
          select coalesce(s.nombre, c.tratamiento, 'Sin especificar') as n, count(*) as v
          from citas c left join servicios s on s.id = c.servicio_id
          where c.paciente_id = p_paciente_id and c.estado = 'completada' group by 1) t),
      'pedidos', (select jsonb_build_object('cantidad', count(*), 'total', coalesce(sum(d.total), 0))
          from pedidos d where d.paciente_id = p_paciente_id and d.estado <> 'cancelado'),
      'productos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', t.n, 'cantidad', t.q) order by t.q desc), '[]'::jsonb) from (
          select pr.nombre as n, sum(i.cantidad) as q
          from pedido_items i join pedidos d on d.id = i.pedido_id join productos pr on pr.id = i.producto_id
          where d.paciente_id = p_paciente_id and d.estado <> 'cancelado' group by pr.nombre) t),
      'referidos', (select jsonb_build_object('total', count(*),
          'registrados', count(*) filter (where r.estado in ('registrado', 'recompensado')),
          'recompensados', count(*) filter (where r.estado = 'recompensado'))
          from referidos r where r.paciente_referidor_id = p_paciente_id),
      'tratamientos_registrados', (select count(*) from tratamientos_paciente t where t.paciente_id = p_paciente_id)),
    'finanzas', jsonb_build_object(
      'total_cobrado', (select coalesce(sum(g.monto), 0) from pagos g
          where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null),
      'cobros', (select count(*) from pagos g
          where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null)));
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_cliente_timeline(p_paciente_id uuid, p_limite integer DEFAULT 100)
 RETURNS TABLE(fecha timestamp with time zone, tipo text, descripcion text, valor numeric, unidad text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare v_clinica uuid;
begin
  select p.clinica_id into v_clinica from pacientes p where p.id = p_paciente_id;
  if v_clinica is null then raise exception 'Cliente no encontrado'; end if;
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;

  return query
  select e.fecha, e.tipo, e.descripcion, e.valor, e.unidad from (
    select c.fecha_hora as fecha, 'cita'::text as tipo,
      (case c.estado when 'pendiente' then 'Cita pendiente' when 'confirmada' then 'Cita confirmada'
                     when 'completada' then 'Cita completada' else 'Cita cancelada' end
       || ' · ' || coalesce(s.nombre, c.tratamiento, 'Sin servicio')) as descripcion,
      null::numeric as valor, null::text as unidad
    from citas c left join servicios s on s.id = c.servicio_id where c.paciente_id = p_paciente_id
    union all
    select g.fecha, 'pago', g.concepto || ' (' || g.metodo_pago || ')', g.monto, 'moneda'
    from pagos g where g.paciente_id = p_paciente_id and g.direccion = 'ingreso' and g.anulado_at is null
    union all
    select d.fecha, 'compra', 'Pedido en tienda · ' || d.estado, d.total, 'moneda'
    from pedidos d where d.paciente_id = p_paciente_id
    union all
    select m.fecha,
      case m.tipo when 'acumulacion' then 'puntos_ganados' when 'canje' then 'puntos_canjeados' else 'puntos_ajuste' end,
      coalesce(m.motivo, case m.tipo when 'acumulacion' then 'Puntos ganados' when 'canje' then 'Canje de puntos' else 'Ajuste de puntos' end),
      m.puntos::numeric, 'puntos'
    from puntos_movimientos m where m.paciente_id = p_paciente_id
    union all
    select r.fecha, 'referido', 'Invitó a ' || coalesce(r.telefono_referido, 'un contacto') || ' · ' || r.estado, null::numeric, null::text
    from referidos r where r.paciente_referidor_id = p_paciente_id
    union all
    select pm.fecha_inicio::timestamptz, 'membresia', 'Membresía ' || mb.nombre || ' · ' || pm.estado, null::numeric, null::text
    from paciente_membresias pm join membresias mb on mb.id = pm.membresia_id where pm.paciente_id = p_paciente_id
    union all
    select t.fecha, 'tratamiento', t.procedimiento, null::numeric, null::text
    from tratamientos_paciente t where t.paciente_id = p_paciente_id
    union all
    select r.created_at, 'reactivacion', 'Se inició un contacto por WhatsApp para invitarlo a volver (no se sabe si se envió el mensaje)', null::numeric, null::text
    from crm_reactivaciones r where r.paciente_id = p_paciente_id
  ) e
  order by e.fecha desc nulls last
  limit greatest(p_limite, 1);
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_clientes(p_clinica_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(paciente_id uuid, nombre text, telefono text, email text, fecha_nacimiento date, fecha_registro timestamp with time zone, puntos bigint, nivel text, ultima_visita timestamp with time zone, proxima_cita timestamp with time zone, visitas_completadas integer, visitas_90d integer, ultimo_servicio text, dias_inactivo integer, total_cobrado numeric, pedidos integer, referidos integer, membresia_activa boolean, es_nuevo boolean, es_frecuente boolean, es_vip boolean, es_inactivo boolean, sin_proxima_cita boolean, cumple_este_mes boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  return query select * from crm_calcular(v_clinica);
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_puede_ver(p_clinica uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select p_clinica is not null and (
    (coalesce(es_admin_clinica(), false) and p_clinica = clinica_actual())
    or coalesce(es_super_admin_global(), false))
$function$
;

CREATE OR REPLACE FUNCTION public.crm_resumen(p_clinica_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := coalesce(p_clinica_id, clinica_actual());
  v_dias integer;
  v_out jsonb;
  v_desde timestamptz;
  v_recuperados integer;
begin
  if not crm_puede_ver(v_clinica) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  if v_dias is null then raise exception 'Negocio no encontrado'; end if;

  select jsonb_build_object(
    'total', count(*),
    'nuevos_30d', count(*) filter (where es_nuevo),
    'recurrentes', count(*) filter (where visitas_completadas >= 2),
    'inactivos', count(*) filter (where es_inactivo),
    'sin_proxima_cita', count(*) filter (where sin_proxima_cita),
    'dias_inactividad', v_dias)
  into v_out from crm_clientes(v_clinica);

  -- Recuperado: cita COMPLETADA que se reservó cuando el cliente ya llevaba
  -- `dias_inactividad` días sin visitar, y se reservó antes o el mismo día de la visita.
  select min(c.creada_at) into v_desde from citas c where c.clinica_id = v_clinica and c.creada_at is not null;
  with comp as (
    select c.paciente_id, c.creada_at, c.fecha_hora,
      lag(c.fecha_hora) over (partition by c.paciente_id order by c.fecha_hora) as previa
    from citas c where c.clinica_id = v_clinica and c.estado = 'completada')
  select count(distinct comp.paciente_id)::integer into v_recuperados from comp
  where comp.previa is not null and comp.creada_at is not null
    and comp.creada_at >= comp.previa + make_interval(days => v_dias)
    and comp.creada_at::date <= comp.fecha_hora::date;

  return v_out || jsonb_build_object('recuperados', v_recuperados, 'recuperados_desde', v_desde);
end $function$
;

CREATE OR REPLACE FUNCTION public.definir_clave_supervisor(p_pin_nuevo text, p_pin_actual text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_fila claves_supervisor%rowtype;
begin
  if not coalesce(es_admin_clinica(), false) then
    raise exception 'No autorizado';
  end if;
  if p_pin_nuevo is null or p_pin_nuevo !~ '^[0-9]{4,8}$' then
    return 'formato';
  end if;

  select * into v_fila from claves_supervisor where clinica_id = v_clinica for update;

  if found then
    if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > now() then
      return 'bloqueado';
    end if;
    if p_pin_actual is null or v_fila.pin_hash <> crypt(p_pin_actual, v_fila.pin_hash) then
      update claves_supervisor
         set intentos_fallidos = intentos_fallidos + 1,
             bloqueado_hasta = case when intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' else bloqueado_hasta end
       where clinica_id = v_clinica;
      return 'pin_actual_incorrecto';
    end if;
    update claves_supervisor
       set pin_hash = crypt(p_pin_nuevo, gen_salt('bf')), intentos_fallidos = 0, bloqueado_hasta = null
     where clinica_id = v_clinica;
  else
    insert into claves_supervisor (clinica_id, pin_hash)
    values (v_clinica, crypt(p_pin_nuevo, gen_salt('bf')));
  end if;

  return 'ok';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.es_admin_clinica()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select rol = 'admin' and clinica_id is not null from perfiles where id = auth.uid() $function$
;

CREATE OR REPLACE FUNCTION public.es_super_admin_global()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select coalesce(es_super_admin, false) from perfiles where id = auth.uid() $function$
;

CREATE OR REPLACE FUNCTION public.fijar_creada_at_cita()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.creada_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.generar_codigo_referido(p_paciente_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select upper(left(regexp_replace(nombre, '[^a-zA-Z]', '', 'g'), 6)) || right(id::text, 4)
  from pacientes where id = p_paciente_id
$function$
;

CREATE OR REPLACE FUNCTION public.generar_invitacion_admin(p_clinica_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_codigo text;
begin
  if not es_super_admin_global() then
    raise exception 'No autorizado';
  end if;
  v_codigo := encode(gen_random_bytes(9), 'base64');
  v_codigo := replace(replace(replace(v_codigo, '/', ''), '+', ''), '=', '');
  insert into invitaciones_admin (clinica_id, codigo) values (p_clinica_id, v_codigo);
  return v_codigo;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_promocion(p_promocion uuid, p_accion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  if p_accion not in ('vista', 'descartar') then return jsonb_build_object('resultado', 'accion_invalida'); end if;
  if not exists (select 1 from mis_promociones() m where m.id = p_promocion) then
    return jsonb_build_object('resultado', 'no_disponible');
  end if;

  if p_accion = 'vista' then
    insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado, vista_at)
    values (p_promocion, v_clinica, v_pac, 'vista', now())
    on conflict (promocion_id, paciente_id) do update
      set estado = case when promocion_clientes.estado in ('utilizada', 'descartada') then promocion_clientes.estado else 'vista' end,
          vista_at = coalesce(promocion_clientes.vista_at, now());
  else
    insert into promocion_clientes (promocion_id, clinica_id, paciente_id, estado)
    values (p_promocion, v_clinica, v_pac, 'descartada')
    on conflict (promocion_id, paciente_id) do update
      set estado = case when promocion_clientes.estado = 'utilizada' then 'utilizada' else 'descartada' end;
  end if;
  return jsonb_build_object('resultado', 'ok');
end $function$
;

CREATE OR REPLACE FUNCTION public.mis_promociones()
 RETURNS TABLE(id uuid, titulo text, descripcion text, descuento_porcentaje numeric, fin date, servicio_id uuid, servicio_nombre text, estado text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.titulo, p.descripcion, p.descuento_porcentaje, p.fin, p.servicio_id, s.nombre,
         coalesce(pc.estado, 'disponible')
  from promociones p
  join crm_calcular(v_clinica, v_pac) f
    on promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
  left join servicios s on s.id = p.servicio_id
  left join promocion_clientes pc on pc.promocion_id = p.id and pc.paciente_id = v_pac
  where p.clinica_id = v_clinica and p.estado = 'activa' and current_date between p.inicio and p.fin
    and coalesce(pc.estado, 'disponible') <> 'descartada'
  order by p.fin, p.creada_at;
end $function$
;

CREATE OR REPLACE FUNCTION public.nivel_por_puntos(p_clinica uuid, p_puntos bigint)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case when p_puntos >= c.umbral_platino then 'platinum'
              when p_puntos >= c.umbral_oro then 'gold'
              else 'silver' end
  from clinicas c where c.id = p_clinica
$function$
;

CREATE OR REPLACE FUNCTION public.otorgar_puntos(p_clinica uuid, p_paciente uuid, p_puntos integer, p_motivo text, p_origen_tipo text, p_origen_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_filas integer;
begin
  if p_puntos is null or p_puntos <= 0 then return false; end if;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, origen_tipo, origen_id)
  values (p_clinica, p_paciente, 'acumulacion', p_puntos, p_motivo, p_origen_tipo, p_origen_id)
  on conflict (origen_tipo, origen_id) where origen_tipo is not null do nothing;
  get diagnostics v_filas = row_count;
  return v_filas > 0;
end $function$
;

CREATE OR REPLACE FUNCTION public.paciente_actual()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select id from pacientes where perfil_id = auth.uid() $function$
;

CREATE OR REPLACE FUNCTION public.promo_aplica_segmento(p_segmento text, p_nuevo boolean, p_frecuente boolean, p_vip boolean, p_inactivo boolean, p_sin_proxima boolean, p_cumple boolean, p_membresia boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_segmento
    when 'todos' then true
    when 'nuevos' then p_nuevo
    when 'frecuentes' then p_frecuente
    when 'vip' then p_vip
    when 'inactivos' then p_inactivo
    when 'sin_proxima' then p_sin_proxima
    when 'cumple' then p_cumple
    when 'membresia' then p_membresia
    else false end
$function$
;

CREATE OR REPLACE FUNCTION public.promocion_para_banner()
 RETURNS TABLE(id uuid, titulo text, descripcion text, descuento_porcentaje numeric, fin date, servicio_id uuid, servicio_nombre text, estado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_dias integer;
  v_quiere boolean;
  v_elegida record;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select coalesce(promociones_ofertas, true) into v_quiere from perfiles where id = auth.uid();
  if not coalesce(v_quiere, true) then return; end if;
  select promo_frecuencia_dias into v_dias from clinicas where id = v_clinica;

  -- ya se le mostró algún aviso dentro de la ventana: no se le muestra otro
  if exists (select 1 from promocion_clientes pc
             where pc.paciente_id = v_pac and pc.ultima_vez_mostrada >= now() - make_interval(days => v_dias)) then
    return;
  end if;

  select m.* into v_elegida
  from mis_promociones() m
  where m.estado = 'disponible'
  order by m.fin limit 1;
  if v_elegida.id is null then return; end if;

  insert into promocion_clientes (promocion_id, clinica_id, paciente_id, veces_mostrada, ultima_vez_mostrada)
  values (v_elegida.id, v_clinica, v_pac, 1, now())
  on conflict (promocion_id, paciente_id) do update
    set veces_mostrada = promocion_clientes.veces_mostrada + 1, ultima_vez_mostrada = now();

  id := v_elegida.id; titulo := v_elegida.titulo; descripcion := v_elegida.descripcion;
  descuento_porcentaje := v_elegida.descuento_porcentaje; fin := v_elegida.fin;
  servicio_id := v_elegida.servicio_id; servicio_nombre := v_elegida.servicio_nombre; estado := v_elegida.estado;
  return next;
end $function$
;

CREATE OR REPLACE FUNCTION public.promociones_aplicables(p_paciente uuid)
 RETURNS TABLE(id uuid, titulo text, descuento_porcentaje numeric, fin date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare v_clinica uuid := clinica_actual();
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then return; end if;
  return query
  select v.id, v.titulo, v.descuento_porcentaje, v.fin from promociones_vigentes_de(v_clinica, p_paciente) v order by v.fin;
end $function$
;

CREATE OR REPLACE FUNCTION public.promociones_resumen()
 RETURNS TABLE(promocion_id uuid, elegibles integer, vistas integer, descartadas integer, utilizadas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare v_clinica uuid := clinica_actual();
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  return query
  with f as materialized (select * from crm_calcular(v_clinica))
  select p.id,
    (select count(*) from f where promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa))::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.vista_at is not null)::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.estado = 'descartada')::integer,
    (select count(*) from promocion_clientes pc where pc.promocion_id = p.id and pc.estado = 'utilizada')::integer
  from promociones p where p.clinica_id = v_clinica;
end $function$
;

CREATE OR REPLACE FUNCTION public.promociones_vigentes_de(p_clinica uuid, p_paciente uuid)
 RETURNS TABLE(id uuid, titulo text, descuento_porcentaje numeric, fin date, segmento text, servicio_nombre text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  return query
  select p.id, p.titulo, p.descuento_porcentaje, p.fin, p.segmento, s.nombre
  from promociones p
  join crm_calcular(p_clinica, p_paciente) f
    on promo_aplica_segmento(p.segmento, f.es_nuevo, f.es_frecuente, f.es_vip, f.es_inactivo, f.sin_proxima_cita, f.cumple_este_mes, f.membresia_activa)
  left join servicios s on s.id = p.servicio_id
  where p.clinica_id = p_clinica and p.estado = 'activa' and current_date between p.inicio and p.fin
    and not exists (select 1 from promocion_clientes pc where pc.promocion_id = p.id and pc.paciente_id = p_paciente and pc.estado = 'utilizada');
end $function$
;

CREATE OR REPLACE FUNCTION public.proteger_campos_clinica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not coalesce(es_super_admin_global(), false) then
    if new.id is distinct from old.id
       or new.plan is distinct from old.plan
       or new.activa is distinct from old.activa
       or new.slug is distinct from old.slug
       or new.dominio_propio is distinct from old.dominio_propio then
      raise exception 'Solo Melissa puede modificar el plan, el estado o el slug del negocio';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.puntos_por_cita_completada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_serv record;
begin
  if new.servicio_id is null then return new; end if;   -- citas antiguas solo con texto: no se adivina el servicio
  select nombre, puntos_otorga into v_serv from servicios where id = new.servicio_id;
  if found and v_serv.puntos_otorga > 0 then
    perform otorgar_puntos(new.clinica_id, new.paciente_id, v_serv.puntos_otorga,
                           'Servicio completado: ' || v_serv.nombre, 'cita', new.id);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_base(p_clinica uuid)
 RETURNS TABLE(paciente_id uuid, nombre text, telefono text, telefono_wa text, ultima_visita timestamp with time zone, dias_inactivo integer, visitas integer, ultimo_servicio text, nivel text, total_cobrado numeric, exclusion text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare v_cool integer := reactivacion_cooldown_dias();
begin
  return query
  select f.paciente_id, f.nombre, f.telefono, telefono_whatsapp(f.telefono, p.pais), f.ultima_visita, f.dias_inactivo,
         f.visitas_completadas, f.ultimo_servicio, f.nivel, f.total_cobrado,
         case
           when exists (select 1 from crm_reactivaciones r where r.paciente_id = f.paciente_id
                          and r.created_at > now() - make_interval(days => v_cool)) then 'en_pausa'
           when pf.promociones_ofertas is false then 'no_desea'
           else null end
  from crm_calcular(p_clinica) f
  join pacientes p on p.id = f.paciente_id
  left join perfiles pf on pf.id = p.perfil_id
  where f.es_inactivo;
end $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_cooldown_dias()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 30 $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_limite_diario()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 30 $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_oportunidades()
 RETURNS TABLE(paciente_id uuid, nombre text, telefono text, telefono_wa text, ultima_visita timestamp with time zone, dias_inactivo integer, visitas integer, ultimo_servicio text, nivel text, prioridad text, puntaje integer, motivos text[], promocion_id uuid, promocion_titulo text, promocion_descuento numeric, promocion_servicio text, promocion_segmento text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_clinica uuid := clinica_actual();
  v_umbral integer;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_umbral from clinicas c where c.id = v_clinica;

  return query
  with b as (select * from reactivacion_base(v_clinica) where exclusion is null),
  c as (
    select b.*, pr.id as pr_id, pr.titulo as pr_titulo, pr.descuento_porcentaje as pr_desc,
           pr.servicio_nombre as pr_serv, pr.segmento as pr_seg,
           (case when b.visitas >= 3 then 2 when b.visitas = 2 then 1 else 0 end)
           + (case when coalesce(b.total_cobrado, 0) > 0 then 1 else 0 end)
           + (case when b.dias_inactivo >= 2 * v_umbral then 1 else 0 end)
           + (case when pr.id is not null then 1 else 0 end) as pts
    from b
    left join lateral (select v.* from promociones_vigentes_de(v_clinica, b.paciente_id) v
                       order by v.descuento_porcentaje desc, v.fin limit 1) pr on true)
  select c.paciente_id, c.nombre, c.telefono, c.telefono_wa, c.ultima_visita, c.dias_inactivo, c.visitas,
         c.ultimo_servicio, c.nivel,
         case when c.pts >= 3 then 'alta' when c.pts = 2 then 'media' else 'baja' end,
         c.pts,
         array_remove(array[
           'No ha regresado y no tiene próxima cita',
           case when c.visitas >= 2 then c.visitas || ' visitas anteriores' else 'Solo 1 visita anterior' end,
           case when coalesce(c.total_cobrado, 0) > 0 then 'Tiene historial de consumo registrado' end,
           'Lleva ' || c.dias_inactivo || ' días sin volver',
           case when c.pr_id is not null then 'Tiene una promoción vigente que le corresponde' end
         ]::text[], null),
         c.pr_id, c.pr_titulo, c.pr_desc, c.pr_serv, c.pr_seg
  from c
  order by c.pts desc, c.visitas desc, c.dias_inactivo desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_resumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_limite integer := reactivacion_limite_diario();
  v_cool integer := reactivacion_cooldown_dias();
  v_vent integer := reactivacion_ventana_regreso_dias();
  v_dias integer;
  v_usadas integer;
  v_out jsonb;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select c.dias_inactividad into v_dias from clinicas c where c.id = v_clinica;
  select count(*) into v_usadas from crm_reactivaciones r where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours';

  select jsonb_build_object(
    'oportunidades', count(*) filter (where o.telefono_wa is not null),
    'alta', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'alta'),
    'media', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'media'),
    'baja', count(*) filter (where o.telefono_wa is not null and o.prioridad = 'baja'),
    'sin_telefono', count(*) filter (where o.telefono_wa is null))
  into v_out from reactivacion_oportunidades() o;

  v_out := v_out || (select jsonb_build_object(
      'en_pausa', count(*) filter (where b.exclusion = 'en_pausa'),
      'no_desean', count(*) filter (where b.exclusion = 'no_desea'))
    from reactivacion_base(v_clinica) b);

  return v_out || jsonb_build_object(
    'dias_inactividad', v_dias,
    'contactos_24h', v_usadas, 'limite_diario', v_limite, 'restantes', greatest(v_limite - v_usadas, 0),
    'libre_desde', case when v_usadas >= v_limite then
      (select r.created_at + interval '24 hours' from crm_reactivaciones r
        where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours'
        order by r.created_at offset (v_usadas - v_limite) limit 1) end,
    'cooldown_dias', v_cool, 'ventana_dias', v_vent,
    'medicion_desde', (select min(r.created_at) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_total', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica),
    'acciones_con_promocion', (select count(*) from crm_reactivaciones r where r.clinica_id = v_clinica and r.promocion_id is not null),
    'citas_posteriores', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at and c.creada_at <= a.created_at + make_interval(days => v_vent)
         and c.fecha_hora >= a.created_at
       where c.clinica_id = v_clinica and c.estado <> 'cancelada'),
    'regresaron', (select count(distinct c.paciente_id) from citas c
        join crm_reactivaciones a on a.paciente_id = c.paciente_id and a.clinica_id = v_clinica
         and c.creada_at >= a.created_at
         and c.fecha_hora >= a.created_at and c.fecha_hora <= a.created_at + make_interval(days => v_vent)
       where c.clinica_id = v_clinica and c.estado = 'completada'),
    'promos_usadas', (select count(*) from crm_reactivaciones a
        join promocion_clientes pc on pc.promocion_id = a.promocion_id and pc.paciente_id = a.paciente_id and pc.estado = 'utilizada'
         and pc.utilizada_at >= a.created_at and pc.utilizada_at <= a.created_at + make_interval(days => v_vent)
       where a.clinica_id = v_clinica and a.promocion_id is not null));
end $function$
;

CREATE OR REPLACE FUNCTION public.reactivacion_ventana_regreso_dias()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 60 $function$
;

CREATE OR REPLACE FUNCTION public.rechazar_canje(p_canje_id uuid, p_nota text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c canjes%rowtype;
  v_nota text := nullif(trim(p_nota), '');
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  select * into v_c from canjes where id = p_canje_id and clinica_id = clinica_actual() for update;
  if not found then return jsonb_build_object('resultado', 'no_encontrado'); end if;
  if v_c.estado <> 'pendiente' then return jsonb_build_object('resultado', 'ya_resuelto'); end if;
  if v_nota is null then return jsonb_build_object('resultado', 'motivo_requerido'); end if;

  update canjes set estado = 'rechazado', fecha_resolucion = now(), resuelto_por = auth.uid(), nota = v_nota
  where id = v_c.id;
  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_c.clinica_id, v_c.paciente_id, 'ajuste', v_c.puntos,
          'Canje rechazado: ' || v_c.recompensa_nombre || ' (' || v_c.codigo || ') — ' || v_nota, v_c.id);
  return jsonb_build_object('resultado', 'ok', 'puntos_devueltos', v_c.puntos);
end $function$
;

CREATE OR REPLACE FUNCTION public.registrar_contacto_reactivacion(p_paciente uuid, p_promocion uuid DEFAULT NULL::uuid, p_plantilla text DEFAULT 'sin_promocion'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_limite integer := reactivacion_limite_diario();
  v_cool integer := reactivacion_cooldown_dias();
  v_usadas integer;
  v_op record;
  v_ultimo timestamptz;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_plantilla not in ('sin_promocion', 'con_promocion', 'frecuente_vip') then
    return jsonb_build_object('resultado', 'plantilla_invalida');
  end if;
  perform pg_advisory_xact_lock(hashtext('reactivacion:' || v_clinica::text));

  if not exists (select 1 from pacientes where id = p_paciente and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;

  select max(r.created_at) into v_ultimo from crm_reactivaciones r
   where r.paciente_id = p_paciente and r.created_at > now() - make_interval(days => v_cool);
  if v_ultimo is not null then
    return jsonb_build_object('resultado', 'en_cooldown', 'disponible_desde', v_ultimo + make_interval(days => v_cool));
  end if;

  select count(*) into v_usadas from crm_reactivaciones r
   where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours';
  if v_usadas >= v_limite then
    return jsonb_build_object('resultado', 'limite_diario', 'limite', v_limite,
      'libre_desde', (select r.created_at + interval '24 hours' from crm_reactivaciones r
                       where r.clinica_id = v_clinica and r.created_at > now() - interval '24 hours'
                       order by r.created_at offset (v_usadas - v_limite) limit 1));
  end if;

  select * into v_op from reactivacion_oportunidades() o where o.paciente_id = p_paciente;
  if v_op.paciente_id is null or v_op.telefono_wa is null then
    return jsonb_build_object('resultado', 'no_oportunidad');
  end if;
  if p_promocion is not null and not exists (select 1 from promociones_vigentes_de(v_clinica, p_paciente) v where v.id = p_promocion) then
    return jsonb_build_object('resultado', 'promocion_no_aplicable');
  end if;

  insert into crm_reactivaciones (clinica_id, paciente_id, plantilla, promocion_id, prioridad, ultima_visita_previa, dias_inactivo, visitas_previas)
  values (v_clinica, p_paciente, p_plantilla, p_promocion, v_op.prioridad, v_op.ultima_visita, v_op.dias_inactivo, v_op.visitas);

  return jsonb_build_object('resultado', 'ok', 'telefono_wa', v_op.telefono_wa, 'restantes', v_limite - v_usadas - 1, 'limite', v_limite);
end $function$
;

CREATE OR REPLACE FUNCTION public.registrar_venta_producto(p_clave uuid, p_producto_id uuid, p_cantidad integer, p_metodo_pago text, p_paciente_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := clinica_actual();
  v_prod productos%rowtype;
  v_pago uuid;
  v_puntos integer := 0;
  v_otorgado boolean := false;
begin
  if not coalesce(es_admin_clinica(), false) then raise exception 'No autorizado'; end if;
  if p_clave is null then return jsonb_build_object('resultado', 'clave_requerida'); end if;

  select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
  if found then
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago,
      'puntos_otorgados', coalesce((select puntos from puntos_movimientos where origen_tipo = 'venta' and origen_id = v_pago), 0));
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then return jsonb_build_object('resultado', 'cantidad_invalida'); end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then return jsonb_build_object('resultado', 'datos_invalidos'); end if;
  select * into v_prod from productos where id = p_producto_id and clinica_id = v_clinica and activo;
  if not found then return jsonb_build_object('resultado', 'producto_no_disponible'); end if;
  if p_paciente_id is not null and not exists (select 1 from pacientes where id = p_paciente_id and clinica_id = v_clinica) then
    return jsonb_build_object('resultado', 'cliente_invalido');
  end if;

  begin
    insert into pagos (clinica_id, paciente_id, concepto, tipo, monto, metodo_pago, direccion, registrado_por, clave_operacion)
    values (v_clinica, p_paciente_id,
            'Venta: ' || v_prod.nombre || case when p_cantidad > 1 then ' x' || p_cantidad else '' end,
            'producto', v_prod.precio * p_cantidad, p_metodo_pago, 'ingreso', auth.uid(), p_clave)
    returning id into v_pago;
  exception when unique_violation then   -- dos envíos simultáneos con la misma clave
    select id into v_pago from pagos where clinica_id = v_clinica and clave_operacion = p_clave;
    return jsonb_build_object('resultado', 'ok', 'repetido', true, 'pago_id', v_pago,
      'puntos_otorgados', coalesce((select puntos from puntos_movimientos where origen_tipo = 'venta' and origen_id = v_pago), 0));
  end;

  if p_paciente_id is not null then
    v_puntos := v_prod.puntos_otorga * p_cantidad;
    v_otorgado := otorgar_puntos(v_clinica, p_paciente_id, v_puntos,
                                 'Compra: ' || v_prod.nombre || ' x' || p_cantidad, 'venta', v_pago);
  end if;
  return jsonb_build_object('resultado', 'ok', 'repetido', false, 'pago_id', v_pago,
                            'puntos_otorgados', case when v_otorgado then v_puntos else 0 end);
end $function$
;

CREATE OR REPLACE FUNCTION public.solicitar_canje(p_recompensa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pac uuid := paciente_actual();
  v_clinica uuid := clinica_actual();
  v_rec recompensas%rowtype;
  v_saldo bigint;
  v_canje uuid;
  v_codigo text;
  v_intentos integer := 0;
begin
  if v_pac is null then raise exception 'No autorizado'; end if;
  select * into v_rec from recompensas where id = p_recompensa_id and clinica_id = v_clinica and activa;
  if not found then return jsonb_build_object('resultado', 'no_disponible'); end if;

  perform 1 from pacientes where id = v_pac for update;
  select coalesce(sum(puntos), 0) into v_saldo from puntos_movimientos where paciente_id = v_pac;
  if v_saldo < v_rec.costo_puntos then return jsonb_build_object('resultado', 'puntos_insuficientes'); end if;

  loop
    v_codigo := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                 from generate_series(1, 5));
    begin
      insert into canjes (clinica_id, paciente_id, recompensa_id, recompensa_nombre, puntos, valor_descuento, codigo)
      values (v_clinica, v_pac, v_rec.id, v_rec.nombre, v_rec.costo_puntos, v_rec.valor_descuento, v_codigo)
      returning id into v_canje;
      exit;
    exception when unique_violation then
      v_intentos := v_intentos + 1;
      if v_intentos >= 10 then raise exception 'No se pudo generar el código del canje'; end if;
    end;
  end loop;

  insert into puntos_movimientos (clinica_id, paciente_id, tipo, puntos, motivo, canje_id)
  values (v_clinica, v_pac, 'canje', -v_rec.costo_puntos, 'Canje solicitado: ' || v_rec.nombre || ' (' || v_codigo || ')', v_canje);

  return jsonb_build_object('resultado', 'ok', 'canje_id', v_canje, 'codigo', v_codigo);
end $function$
;

CREATE OR REPLACE FUNCTION public.telefono_whatsapp(p_telefono text, p_pais text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with t as (
    select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') as dig,
           left(trim(coalesce(p_telefono, '')), 1) = '+' as con_mas,
           upper(coalesce(p_pais, '')) as pais)
  select case
    when dig = '' then null
    when con_mas then case when length(dig) between 8 and 15 then dig end
    when left(dig, 2) = '00' then case when length(substr(dig, 3)) between 8 and 15 then substr(dig, 3) end
    when pais = 'HN' and length(dig) = 8 and dig ~ '^[23789]' then '504' || dig
    when pais = 'HN' and length(dig) = 11 and left(dig, 3) = '504' then dig
    when pais = 'ES' and length(dig) = 9 and dig ~ '^[6789]' then '34' || dig
    when pais = 'ES' and length(dig) = 11 and left(dig, 2) = '34' then dig
    else null end
  from t
$function$
;

CREATE OR REPLACE FUNCTION public.tiene_clave_supervisor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(es_admin_clinica(), false)
     and exists (select 1 from claves_supervisor where clinica_id = clinica_actual())
$function$
;

CREATE OR REPLACE FUNCTION public.validar_contacto_clinica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pais text;
begin
  new.telefono_contacto := nullif(trim(new.telefono_contacto), '');
  new.whatsapp_contacto := nullif(trim(new.whatsapp_contacto), '');
  if new.whatsapp_contacto is not null then
    select c.pais into v_pais from clinicas c where c.id = new.clinica_id;
    if telefono_whatsapp(new.whatsapp_contacto, v_pais) is null then
      raise exception 'El WhatsApp debe incluir el código de país (por ejemplo +504 9999-0000) o ser un número local válido del país del negocio.'
        using errcode = 'check_violation';
    end if;
  end if;
  new.actualizado_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.validar_invitacion_admin(p_codigo text)
 RETURNS TABLE(clinica_id uuid, clinica_nombre text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nombre
  from invitaciones_admin i
  join clinicas c on c.id = i.clinica_id
  where i.codigo = p_codigo and i.usado = false
$function$
;

CREATE OR REPLACE FUNCTION public.validar_saldo_puntos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_saldo bigint;
begin
  if new.puntos < 0 then
    perform 1 from pacientes where id = new.paciente_id for update;
    select coalesce(sum(puntos), 0) into v_saldo from puntos_movimientos where paciente_id = new.paciente_id;
    if v_saldo + new.puntos < 0 then
      raise exception 'Saldo de puntos insuficiente';
    end if;
  end if;
  return new;
end $function$
;

-- ===== PERMISOS DE FUNCIONES =====
revoke all on function public.anular_pago(p_pago_id uuid, p_pin text, p_motivo text) from public, anon, authenticated;
grant execute on function public.anular_pago(p_pago_id uuid, p_pin text, p_motivo text) to authenticated;
revoke all on function public.aplicar_canje(p_canje_id uuid, p_monto_bruto numeric, p_descuento numeric, p_tipo text, p_metodo_pago text, p_concepto text) from public, anon, authenticated;
grant execute on function public.aplicar_canje(p_canje_id uuid, p_monto_bruto numeric, p_descuento numeric, p_tipo text, p_metodo_pago text, p_concepto text) to authenticated;
revoke all on function public.aplicar_promocion(p_clave uuid, p_promocion uuid, p_paciente uuid, p_monto_bruto numeric, p_tipo text, p_metodo_pago text, p_concepto text) from public, anon, authenticated;
grant execute on function public.aplicar_promocion(p_clave uuid, p_promocion uuid, p_paciente uuid, p_monto_bruto numeric, p_tipo text, p_metodo_pago text, p_concepto text) to authenticated;
revoke all on function public.cancelar_canje(p_canje_id uuid) from public, anon, authenticated;
grant execute on function public.cancelar_canje(p_canje_id uuid) to authenticated;
revoke all on function public.clinica_actual() from public, anon, authenticated;
grant execute on function public.clinica_actual() to anon;
grant execute on function public.clinica_actual() to authenticated;
revoke all on function public.clinica_publica_por_slug(p_slug text) from public, anon, authenticated;
grant execute on function public.clinica_publica_por_slug(p_slug text) to anon;
grant execute on function public.clinica_publica_por_slug(p_slug text) to authenticated;
revoke all on function public.completar_pedido(p_pedido_id uuid) from public, anon, authenticated;
grant execute on function public.completar_pedido(p_pedido_id uuid) to authenticated;
revoke all on function public.contacto_de_mi_clinica() from public, anon, authenticated;
grant execute on function public.contacto_de_mi_clinica() to authenticated;
revoke all on function public.crear_pedido(p_items jsonb, p_entrega text) from public, anon, authenticated;
grant execute on function public.crear_pedido(p_items jsonb, p_entrega text) to authenticated;
revoke all on function public.crear_perfil_y_paciente() from public, anon, authenticated;
revoke all on function public.crm_calcular(p_clinica uuid, p_paciente uuid) from public, anon, authenticated;
revoke all on function public.crm_cliente_360(p_paciente_id uuid) from public, anon, authenticated;
grant execute on function public.crm_cliente_360(p_paciente_id uuid) to authenticated;
revoke all on function public.crm_cliente_timeline(p_paciente_id uuid, p_limite integer) from public, anon, authenticated;
grant execute on function public.crm_cliente_timeline(p_paciente_id uuid, p_limite integer) to authenticated;
revoke all on function public.crm_clientes(p_clinica_id uuid) from public, anon, authenticated;
grant execute on function public.crm_clientes(p_clinica_id uuid) to authenticated;
revoke all on function public.crm_puede_ver(p_clinica uuid) from public, anon, authenticated;
grant execute on function public.crm_puede_ver(p_clinica uuid) to authenticated;
revoke all on function public.crm_resumen(p_clinica_id uuid) from public, anon, authenticated;
grant execute on function public.crm_resumen(p_clinica_id uuid) to authenticated;
revoke all on function public.definir_clave_supervisor(p_pin_nuevo text, p_pin_actual text) from public, anon, authenticated;
grant execute on function public.definir_clave_supervisor(p_pin_nuevo text, p_pin_actual text) to authenticated;
revoke all on function public.es_admin_clinica() from public, anon, authenticated;
grant execute on function public.es_admin_clinica() to anon;
grant execute on function public.es_admin_clinica() to authenticated;
revoke all on function public.es_super_admin_global() from public, anon, authenticated;
grant execute on function public.es_super_admin_global() to anon;
grant execute on function public.es_super_admin_global() to authenticated;
revoke all on function public.fijar_creada_at_cita() from public, anon, authenticated;
revoke all on function public.generar_codigo_referido(p_paciente_id uuid) from public, anon, authenticated;
grant execute on function public.generar_codigo_referido(p_paciente_id uuid) to anon;
grant execute on function public.generar_codigo_referido(p_paciente_id uuid) to authenticated;
revoke all on function public.generar_invitacion_admin(p_clinica_id uuid) from public, anon, authenticated;
grant execute on function public.generar_invitacion_admin(p_clinica_id uuid) to authenticated;
revoke all on function public.marcar_promocion(p_promocion uuid, p_accion text) from public, anon, authenticated;
grant execute on function public.marcar_promocion(p_promocion uuid, p_accion text) to authenticated;
revoke all on function public.mis_promociones() from public, anon, authenticated;
grant execute on function public.mis_promociones() to authenticated;
revoke all on function public.nivel_por_puntos(p_clinica uuid, p_puntos bigint) from public, anon, authenticated;
grant execute on function public.nivel_por_puntos(p_clinica uuid, p_puntos bigint) to authenticated;
revoke all on function public.otorgar_puntos(p_clinica uuid, p_paciente uuid, p_puntos integer, p_motivo text, p_origen_tipo text, p_origen_id uuid) from public, anon, authenticated;
revoke all on function public.paciente_actual() from public, anon, authenticated;
grant execute on function public.paciente_actual() to anon;
grant execute on function public.paciente_actual() to authenticated;
revoke all on function public.promo_aplica_segmento(p_segmento text, p_nuevo boolean, p_frecuente boolean, p_vip boolean, p_inactivo boolean, p_sin_proxima boolean, p_cumple boolean, p_membresia boolean) from public, anon, authenticated;
revoke all on function public.promocion_para_banner() from public, anon, authenticated;
grant execute on function public.promocion_para_banner() to authenticated;
revoke all on function public.promociones_aplicables(p_paciente uuid) from public, anon, authenticated;
grant execute on function public.promociones_aplicables(p_paciente uuid) to authenticated;
revoke all on function public.promociones_resumen() from public, anon, authenticated;
grant execute on function public.promociones_resumen() to authenticated;
revoke all on function public.promociones_vigentes_de(p_clinica uuid, p_paciente uuid) from public, anon, authenticated;
revoke all on function public.proteger_campos_clinica() from public, anon, authenticated;
revoke all on function public.puntos_por_cita_completada() from public, anon, authenticated;
revoke all on function public.reactivacion_base(p_clinica uuid) from public, anon, authenticated;
revoke all on function public.reactivacion_cooldown_dias() from public, anon, authenticated;
revoke all on function public.reactivacion_limite_diario() from public, anon, authenticated;
revoke all on function public.reactivacion_oportunidades() from public, anon, authenticated;
grant execute on function public.reactivacion_oportunidades() to authenticated;
revoke all on function public.reactivacion_resumen() from public, anon, authenticated;
grant execute on function public.reactivacion_resumen() to authenticated;
revoke all on function public.reactivacion_ventana_regreso_dias() from public, anon, authenticated;
revoke all on function public.rechazar_canje(p_canje_id uuid, p_nota text) from public, anon, authenticated;
grant execute on function public.rechazar_canje(p_canje_id uuid, p_nota text) to authenticated;
revoke all on function public.registrar_contacto_reactivacion(p_paciente uuid, p_promocion uuid, p_plantilla text) from public, anon, authenticated;
grant execute on function public.registrar_contacto_reactivacion(p_paciente uuid, p_promocion uuid, p_plantilla text) to authenticated;
revoke all on function public.registrar_venta_producto(p_clave uuid, p_producto_id uuid, p_cantidad integer, p_metodo_pago text, p_paciente_id uuid) from public, anon, authenticated;
grant execute on function public.registrar_venta_producto(p_clave uuid, p_producto_id uuid, p_cantidad integer, p_metodo_pago text, p_paciente_id uuid) to authenticated;
revoke all on function public.solicitar_canje(p_recompensa_id uuid) from public, anon, authenticated;
grant execute on function public.solicitar_canje(p_recompensa_id uuid) to authenticated;
revoke all on function public.telefono_whatsapp(p_telefono text, p_pais text) from public, anon, authenticated;
revoke all on function public.tiene_clave_supervisor() from public, anon, authenticated;
grant execute on function public.tiene_clave_supervisor() to authenticated;
revoke all on function public.validar_contacto_clinica() from public, anon, authenticated;
revoke all on function public.validar_invitacion_admin(p_codigo text) from public, anon, authenticated;
grant execute on function public.validar_invitacion_admin(p_codigo text) to anon;
grant execute on function public.validar_invitacion_admin(p_codigo text) to authenticated;
revoke all on function public.validar_saldo_puntos() from public, anon, authenticated;

-- ===== TRIGGERS =====
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION crear_perfil_y_paciente();
CREATE TRIGGER proteger_campos_clinica BEFORE UPDATE ON public.clinicas FOR EACH ROW EXECUTE FUNCTION proteger_campos_clinica();
CREATE TRIGGER puntos_saldo_no_negativo BEFORE INSERT ON public.puntos_movimientos FOR EACH ROW EXECUTE FUNCTION validar_saldo_puntos();
CREATE TRIGGER citas_creada_at BEFORE INSERT ON public.citas FOR EACH ROW EXECUTE FUNCTION fijar_creada_at_cita();
CREATE TRIGGER citas_puntos_al_completar AFTER UPDATE OF estado ON public.citas FOR EACH ROW WHEN (((new.estado = 'completada'::text) AND (old.estado IS DISTINCT FROM 'completada'::text))) EXECUTE FUNCTION puntos_por_cita_completada();
CREATE TRIGGER validar_contacto_clinica BEFORE INSERT OR UPDATE ON public.clinica_contacto FOR EACH ROW EXECUTE FUNCTION validar_contacto_clinica();

-- ===== RLS =====
alter table public.canjes enable row level security;
alter table public.citas enable row level security;
alter table public.claves_supervisor enable row level security;
alter table public.clinica_contacto enable row level security;
alter table public.clinicas enable row level security;
alter table public.crm_reactivaciones enable row level security;
alter table public.especialistas enable row level security;
alter table public.invitaciones_admin enable row level security;
alter table public.membresias enable row level security;
alter table public.paciente_membresias enable row level security;
alter table public.pacientes enable row level security;
alter table public.pagos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedidos enable row level security;
alter table public.perfiles enable row level security;
alter table public.productos enable row level security;
alter table public.promocion_clientes enable row level security;
alter table public.promociones enable row level security;
alter table public.puntos_movimientos enable row level security;
alter table public.recompensas enable row level security;
alter table public.referidos enable row level security;
alter table public.servicios enable row level security;
alter table public.temas_base enable row level security;
alter table public.tratamientos_paciente enable row level security;
alter table public.wallet_movimientos enable row level security;

-- ===== POLÍTICAS (public y storage) =====
create policy admin_ve_canjes on public.canjes as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_ve_sus_canjes on public.canjes as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_canjes on public.canjes as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_gestiona_citas on public.citas as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_solicita_cita on public.citas as PERMISSIVE for INSERT to authenticated
  with check (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual()) AND (estado = 'pendiente'::text) AND (fecha_hora > now()) AND ((especialista_id IS NULL) OR (EXISTS ( SELECT 1
   FROM especialistas e
  WHERE ((e.id = citas.especialista_id) AND (e.clinica_id = clinica_actual())))))));

create policy cliente_ve_sus_citas on public.citas as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_citas on public.citas as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy super_admin_gestiona_contacto on public.clinica_contacto as PERMISSIVE for ALL to authenticated
  using (es_super_admin_global())
  with check (es_super_admin_global());

create policy admin_edita_propia_clinica on public.clinicas as PERMISSIVE for UPDATE to public
  using (((id = clinica_actual()) AND es_admin_clinica()));

create policy lectura_publica_clinicas_cerrada on public.clinicas as PERMISSIVE for SELECT to authenticated
  using (false);

create policy miembros_ven_su_clinica on public.clinicas as PERMISSIVE for SELECT to authenticated
  using ((id = clinica_actual()));

create policy super_admin_actualiza_clinicas on public.clinicas as PERMISSIVE for UPDATE to public
  using (es_super_admin_global());

create policy super_admin_crea_clinicas on public.clinicas as PERMISSIVE for INSERT to public
  with check (es_super_admin_global());

create policy super_admin_elimina_clinicas on public.clinicas as PERMISSIVE for DELETE to public
  using (es_super_admin_global());

create policy super_admin_lee_clinicas on public.clinicas as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_ve_reactivaciones on public.crm_reactivaciones as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy super_admin_lee_reactivaciones on public.crm_reactivaciones as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_gestiona_especialistas on public.especialistas as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy catalogo_de_mi_clinica_especialistas on public.especialistas as PERMISSIVE for SELECT to authenticated
  using (((activo = true) AND (clinica_id = clinica_actual())));

create policy super_admin_lee_especialistas on public.especialistas as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy super_admin_gestiona_invitaciones on public.invitaciones_admin as PERMISSIVE for ALL to public
  using (es_super_admin_global());

create policy admin_gestiona_membresias on public.membresias as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy catalogo_de_mi_clinica_membresias on public.membresias as PERMISSIVE for SELECT to authenticated
  using (((activa = true) AND (clinica_id = clinica_actual())));

create policy super_admin_lee_membresias on public.membresias as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_gestiona_paciente_membresias on public.paciente_membresias as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_ve_sus_membresias on public.paciente_membresias as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_paciente_membresias on public.paciente_membresias as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_crea_pacientes on public.pacientes as PERMISSIVE for INSERT to authenticated
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy paciente_edita_lo_suyo on public.pacientes as PERMISSIVE for UPDATE to authenticated
  using (((clinica_id = clinica_actual()) AND ((perfil_id = ( SELECT auth.uid() AS uid)) OR es_admin_clinica())))
  with check (((clinica_id = clinica_actual()) AND ((perfil_id = ( SELECT auth.uid() AS uid)) OR es_admin_clinica())));

create policy paciente_ve_lo_suyo_admin_ve_todo on public.pacientes as PERMISSIVE for SELECT to public
  using (((clinica_id = clinica_actual()) AND ((perfil_id = ( SELECT auth.uid() AS uid)) OR es_admin_clinica())));

create policy super_admin_lee_pacientes on public.pacientes as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_registra_pagos on public.pagos as PERMISSIVE for INSERT to public
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy admin_ve_pagos_propios on public.pagos as PERMISSIVE for SELECT to public
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy super_admin_lee_pagos on public.pagos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy super_admin_lee_pedido_items on public.pedido_items as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy ver_items_de_pedidos_visibles on public.pedido_items as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM pedidos p
  WHERE (p.id = pedido_items.pedido_id))));

create policy cliente_ve_sus_pedidos on public.pedidos as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND ((paciente_id = paciente_actual()) OR es_admin_clinica())));

create policy super_admin_lee_pedidos on public.pedidos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy super_admin_lee_perfiles on public.perfiles as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy usuario_edita_su_perfil on public.perfiles as PERMISSIVE for UPDATE to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));

create policy usuario_ve_su_perfil on public.perfiles as PERMISSIVE for SELECT to public
  using ((id = ( SELECT auth.uid() AS uid)));

create policy admin_gestiona_productos on public.productos as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy catalogo_de_mi_clinica_productos on public.productos as PERMISSIVE for SELECT to authenticated
  using (((activo = true) AND (clinica_id = clinica_actual())));

create policy super_admin_lee_productos on public.productos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_ve_promocion_clientes on public.promocion_clientes as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy super_admin_lee_promocion_clientes on public.promocion_clientes as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_gestiona_promociones on public.promociones as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy super_admin_lee_promociones on public.promociones as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_registra_puntos on public.puntos_movimientos as PERMISSIVE for INSERT to authenticated
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy admin_ve_puntos on public.puntos_movimientos as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_ve_sus_puntos on public.puntos_movimientos as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_puntos on public.puntos_movimientos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_gestiona_recompensas on public.recompensas as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy miembros_ven_recompensas on public.recompensas as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (activa OR es_admin_clinica())));

create policy super_admin_lee_recompensas on public.recompensas as PERMISSIVE for SELECT to authenticated
  using (es_super_admin_global());

create policy admin_gestiona_referidos on public.referidos as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_invita on public.referidos as PERMISSIVE for INSERT to authenticated
  with check (((clinica_id = clinica_actual()) AND (paciente_referidor_id = paciente_actual()) AND (estado = 'invitado'::text) AND (paciente_referido_id IS NULL)));

create policy cliente_ve_sus_referidos on public.referidos as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_referidor_id = paciente_actual())));

create policy super_admin_lee_referidos on public.referidos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_gestiona_servicios on public.servicios as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy catalogo_de_mi_clinica_servicios on public.servicios as PERMISSIVE for SELECT to authenticated
  using (((activo = true) AND (clinica_id = clinica_actual())));

create policy super_admin_lee_servicios on public.servicios as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy lectura_publica_temas on public.temas_base as PERMISSIVE for SELECT to public
  using (true);

create policy admin_gestiona_tratamientos on public.tratamientos_paciente as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_agrega_su_progreso on public.tratamientos_paciente as PERMISSIVE for INSERT to authenticated
  with check (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy cliente_ve_sus_tratamientos on public.tratamientos_paciente as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_tratamientos on public.tratamientos_paciente as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy admin_gestiona_wallet on public.wallet_movimientos as PERMISSIVE for ALL to authenticated
  using (((clinica_id = clinica_actual()) AND es_admin_clinica()))
  with check (((clinica_id = clinica_actual()) AND es_admin_clinica()));

create policy cliente_ve_su_wallet on public.wallet_movimientos as PERMISSIVE for SELECT to authenticated
  using (((clinica_id = clinica_actual()) AND (paciente_id = paciente_actual())));

create policy super_admin_lee_wallet on public.wallet_movimientos as PERMISSIVE for SELECT to public
  using (es_super_admin_global());

create policy fotos_paciente_sube_las_suyas on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'fotos-tratamientos'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND (((storage.foldername(name))[2] = (paciente_actual())::text) OR es_admin_clinica())));

create policy fotos_paciente_ve_las_suyas on storage.objects as PERMISSIVE for SELECT to public
  using (((bucket_id = 'fotos-tratamientos'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND (((storage.foldername(name))[2] = (paciente_actual())::text) OR es_admin_clinica())));

create policy fotos_productos_admin_reemplaza on storage.objects as PERMISSIVE for UPDATE to public
  using (((bucket_id = 'fotos-productos'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND es_admin_clinica()));

create policy fotos_productos_admin_sube on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'fotos-productos'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND es_admin_clinica()));

create policy fotos_productos_lectura_publica on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'fotos-productos'::text));

create policy logos_admin_reemplaza_el_suyo on storage.objects as PERMISSIVE for UPDATE to public
  using (((bucket_id = 'logos-clinicas'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND es_admin_clinica()));

create policy logos_admin_sube_el_suyo on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'logos-clinicas'::text) AND ((storage.foldername(name))[1] = (clinica_actual())::text) AND es_admin_clinica()));

create policy logos_lectura_publica on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'logos-clinicas'::text));

-- ===== BUCKETS DE STORAGE =====
insert into storage.buckets (id, name, public) values ('fotos-productos', 'fotos-productos', t) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('fotos-tratamientos', 'fotos-tratamientos', f) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('logos-clinicas', 'logos-clinicas', t) on conflict (id) do nothing;
-- MELISSA_SCHEMA_DUMP_END
