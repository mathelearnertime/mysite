const CACHE = 'flower-proxy-v24';   // app files: bump this when you redeploy
const GAME_CACHE = 'flower-games';   // saved games: NEVER bump or delete, so updates don't wipe them
const CORE = ['/', '/index.html', '/manifest.json', '/store.js', '/config.js', '/calling.js', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/blank.png'];
// Full games (same list as store.js). These pages are thin loaders: the real game files live on jsdelivr.
const GAMES = ["/games/capuchinsfremake.html", "/games/clfnac1remake.html", "/games/clfnac2remake.html", "/games/clFNAF2remake%27.html", "/games/clFNAF3remake.html", "/games/clfnaf3remasteredemake.html", "/games/clfnaf4halloweenremake.html", "/games/clFNAF4remake.html", "/games/clfnafpsremake.html", "/games/clFNAFremake.html", "/games/clfnafshooterremake.html", "/games/clfnafslremake.html", "/games/clfnafucnremake.html", "/games/clfnafworlddremake.html", "/games/clgorillatagremake.html", "/games/clgrannyyremake.html", "/games/clsuperkidadventure.html"];
// Never cache live/streaming/account services.
const SKIP = ['supabase.co', 'moviebite.org', 'ytify.pp.ua', 'googleapis.com/dogeub', 'dancing-yeot-d5dc7d.netlify.app', 'data.jsdelivr.com', 'api.github.com'];
// CDNs that allow CORS: no-cors requests to them are re-requested as CORS so they're stored as normal (non-opaque) responses.
const CORS_CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//;

const GAME_PATHS = GAMES.map(p => decodeURIComponent(p));
function isGameUrl(url) {
  const u = new URL(url);
  return u.origin !== self.location.origin || GAME_PATHS.includes(decodeURIComponent(u.pathname));
}

async function putClean(cache, url, res) {
  // Redirected responses (Cloudflare /x.html -> /x) can't be served to navigations, so store a clean copy.
  const out = res.redirected ? new Response(await res.clone().blob(), { status: 200, headers: res.headers }) : res.clone();
  await cache.put(url, out);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    const gc = await caches.open(GAME_CACHE);
    await Promise.allSettled(GAMES.map(async p => { const u = new URL(p, self.location.origin).href; const r = await fetch(u); if (r.ok) await putClean(gc, u, r); }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== GAME_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });

// Network-first so new deploys show up right away; everything fetched (including what games pull from CDNs) is kept as the offline copy.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  if (SKIP.some(h => req.url.includes(h))) return;
  const upgrade = req.mode === 'no-cors' && CORS_CDN.test(req.url);
  event.respondWith(
    go(req, upgrade).then(response => {
      if ((response.ok && response.status === 200) || response.type === 'opaque') {
        const copy = response.clone();
        caches.open(isGameUrl(req.url) ? GAME_CACHE : CACHE).then(cache => cache.put(req.url, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(req.url, { ignoreSearch: true }).then(cached => cached || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});

// jsdelivr sometimes answers 403/5xx (rate limits, big files). Use the saved copy if there is one, otherwise try its mirrors.
function mirrorsFor(url) {
  const m = url.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/@]+)\/([^\/@]+)@([^\/]+)\/(.*)$/);
  const out = [url.replace('//cdn.jsdelivr.net/', '//fastly.jsdelivr.net/'), url.replace('//cdn.jsdelivr.net/', '//gcore.jsdelivr.net/')];
  if (m) out.push(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3] === 'latest' ? 'HEAD' : m[3]}/${m[4]}`);
  return out;
}
async function go(req, upgrade) {
  let res = null;
  try { res = await fetch(upgrade ? new Request(req.url, { mode: 'cors', credentials: 'omit' }) : req); } catch (e) {}
  if (res && (res.ok || res.type === 'opaque')) return res;
  const cached = await caches.match(req.url, { ignoreSearch: true });
  if (cached) return cached;
  if (/^https:\/\/cdn\.jsdelivr\.net\//.test(req.url)) {
    for (let round = 0; round < 2; round++) {
      for (const u of mirrorsFor(req.url)) {
        try { const r = await fetch(u, { mode: 'cors', credentials: 'omit' }); if (r.ok) return r; } catch (e) {}
      }
      await new Promise(r => setTimeout(r, 700));
    }
  }
  if (res) return res;
  throw new Error('network');
}

/* ---- "Save for offline": download every file a game's CDN folder contains ---- */
async function listRepo(user, repo, ver) {
  // jsdelivr refuses to list big repos (403), so fall back to GitHub's file tree.
  try {
    const r = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${user}/${repo}${ver ? '@' + ver : ''}?structure=flat`);
    if (!r.ok) throw new Error('jsdelivr ' + r.status);
    const j = await r.json();
    const names = (j.files || []).map(f => f.name);
    if (names.length) return names;
    throw new Error('jsdelivr empty');
  } catch (e1) {
    let ref = ver;
    if (!ref || ref === 'latest') {
      const ri = await fetch(`https://api.github.com/repos/${user}/${repo}`);
      if (!ri.ok) throw new Error('github repo ' + ri.status + ' (' + e1.message + ')');
      ref = (await ri.json()).default_branch;
    }
    const r = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    if (!r.ok) throw new Error('github tree ' + r.status + ' (' + e1.message + ')');
    const j = await r.json();
    return (j.tree || []).filter(t => t.type === 'blob').map(t => '/' + t.path);
  }
}

async function saveGame(src, port) {
  const say = m => port.postMessage(m);
  try {
    const cache = await caches.open(GAME_CACHE);
    const pageUrl = new URL(src, self.location.origin).href;
    const res = await fetch(pageUrl);
    if (!res.ok) throw new Error('game page ' + res.status);
    await putClean(cache, pageUrl, res);
    const html = await res.text();
    // Every jsdelivr gh folder the page points at. A <base href> restricts the download to that game's subfolder.
    const baseM = html.match(/<base\s+href\s*=\s*["']([^"']+)["']/i);
    const re = /https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/@"'\s]+)\/([^\/@"'\s]+)(?:@([^\/"'\s]+))?(\/[^"'\s`]*)?/g;
    const repos = new Map();
    for (const m of html.matchAll(re)) {
      const key = m[1] + '/' + m[2] + '@' + (m[3] || '');
      if (!repos.has(key)) repos.set(key, { user: m[1], repo: m[2], ver: m[3] || '', prefix: '' });
    }
    if (baseM) {
      const bm = [...baseM[1].matchAll(re)][0];
      if (bm) { const o = repos.get(bm[1] + '/' + bm[2] + '@' + (bm[3] || '')); if (o) o.prefix = decodeURIComponent(bm[4] || ''); }
    }
    const jobs = [];
    for (const o of repos.values()) {
      const names = await listRepo(o.user, o.repo, o.ver);
      for (const n of names) if (!o.prefix || n.startsWith(o.prefix)) jobs.push(`https://cdn.jsdelivr.net/gh/${o.user}/${o.repo}${o.ver ? '@' + o.ver : ''}${n}`);
    }
    // Scripts from cdnjs etc. referenced directly by the page.
    for (const m of html.matchAll(/https:\/\/cdnjs\.cloudflare\.com\/[^"'\s)]+/g)) jobs.push(m[0]);
    let done = 0, ok = 0, failed = 0, lastErr = '';
    const queue = [...new Set(jobs)];
    const total = queue.length;
    say({ type: 'progress', done, total });
    const worker = async () => {
      while (queue.length) {
        const u = queue.shift();
        try {
          if (await cache.match(u)) ok++;
          else {
            let r = await fetch(u, { mode: 'cors', credentials: 'omit' }).catch(() => null);
            if (!r || !r.ok) { for (const mu of mirrorsFor(u)) { r = await fetch(mu, { mode: 'cors', credentials: 'omit' }).catch(() => null); if (r && r.ok) break; } }
            if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : 'network'));
            await cache.put(u, r);
            ok++;
          }
        } catch (e) { failed++; lastErr = String(e && e.message || e); }
        done++; if (done % 3 === 0 || done === total) say({ type: 'progress', done, total });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    say({ type: 'done', ok, failed, total, err: lastErr });
  } catch (e) {
    say({ type: 'error', message: String(e && e.message || e) });
  }
}

self.addEventListener('message', event => {
  const d = event.data || {};
  if (d.type === 'save-game' && event.ports && event.ports[0]) event.waitUntil(saveGame(d.src, event.ports[0]));
});
