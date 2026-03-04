// static/js/spa.js

// Configuração global do SPA
const SPA_CONFIG = {
  debug: true,
  cacheBusting: true,
  defaultLoader: '<div class="spa-loader">Carregando...</div>'
};

// Cache de páginas para performance
const PAGE_CACHE = new Map();

/* >>> NOVO: garante "/" no fim de rotas (evita 301/302 do Django) */
function normalizeRoute(url) {
  try {
    const u = new URL(url, window.location.origin);
    // Se tiver extensão (.css, .js, .png etc.), não altera
    if (/\.[a-z0-9]+$/i.test(u.pathname)) return u.pathname + u.search + u.hash;
    const path = u.pathname.endsWith('/') ? u.pathname : (u.pathname + '/');
    return path + u.search + u.hash;
  } catch {
    if (/\.[a-z0-9]+$/i.test(url)) return url;
    return url.endsWith('/') ? url : (url + '/');
  }
}

window.carregarTela = async function(url, options = {}) {
  url = normalizeRoute(url); // <<< normaliza sempre
  if (SPA_CONFIG.debug) console.log(`[SPA] Carregar: ${url}`);

  const main = document.getElementById('main-content');
  if (!main) throw new Error('Elemento #main-content não encontrado');

  // mostra loader
  main.innerHTML = options.loaderHTML || SPA_CONFIG.defaultLoader;

  // usa cache?
  if (PAGE_CACHE.has(url) && !options.forceReload) {
    if (SPA_CONFIG.debug) console.log('[SPA] Usando cache:', url);
    return injectContent(PAGE_CACHE.get(url), url);
  }

  try {
    const start = performance.now();
    const resp = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', ...(options.headers||{}) },
      cache: SPA_CONFIG.cacheBusting ? 'no-cache' : 'default',
      credentials: 'same-origin',
    });

    /* >>> CORREÇÃO: se não for 2xx, NÃO processa HTML nem scripts */
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();
    const ms = ((performance.now()-start)/1000).toFixed(2);
    if (SPA_CONFIG.debug) console.log(`[SPA] Carregado em ${ms}s: ${url}`);
    PAGE_CACHE.set(url, html);
    await injectContent(html, url);
  } catch (err) {
    console.error('[SPA] Erro:', err);
    main.innerHTML = `
      <div class="spa-error">
        <h3>Erro ao carregar a página</h3>
        <p>${err.message}</p>
        <a href="#" id="spaReload">Recarregar</a>
      </div>`;
    const a = document.getElementById('spaReload');
    if (a) a.onclick = (e) => { e.preventDefault(); carregarTela(url, { forceReload:true }); };
  }
};

/* >>> CORREÇÃO: executa SOMENTE <script data-spa-script> do partial */
async function injectContent(html, url) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const main   = document.getElementById('main-content');

  // injeta o HTML como veio
  const bodyHTML = doc.body ? doc.body.innerHTML : html;
  main.innerHTML = bodyHTML;

  // histórico
  window.history.pushState({ spa: true, url }, '', url);

  // Executa apenas scripts marcados explicitamente para SPA
  const scripts = main.querySelectorAll('script[data-spa-script]');
  for (const s of scripts) {
    if (s.src) {
      await loadExternalScript(s.src);
    } else if (s.textContent && s.textContent.trim()) {
      // eslint-disable-next-line no-new-func
      new Function(s.textContent)();
    }
    s.remove(); // evita reexecução
  }

  // evento para inicializações de cada tela
  window.dispatchEvent(new CustomEvent('spa-page-loaded', { detail:{url, t:Date.now()} }));
}

function loadExternalScript(src) {
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = SPA_CONFIG.cacheBusting ? `${src}?t=${Date.now()}` : src;
    sc.defer = true;
    sc.onload  = () => res();
    sc.onerror = () => rej(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(sc);
  });
}

// intercepta todos os clicks em <a> internos
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');

  // ignora âncoras, links externos, downloads
  if (href.startsWith('#') || href.match(/^https?:\/\//) || a.hasAttribute('download')) return;

  e.preventDefault();
  window.carregarTela(normalizeRoute(href)); // <<< normaliza aqui também
});

// volta/avança do histórico
window.addEventListener('popstate', e => {
  if (e.state?.spa) carregarTela(e.state.url||location.pathname, { forceReload:true });
});

// estilos mínimos para loader/erro (mantém padrão)
const style = document.createElement('style');
style.textContent = `
  .spa-loader { padding:2rem; text-align:center; color:#00acee; font-family:Orbitron; }
  .spa-error  { padding:2rem; text-align:center; color:#ff6e60; font-family:Roboto; }
`;
document.head.appendChild(style);

// reforço para dashboard inicial (sem mudar layout)
window.addEventListener('spa-page-loaded', function() {
  const p = window.location.pathname;
  if (p.endsWith('/dashboard/') || p.endsWith('/dashboard/inicial/') || p === '/dashboard') {
    if (typeof window.dashboardInit === "function") window.dashboardInit();
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const p = window.location.pathname;
  if (p === '/dashboard/' || p === '/dashboard/inicial/' || p === '/dashboard') {
    if (typeof window.carregarTela === "function") window.carregarTela(p);
  }
});

console.log('[SPA] Inicializado');
