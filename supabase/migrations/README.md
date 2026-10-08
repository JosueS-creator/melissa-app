# Migraciones de Melissa

**La fuente de verdad del historial es la tabla `supabase_migrations.schema_migrations` de la base**, no los nombres de estos archivos.

Estos archivos se aplican con el editor SQL / herramienta de Supabase, que registra cada migración con su **fecha y hora reales de aplicación**
(p. ej. `20261007204617`). Los nombres de archivo de este repositorio (`20261008000001_…`, `20261012000001_…`) son **etiquetas de orden**:
una por entrega, en secuencia; por eso algunas llevan una fecha posterior a la real. Los archivos son una copia de lo que se aplicó
(se verifica con una huella del contenido, no con el nombre).

| Archivo (etiqueta) | Nombre registrado en la base | Versión real en la base |
|---|---|---|
| 20261007000001_fase_a_seguridad_rls | fase_a_seguridad_rls_y_fuente_de_verdad | 20261007040741 |
| 20261007000002_fase_a_clinicas_visibles_bloqueo_funcional | fase_a_clinicas_visibles_bloqueo_funcional | 20261007040856 |
| 20261007000003_fase_a_cerrar_funciones_de_trigger | fase_a_cerrar_funciones_de_trigger | 20261007040928 |
| 20261008000001_fase_b_crm | fase_b_crm | 20261007043502 |
| 20261008000002_fase_b_recuperados_excluye_retroactivos | fase_b_recuperados_excluye_retroactivos | 20261007043832 |
| 20261009000001_canjes_con_aprobacion | canjes_con_aprobacion | 20261007164902 |
| 20261010000001_puntos_automaticos | puntos_automaticos | 20261007190948 |
| 20261011000001_promociones | promociones | 20261007192949 |
| 20261011000002_promociones_un_aviso_por_ventana | promociones_un_aviso_por_ventana | 20261007193037 |
| 20261012000001_reactivacion_whatsapp | reactivacion_whatsapp | 20261007204617 |
| 20261012000002_fijar_search_path_ayudantes | fijar_search_path_ayudantes | 20261008023847 |
| 20261012000003_reactivacion_regreso_por_fecha_de_visita | reactivacion_regreso_por_fecha_de_visita | 20261008025109 |

**No renombres archivos ya aplicados** (al subir por la web de GitHub quedarían duplicados con el nombre viejo) ni los edites: toda corrección va en una migración nueva.

**Si algún día se usa el CLI de Supabase** (`supabase db push` / `migration list`): comparará versiones por nombre de archivo y verá todas estas como no
aplicadas. Antes de usarlo hay que reconciliar con `supabase migration repair` (marcando cada archivo con su versión real de la tabla de arriba).
Mientras se siga aplicando desde el editor SQL, esto no genera ningún problema.
