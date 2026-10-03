# s42agent.dev

Landing page de S42 Agent. HTML, CSS y JavaScript estáticos, servidos por Bun
1.4.2, sin dependencias externas ni paso de build. Se conserva `wensite` como
nombre de directorio solicitado.

## Ejecutar

Desde la raíz del repositorio:

```bash
cd wensite
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

- `public/index.html`: contenido accesible sin JavaScript, instrucciones de
  instalación, autor y enlaces. Canonical, Open Graph y Twitter Cards usan
  `https://s42agent.dev/`.
- `public/styles.css`: diseño oscuro y responsive, foco visible y movimiento
  reducido.
- `public/app.js`: copia de comandos, con selección manual cuando el navegador
  no permite acceder al portapapeles.
- `public/assets/opengraph.jpg`: portada ilustrada generada para compartir,
  1200×630. No se presenta como captura del producto.
- `public/robots.txt`, `public/sitemap.xml`: descubrimiento de la página.
- JSON-LD: WebSite, SoftwareApplication y Person, sin valoraciones inventadas.

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
