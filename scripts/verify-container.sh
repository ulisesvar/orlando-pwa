#!/usr/bin/env bash
# Construye la imagen, la levanta con infra/compose.yaml (mismas restricciones que producción)
# y verifica configuración, healthcheck, aislamiento a localhost y pruebas de seguridad/E2E contra Nginx real.
# Uso: bash scripts/verify-container.sh [imagen-ya-construida]
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${1:-orlando-pwa:verify}"
export ORLANDO_IMAGE="$IMAGE"
PROJECT=orlando-verify
COMPOSE=(docker compose -p "$PROJECT" -f infra/compose.yaml)
fail() { echo "FALLO: $*" >&2; exit 1; }
cleanup() { "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ $# -eq 0 ]; then docker build -q -t "$IMAGE" --build-arg VERSION=verify . >/dev/null; fi
"${COMPOSE[@]}" up -d
CID=$("${COMPOSE[@]}" ps -q web)

for _ in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' "$CID"); [ "$s" = healthy ] && break; sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$CID")" = healthy ] || fail "healthcheck no llegó a healthy"
echo "ok healthcheck: healthy"

insp() { docker inspect -f "$1" "$CID"; }
[ "$(insp '{{.Config.User}}')" = "101:101" ] || fail "usuario no es 101:101"
[ "$(insp '{{.HostConfig.ReadonlyRootfs}}')" = true ] || fail "rootfs no es de solo lectura"
[ "$(insp '{{.HostConfig.Privileged}}')" = false ] || fail "contenedor privilegiado"
[ "$(insp '{{json .HostConfig.CapDrop}}')" = '["ALL"]' ] || fail "cap_drop distinto de ALL"
[ "$(insp '{{json .HostConfig.CapAdd}}')" = 'null' ] || fail "cap_add presente"
insp '{{json .HostConfig.SecurityOpt}}' | grep -q 'no-new-privileges' || fail "falta no-new-privileges"
[ "$(insp '{{len .Mounts}}')" = 0 ] || fail "el contenedor tiene volúmenes/mounts: $(insp '{{json .Mounts}}')"
[ "$(insp '{{json .HostConfig.PortBindings}}')" = '{"8080/tcp":[{"HostIp":"127.0.0.1","HostPort":"3101"}]}' ] || fail "puertos publicados inesperados"
[ "$(insp '{{.HostConfig.LogConfig.Config}}')" = "map[max-file:3 max-size:10m]" ] || fail "rotación de logs no configurada"
echo "ok configuración Docker (usuario, ro, caps, privilegios, mounts, puertos, logs)"

# No debe escribirse en el rootfs; /tmp sí (tmpfs)
docker exec "$CID" sh -c 'touch /usr/share/nginx/html/x' 2>/dev/null && fail "se pudo escribir en el código" || echo "ok rootfs/código no escribible"
docker exec "$CID" sh -c 'touch /tmp/x && rm /tmp/x' || fail "/tmp no escribible"

# Acceso restringido a localhost: la IP LAN del host no debe responder en 3101
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
if [ -n "${LAN_IP:-}" ] && [ "$LAN_IP" != 127.0.0.1 ]; then
  if curl -s -m 3 -o /dev/null "http://$LAN_IP:3101/"; then fail "3101 accesible desde $LAN_IP"; else echo "ok 3101 no accesible desde $LAN_IP"; fi
else echo "aviso: sin IP no-loopback para probar el aislamiento"; fi

export BASE_URL=http://127.0.0.1:3101
npx playwright test --project=mobile --project=desktop tests/security tests/e2e
echo "VERIFICACIÓN DE CONTENEDOR COMPLETA"
