# s42agent.dev

Landing page bilingüe de S42 Agent. HTML, CSS y JavaScript estáticos, servidos por Bun
1.4.2, sin dependencias externas ni paso de build. El código de la web está en
`website/`.

## Ejecutar

Desde la raíz del repositorio:

```bash
cd website
cp .env.example .env
bun run start
```

Bun carga el `.env` del directorio actual automáticamente. Editá
`WEBSERVER_PORT=4317` para elegir el puerto; también se puede sobrescribir desde
el entorno. Para desarrollo, `bun run dev` reinicia el servidor al editar sus
fuentes. Los archivos públicos se leen directamente en cada solicitud.
No se necesita `bun install` para servir la web.

El servidor escucha en `0.0.0.0`. Solo sirve archivos de `public/`: HTML, estilos,
scripts, imágenes, favicon, robots y sitemap. `.env`, fuentes y archivos del
repositorio no son públicos. Rutas inexistentes responden 404; acepta GET y HEAD.

## Contenido y SEO

- `public/index.html`: versión en inglés, idioma predeterminado en `/`.
- `public/es/index.html`: versión en español en `/es/`; `/es` redirige a `/es/`.
  Ambas versiones contienen todos los textos, alt, instalación, autor y enlaces
  en el HTML original. No requieren JavaScript para traducir ni cambian de idioma
  según el navegador. El selector EN/ES conserva la sección y los query params.
- Cada idioma tiene canonical, `lang`, hreflang recíprocos, `x-default`, Open
  Graph, Twitter Cards y datos estructurados localizados.
- `public/styles.css`: diseño oscuro y responsive con portada metálica, luz y
  órbitas animadas, entradas escalonadas y estados hover. Desactiva animaciones,
  transiciones y desplazamiento suave con `prefers-reduced-motion`.
- `public/app.js`: copia de comandos y mensajes ES/EN, selector de idioma,
  apariciones con IntersectionObserver, profundidad al mover el mouse y progreso
  de lectura. El contenido se mantiene visible si no hay JavaScript o se solicita
  movimiento reducido; la preferencia se puede cambiar durante la sesión.
- `public/assets/opengraph.jpg` y `opengraph-es.jpg`: portadas ilustradas generadas
  para compartir en inglés/español, 1200×630. `hero-42.webp` es arte decorativo de
  la cabecera, sin textos incrustados. No se presentan como capturas del producto.
- `public/robots.txt`, `public/sitemap.xml`: descubrimiento de la página.
- JSON-LD: WebSite, SoftwareApplication/SoftwareSourceCode y Person, sin
  valoraciones inventadas. Sitemap incluye ambas URLs y sus alternates.

HTML, CSS y JavaScript se sirven con `no-cache` para que el navegador revalide
los cambios. Las imágenes y otros archivos públicos conservan una hora de caché.

Las cuatro capturas en `public/assets/screenshots/` son copias byte por byte de
`screenshots/` en la raíz. La procedencia está documentada en
[`screenshots/README.es.md`](../screenshots/README.es.md) y su manifiesto.
No se modificaron, recortaron ni generaron pantallas del agente.
Los comandos de instalación corresponden a los instaladores del repositorio;
no se ofrece un paquete npm. La preview actual es v0.1.1.

## Validación

```bash
bun run test
```

Desde la raíz, `bun run typecheck` incluye el servidor y sus pruebas.
La verificación visual local y los informes de QA se guardan en `private/`.

## Dominio

Para publicar, apuntá el DNS de `s42agent.dev` al host elegido y configurá HTTPS
con un reverse proxy hacia `WEBSERVER_PORT`. La creación de esta carpeta no
configura DNS, TLS ni despliega la web. Los crawlers y las tarjetas sociales
necesitan que el dominio y sus imágenes sean accesibles públicamente por HTTPS.
