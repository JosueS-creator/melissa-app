# Fotos de muestra de servicios y productos

Aquí van las fotos de muestra. **Solo con licencia libre** (Pexels, Unsplash gratuita o Pixabay) y con el crédito anotado en `docs/CREDITOS_FOTOS.md`.
No subir fotos de iStock, Shutterstock o PNGTree sin licencia comprada, ni con marca de agua: este repositorio es público.

Medidas recomendadas (JPG o WebP, hasta ~150 KB cada una; la foto de un servicio se usa en su tarjeta y en la de próxima visita):
- **Servicio**: horizontal 4:3, mínimo 1200 × 900, con el sujeto hacia el centro-derecha.
- **Producto**: horizontal 3:2, mínimo 900 × 600, producto centrado con margen.
- Sin agujas, inyecciones ni tratamientos que el negocio no ofrezca; sin logos, textos ni marcas de agua.

Para mostrarlas en el app, guarda la ruta en la fila correspondiente (ejemplo):
```sql
update servicios set imagen_url = '/muestras/limpieza-facial.jpg' where nombre = 'Limpieza facial profunda' and clinica_id = '<id de la clínica>';
update productos set imagen_url = '/muestras/crema-hidratante.jpg' where nombre = 'Crema hidratante facial' and clinica_id = '<id de la clínica>';
```
Si una foto no existe o no carga, el app muestra un mosaico con la inicial en lugar de una imagen rota.
