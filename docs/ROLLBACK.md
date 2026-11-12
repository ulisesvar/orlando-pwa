# Rollback

La imagen anterior sigue en GHCR (las etiquetas `vX.Y.Z` y `sha-<commit>` no se borran) y se identifica por su digest.

1. Obtenga el digest anterior: archivo `.env` previo o bitácora, o el resumen del job **Release** de la versión anterior (Actions → Release).
2. En Canumpe:

```bash
cd /opt/canumpe/apps/viaje
export ORLANDO_IMAGE=ghcr.io/ulisesvar/orlando-pwa@sha256:<digest-anterior>
echo "ORLANDO_IMAGE=$ORLANDO_IMAGE" > .env
docker compose pull
docker compose up -d
docker compose ps        # healthy
```

3. Los navegadores con la versión nueva instalada descargarán el Service Worker de la imagen restaurada (su `BUILD_ID` difiere), reemplazarán la caché y recargarán una vez. El checklist no se pierde.

## Volver al contenedor de prueba original

Restaure el compose respaldado y levántelo:

```bash
cd /opt/canumpe/apps/viaje
cp compose.yaml.bak-<fecha> compose.yaml
docker compose up -d
```

## Si la imagen nueva no arranca

`docker compose logs --tail=50 web` y siga los pasos anteriores con el digest anterior. No se modifican datos persistentes: la app no tiene estado en el servidor.
