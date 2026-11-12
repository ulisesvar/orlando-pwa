# Despliegue en Canumpe (manual)

GitHub Actions **no** accede a Canumpe. El despliegue lo hace una persona con acceso SSH, con una imagen fijada por **digest**. Directorio de producción: `/opt/canumpe/apps/viaje`; archivo Compose existente: **`compose.prod.yml`**. Todos los comandos usan `-f compose.prod.yml` de forma explícita.

Puertos (sin cambios): host `127.0.0.1:3101` → contenedor `8080`. No se modifica el Nginx del host ni Cloudflare Tunnel.

## 0. Antes de publicar la release (verificación obligatoria)

`environment: production` en `.github/workflows/release.yml` solo exige aprobación manual si el environment tiene **Required reviewers**. Esto es una configuración de GitHub que el repositorio no puede imponer. Verifique en _Settings → Environments → production_ que:

- «Required reviewers» incluye a al menos una persona autorizada, y
- (recomendado) «Deployment branches» está limitado a `main`.

Si el environment no existe o no tiene revisores, el job publicaría sin aprobación: **no ejecute Release hasta configurarlo**.

## 1. Obtener la referencia nueva

Tras ejecutar **Release**, copie del resumen del job `ghcr.io/ulisesvar/orlando-pwa@sha256:<digest-nuevo>`. No use `latest`.

## 2. Respaldo previo (en Canumpe, antes de cambiar nada)

```bash
cd /opt/canumpe/apps/viaje
STAMP=$(date +%F-%H%M)
cp -p compose.prod.yml compose.prod.yml.bak-$STAMP          # respaldo del Compose actual
[ -f .env ] && cp -p .env .env.bak-$STAMP                    # respaldo de .env, si existe

# Registrar la imagen/digest que corre HOY (contenedor provisional viaje-web-1)
docker inspect viaje-web-1 --format 'image={{.Config.Image}} id={{.Image}}' | tee previous-image-$STAMP.txt
docker inspect viaje-web-1 --format '{{json .HostConfig.PortBindings}} {{.Config.User}}' | tee -a previous-image-$STAMP.txt
docker image inspect "$(docker inspect viaje-web-1 --format '{{.Image}}')" --format '{{json .RepoDigests}}' | tee -a previous-image-$STAMP.txt
docker compose -f compose.prod.yml config > compose.prod.resolved-$STAMP.yml   # configuración efectiva actual
```

Conserve estos archivos: son la entrada de [ROLLBACK.md](ROLLBACK.md). Si la imagen provisional solo tiene etiqueta (sin digest en `RepoDigests`), el **image ID** `sha256:…` registrado sigue permitiendo restaurarla mientras la imagen exista localmente; no ejecute `docker image prune` hasta cerrar el despliegue.

## 3. Preparar el Compose nuevo

Revise las diferencias entre el Compose actual y el del repositorio (`infra/compose.yaml`) y adáptelas a `compose.prod.yml`:

```bash
# Desde su equipo, con el repositorio en la rama/commit aprobado:
scp infra/compose.yaml canumpe:/opt/canumpe/apps/viaje/compose.prod.yml.new
# En Canumpe:
cd /opt/canumpe/apps/viaje
diff -u compose.prod.yml compose.prod.yml.new
```

Puntos que deben quedar: puerto `127.0.0.1:3101:8080` (el interno cambia a **8080** porque Nginx corre sin privilegios), `user: "101:101"`, `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges:true`, tmpfs en `/tmp`, rotación de logs, servicio `web` (conserva el nombre `viaje-web-1`) y `image: ${ORLANDO_IMAGE:?…}`. Conserve cualquier ajuste propio de Canumpe (redes, etiquetas) que el diff muestre. Cuando esté conforme:

```bash
mv compose.prod.yml.new compose.prod.yml
```

## 4. Desplegar

```bash
cd /opt/canumpe/apps/viaje
export ORLANDO_IMAGE=ghcr.io/ulisesvar/orlando-pwa@sha256:<digest-nuevo>
echo "ORLANDO_IMAGE=$ORLANDO_IMAGE" > .env
docker compose -f compose.prod.yml config >/dev/null && echo "compose válido"
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

Si el paquete GHCR es privado: `docker login ghcr.io` con un PAT de solo `read:packages` (no se guarda en el repositorio).

## 5. Verificar

```bash
docker compose -f compose.prod.yml ps                      # healthy
curl -s http://127.0.0.1:3101/healthz                       # ok
curl -sI http://127.0.0.1:3101/ | grep -iE "^(HTTP|content-security|x-content|referrer|permissions|cache)"
curl -sI https://viaje.canumpe.com/ | head -5
docker inspect viaje-web-1 --format '{{.Config.Image}} user={{.Config.User}} ro={{.HostConfig.ReadonlyRootfs}} {{json .HostConfig.PortBindings}}'
```

Debe mostrar el digest nuevo, `user=101:101`, `ro=true` y `{"8080/tcp":[{"HostIp":"127.0.0.1","HostPort":"3101"}]}`. Abra la URL pública en un móvil. Si algo falla, siga [ROLLBACK.md](ROLLBACK.md).

## Notas

- HSTS lo emite Cloudflare; la imagen no lo añade.
- Mantenga `.env`, los respaldos y `previous-image-*.txt` hasta confirmar la estabilidad de la versión nueva.
