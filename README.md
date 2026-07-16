# LEGACY Caraballo Enterprises

Aplicación desktop de Electron para la gestión interna de LEGACY Caraballo Enterprises.

## Desarrollo

```bash
npm install
npm run dev
npm run server
npm run electron:dev
```

## Publicación y despliegue

La app está preparada para publicar builds Windows en GitHub Releases y que la instalación local detecte actualizaciones mediante electron-updater.

### 1. Preparar una nueva versión

```bash
npm run release:patch:publish
# o
npm run release:minor:publish
# o
npm run release:major:publish
```

Estos comandos:
- crean la nueva versión con standard-version,
- generan el changelog,
- crean un tag de GitHub,
- suben el tag al remoto.

### 2. GitHub Actions publica el instalador

Al empujarse el tag, el workflow en [.github/workflows/release.yml](.github/workflows/release.yml) construye la app y la publica como release en GitHub.

### 3. Actualización en las PCs instaladas

La app instalada consultará el release publicado y, si detecta una versión superior, descargará la actualización automáticamente.
