# Rollback

Todos los comandos usan `-f compose.prod.yml` en `/opt/canumpe/apps/viaje`. Requisito: haber hecho los respaldos del paso 2 de [DEPLOYMENT.md](DEPLOYMENT.md) (`compose.prod.yml.bak-<STAMP>`, `.env.bak-<STAMP>`, `previous-image-<STAMP>.txt`).

## A. Volver a una versión anterior de esta app (imagen en GHCR)

Las etiquetas `vX.Y.Z` y `sha-<commit>` no se borran; el digest anterior está en el resumen del job **Release** previo o en `.env.bak-<STAMP>`.

```bash
cd /opt/canumpe/apps/viaje
export ORLANDO_IMAGE=ghcr.io/ulisesvar/orlando-pwa@sha256:<digest-anterior>
echo "ORLANDO_IMAGE=$ORLANDO_IMAGE" > .env
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

## B. Volver al contenedor provisional original

1. Consulte lo registrado antes del despliegue: `cat previous-image-<STAMP>.txt` (imagen y/o image ID del contenedor provisional) y `compose.prod.resolved-<STAMP>.yml`.
2. Restaure el Compose y el `.env` respaldados y levante el servicio:

```bash
cd /opt/canumpe/apps/viaje
cp -p compose.prod.yml compose.prod.yml.failed-$(date +%F-%H%M)    # conserva el intento fallido
cp -p compose.prod.yml.bak-<STAMP> compose.prod.yml
if [ -f .env.bak-<STAMP> ]; then cp -p .env.bak-<STAMP> .env; else rm -f .env; fi
docker compose -f compose.prod.yml config >/dev/null && echo "compose válido"
docker compose -f compose.prod.yml up -d --force-recreate
```

3. Si el Compose restaurado referencia una etiqueta que ya no existe localmente, use el image ID registrado: `docker image ls --digests | grep <id>`; si la imagen sigue presente, `docker tag <image-id> <nombre:etiqueta-original>` y repita `up -d`.

## Verificación posterior (A o B)

```bash
docker compose -f compose.prod.yml ps                                     # healthy / running
docker inspect viaje-web-1 --format '{{.Config.Image}} {{json .HostConfig.PortBindings}}'
curl -sI http://127.0.0.1:3101/ | head -3
curl -sI https://viaje.canumpe.com/ | head -3
```

- Compare `Config.Image` con el digest/ID esperado (A: el digest anterior; B: el de `previous-image-<STAMP>.txt`).
- En B el puerto interno vuelve al que tenía el contenedor provisional (según el Compose restaurado); el puerto del host sigue siendo `127.0.0.1:3101`.
- Los navegadores con la versión nueva instalada obtienen el Service Worker de la imagen restaurada (distinto `BUILD_ID`), reemplazan la caché y recargan una vez. El checklist no se pierde (vive en `localStorage`).

## Si la imagen nueva no arranca

`docker compose -f compose.prod.yml logs --tail=50 web`, luego A o B. La app no guarda estado en el servidor: no hay datos que restaurar.
