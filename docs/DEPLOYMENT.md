# Despliegue en Canumpe (manual)

GitHub Actions **no** accede a Canumpe. El despliegue lo hace una persona con acceso SSH, usando una imagen fijada por **digest**.

## 1. Obtener la referencia

Tras ejecutar el workflow **Release**, copie del resumen del job la línea
`ghcr.io/ulisesvar/orlando-pwa@sha256:<digest>`. No use `latest`.

## 2. Preparar el directorio (primera vez)

```bash
cd /opt/canumpe/apps/viaje
cp compose.yaml compose.yaml.bak-$(date +%F)     # respaldo del compose actual (ajuste el nombre si el archivo se llama distinto)
```

Copie `infra/compose.yaml` de este repositorio a `/opt/canumpe/apps/viaje/compose.yaml`. Cambios respecto al contenedor de prueba: puerto interno **8080** (`127.0.0.1:3101:8080`), usuario 101, rootfs de solo lectura, `cap_drop: ALL`, `no-new-privileges`, tmpfs en `/tmp`, rotación de logs.
El nombre de servicio `web` en el directorio `viaje` conserva el nombre de contenedor `viaje-web-1`. **No** se toca Nginx del host, Cloudflare Tunnel ni DNS: el proxy actual ya apunta a `127.0.0.1:3101`; verifique que su `proxy_pass` use `http://127.0.0.1:3101` (el puerto del host no cambia).

## 3. Desplegar

```bash
cd /opt/canumpe/apps/viaje
export ORLANDO_IMAGE=ghcr.io/ulisesvar/orlando-pwa@sha256:<digest>
echo "ORLANDO_IMAGE=$ORLANDO_IMAGE" > .env            # queda registrada la versión desplegada
docker compose pull
docker compose up -d
```

Si el paquete GHCR es privado: `docker login ghcr.io` con un PAT de solo `read:packages` (no se guarda en el repositorio). Si es público, no hace falta.

## 4. Verificar

```bash
docker compose ps                                         # STATUS: healthy
curl -sI http://127.0.0.1:3101/ | grep -iE "^(HTTP|content-security|x-content|referrer|permissions|cache)"
curl -s http://127.0.0.1:3101/healthz                      # ok
curl -sI https://viaje.canumpe.com/ | head -5
docker inspect viaje-web-1 --format '{{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} {{json .HostConfig.PortBindings}}'
```

Abra la URL pública en un móvil y confirme el itinerario. Los dispositivos que ya instalaron la app se actualizan solos en la siguiente apertura.

## Notas

- HSTS lo emite Cloudflare; la imagen no lo añade.
- Registre en `.env` (o en su bitácora) el digest anterior: lo necesita [ROLLBACK.md](ROLLBACK.md).
