import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(p, 'utf8');
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const SKIP = ['node_modules', 'dist', '.git', 'playwright-report', 'test-results', 'package-lock.json'];
const allFiles = () => walk('.').filter((f) => !SKIP.some((s) => f.split('/').includes(s)) && !/\.(png|ico)$/.test(f));
const srcJs = () => walk('src').filter((f) => f.endsWith('.js'));

describe('código del frontend (ASVS V1.3.2, V3.2.2)', () => {
  it('sin eval, new Function ni ejecución dinámica', () => {
    for (const f of srcJs())
      expect(read(f), f).not.toMatch(/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]|document\.write/);
  });
  it('sin innerHTML/outerHTML/insertAdjacentHTML', () => {
    for (const f of srcJs()) expect(read(f), f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment/);
  });
  it('HTML sin scripts ni estilos inline ni manejadores on*', () => {
    const html = read('src/index.html');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=/i);
  });
  it('sin recursos remotos (CDN, fuentes, analítica) en src', () => {
    for (const f of walk('src').filter((f) => /\.(js|css|html|webmanifest)$/.test(f))) {
      const urls = read(f).match(/https?:\/\/[^\s'"`)]+/g) ?? [];
      for (const u of urls)
        expect(
          [
            'https://waze.com/ul',
            'https://www.google.com/maps/dir/',
            'http://www.w3.org/2000/svg',
            // Enlace de atribución (navegación), no un recurso cargado: crédito de la foto de portada.
            'https://commons.wikimedia.org/wiki/File:Magic_Kingdom_-_Cinderella_Castle_panorama_-_by_mrkathika.jpg',
          ].some((ok) => u.startsWith(ok)),
          `${f}: ${u}`,
        ).toBe(true);
    }
  });
  it('sin cookies ni credenciales en localStorage', () => {
    for (const f of srcJs()) {
      expect(read(f)).not.toMatch(/document\.cookie|password|token|apikey/i);
    }
  });
  it('el Service Worker no cachea otros orígenes ni cross-origin', () => {
    const sw = read('src/sw.js');
    expect(sw).toMatch(/url\.origin !== SCOPE\.origin/);
    expect(sw).toMatch(/req\.method !== 'GET'/);
  });
  it('el Service Worker no se activa solo: skipWaiting únicamente tras el mensaje de confirmación', () => {
    const sw = read('src/sw.js');
    const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
    expect(install).not.toMatch(/skipWaiting\(/);
    const calls = sw.match(/skipWaiting\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(sw).toMatch(/event\.data\.type === 'SKIP_WAITING'\) self\.skipWaiting\(\)/);
  });
});

describe('privacidad (datos del viaje)', () => {
  it('trip.json no contiene códigos de reserva, teléfonos ni correos', () => {
    const t = read('src/data/trip.json');
    expect(t).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(t).not.toMatch(/\+\d[\d\s().-]{8,}\d|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
    expect(t).not.toMatch(/PNR|confirmaci[oó]n|reservaci[oó]n|pasaporte n|habitaci[oó]n \d/i);
  });
});

describe('secretos en el repositorio (ASVS V13.3 / buenas prácticas)', () => {
  const patterns = [
    /ghp_[A-Za-z0-9]{30,}/,
    /gho_[A-Za-z0-9]{30,}/,
    /github_pat_[A-Za-z0-9_]{30,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{10,}/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  ];
  it('ningún archivo contiene tokens o llaves privadas', () => {
    for (const f of allFiles()) {
      const c = read(f);
      for (const p of patterns) expect(c, `${f} ${p}`).not.toMatch(p);
    }
  });
  it('no hay archivos .env ni llaves versionables', () => {
    expect(allFiles().filter((f) => /(^|\/)\.env|\.pem$|\.key$/.test(f))).toEqual([]);
  });
});

describe('Dockerfile y Compose (hardening)', () => {
  const df = read('Dockerfile'),
    cp = read('infra/compose.yaml'),
    ng = read('infra/nginx.conf');
  it('imágenes base fijadas por digest', () => {
    for (const l of df.split('\n').filter((l) => /^FROM /.test(l))) expect(l).toMatch(/@sha256:[0-9a-f]{64}/);
  });
  it('base Nginx sin privilegios, usuario no root, puerto 8080', () => {
    expect(df).toMatch(/nginx-unprivileged/);
    expect(df).toMatch(/^USER 101$/m);
    expect(df).toMatch(/EXPOSE 8080/);
    expect(df).toMatch(/HEALTHCHECK/);
    expect(
      df
        .trim()
        .split('\n')
        .filter((l) => /^USER /.test(l))
        .pop(),
    ).toBe('USER 101');
  });
  it('etiquetas OCI', () => {
    for (const k of ['source', 'version', 'revision', 'created']) expect(df).toContain(`org.opencontainers.image.${k}`);
  });
  it('Compose: solo lectura, sin capacidades, no-new-privileges, no privilegiado', () => {
    expect(cp).toMatch(/read_only: true/);
    expect(cp).toMatch(/cap_drop: \[ALL\]/);
    expect(cp).toMatch(/no-new-privileges:true/);
    expect(cp).toMatch(/privileged: false/);
    expect(cp).toMatch(/user: ["']?101:101["']?/);
  });
  it('Compose: publica solo en 127.0.0.1:3101', () => {
    const ports = cp.match(/^\s+- ["']?[\d.]+:\d+:\d+["']?$/gm) ?? [];
    expect(ports).toHaveLength(1);
    expect(ports[0]).toContain('127.0.0.1:3101:8080');
  });
  it('Compose: sin socket Docker, sin volúmenes del host, sin cap_add, tmpfs mínimo', () => {
    expect(cp).not.toMatch(/docker\.sock|cap_add|network_mode: host|pid: host|^\s+volumes:/m);
    expect(cp).toMatch(/tmpfs:/);
    expect(cp).toMatch(/noexec/);
  });
  it('Compose: imagen exige digest y logs con rotación', () => {
    expect(cp).toMatch(/ORLANDO_IMAGE:\?/);
    expect(cp).not.toMatch(/:latest/);
    expect(cp).toMatch(/max-size/);
    expect(cp).toMatch(/max-file/);
  });
  it('Nginx: temporales en /tmp, sin server_tokens, solo GET/HEAD, bloquea dotfiles', () => {
    expect(ng).toMatch(/pid \/tmp\/nginx\.pid/);
    expect(ng).toMatch(/server_tokens off/);
    expect(ng).toMatch(/\^\(GET\|HEAD\)\$/);
    expect(ng).toMatch(/location ~ \/\\\./);
    expect(ng).not.toMatch(/autoindex on|Strict-Transport-Security/i);
  });
});

describe('workflows (cadena de suministro)', () => {
  const wfs = readdirSync('.github/workflows').map((f) => [f, read(join('.github/workflows', f))]);
  it('hay workflows CI y release', () => {
    expect(wfs.map(([f]) => f).sort()).toEqual(['ci.yml', 'release.yml']);
  });
  it('todas las acciones están fijadas a SHA completo', () => {
    for (const [f, c] of wfs)
      for (const m of c.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)) {
        if (m[1].startsWith('./')) continue;
        expect(m[1], `${f}: ${m[1]}`).toMatch(/@[0-9a-f]{40}$/);
      }
  });
  it('permisos mínimos declarados a nivel de workflow', () => {
    for (const [f, c] of wfs) expect(c, f).toMatch(/^permissions:\s*\n\s+contents: read/m);
  });
  it('sin despliegue por SSH ni secretos personalizados', () => {
    for (const [f, c] of wfs) {
      expect(c, f).not.toMatch(/ssh|scp |rsync|appleboy/i);
      expect(c, f).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
    }
  });
  it('release usa GITHUB_TOKEN, escanea antes de publicar y no usa latest', () => {
    const r = wfs.find(([f]) => f === 'release.yml')[1];
    expect(r).toMatch(/secrets\.GITHUB_TOKEN|github\.token/);
    expect(r).not.toMatch(/:latest|tags:.*latest/);
    expect(r).toMatch(/workflow_dispatch/);
    expect(r.indexOf('trivy')).toBeGreaterThan(-1);
    expect(r.indexOf('trivy')).toBeLessThan(r.indexOf('push: true'));
  });
  it('lockfile presente', () => expect(existsSync('package-lock.json')).toBe(true));
});

describe('documentación de despliegue', () => {
  it('todo comando `docker compose` en DEPLOYMENT/ROLLBACK usa -f compose.prod.yml', () => {
    for (const f of ['docs/DEPLOYMENT.md', 'docs/ROLLBACK.md']) {
      const cmds = read(f)
        .split('\n')
        .filter((l) => /^\s*(?:\S.*&&\s*)?docker compose\b/.test(l) || /\|\| docker compose|; docker compose/.test(l));
      expect(cmds.length, f).toBeGreaterThan(0);
      for (const c of cmds) expect(c, `${f}: ${c}`).toMatch(/docker compose -f compose\.prod\.yml/);
    }
  });
  it('mantiene puertos 127.0.0.1:3101 -> 8080 y no toca Nginx del host', () => {
    expect(read('docs/DEPLOYMENT.md')).toMatch(/127\.0\.0\.1:3101:8080/);
    expect(read('docs/DEPLOYMENT.md')).toMatch(/No se modifica el Nginx del host ni Cloudflare Tunnel/);
  });
  it('documenta required reviewers y la limitación de ignore-unfixed', () => {
    expect(read('docs/DEPLOYMENT.md')).toMatch(/Required reviewers/);
    expect(read('docs/SECURITY.md')).toMatch(/ignore-unfixed: true/);
  });
});
