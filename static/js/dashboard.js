// static/js/dashboard.js

// ========= CONFIG ==========
const NEWS_API_URL      = '/dashboard/noticias-startups-tecmundo/';
const KPIS_API_URL      = '/dashboard/kpis/';
const INSIGHT_API_URL   = '/dashboard/insights-tecnologia/';
const FLUXO_LISTAR_URL  = '/fluxo_caixa/listar/';

const UNSPLASH_KEY         = "_ieWpFKCgtSHFcJW3ftiwO5Uw_o00O2FmlhKdzJEhec";
const ICON_DAY             = "/static/icones/ico_dia.png";
const ICON_NIGHT           = "/static/icones/ico_noite.png";
const OPENWEATHER_API_KEY  = "OPENWEATHER_KEY";
const DEFAULT_CITY         = "São Paulo,BR";

// ========= VARIÁVEIS ==========
let weatherCity     = DEFAULT_CITY;
let weatherCityName = "";
let _calendarInstance = null;
let _chartInstance    = null;
let _clk              = null;

// ========= UTILS ==========
function safeGet(id){ return document.getElementById(id); }
function pad(n){ return n<10?'0'+n:n; }
function formatBRL(n){
  if (n === null || n === undefined) return 'R$ 0,00';
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(',', '.'));
  if (Number.isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR',{ style:'currency', currency:'BRL' });
}
function dayOfYear(d=new Date()){
  const start = new Date(d.getFullYear(),0,1);
  const diff = d - start;
  return Math.floor(diff/86400000) + 1;
}
function toISO(d){ return d.toISOString().slice(0,10); }
function firstDayOfMonth(date){ return new Date(date.getFullYear(), date.getMonth(), 1); }
function lastDayOfMonth(date){ return new Date(date.getFullYear(), date.getMonth()+1, 0); }
function addMonths(date, delta){ return new Date(date.getFullYear(), date.getMonth()+delta, 1); }
function tryParseDate(str){
  if (!str) return null;
  if (str.includes('/')){
    const [dd,mm,yyyy] = str.split('/');
    const d = new Date(Number(yyyy), Number(mm)-1, Number(dd));
    return isNaN(d) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}
function parseDecimalStr(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace('.', '').replace(',', '.')) || parseFloat(String(v).replace(',', '.')) || 0;
}
function extractStatus(desc){
  if (!desc) return null;
  const m = desc.match(/\[@status=([^\]]+)\]/i);
  return m ? m[1].trim() : null;
}
function monthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(date){
  return date.toLocaleString('pt-BR', { month:'short' }).replace('.', '');
}
// Normaliza barra final mantendo query
function withSlash(url){
  if (url.includes('?')){
    const [b, q] = url.split('?');
    return (b.endsWith('/') ? b : b + '/') + '?' + q;
  }
  return url.endsWith('/') ? url : url + '/';
}
// Espera por uma condição sem travar o restante
function waitFor(predicate, tries=40, delay=80){
  return new Promise(resolve=>{
    let t = 0;
    (function loop(){
      try { if (predicate()) return resolve(true); } catch {}
      if (++t >= tries) return resolve(false);
      setTimeout(loop, delay);
    })();
  });
}

// ========= TYPEWRITER (Frase do Dia) ==========
const FRASES_DO_DIA = (window.DASHBOARD_FRASES && Array.isArray(window.DASHBOARD_FRASES) && window.DASHBOARD_FRASES.length)
  ? window.DASHBOARD_FRASES
  : [
      '“Quem domina a tecnologia domina o futuro.”',
      '“Automatize o repetível, foque no essencial.”',
      '“A tecnologia está em tudo — use-a para facilitar sua rotina.”',
      '“Quem aprende tecnologia hoje simplifica o amanhã.”',
      '“Pequenas melhorias, grandes resultados.”',
      '“Consistência vence intensidade.”',
      '“Organize hoje, ganhe amanhã.”'
    ];

function typewriter(el, text, speed=26){
  if (!el) return;
  el.textContent = '';
  let i = 0;
  (function tick(){
    if (i <= text.length){
      el.textContent = text.slice(0, i++);
      setTimeout(tick, speed);
    }
  })();
}

function carregarFraseDoDia(){
  const el = safeGet('typewriter-text');
  if (!el) return;
  const idx = dayOfYear() % FRASES_DO_DIA.length;
  const frase = FRASES_DO_DIA[idx];
  if (el.textContent && el.textContent.trim() === frase.replace(/(^“|”$)/g,'')) return;
  typewriter(el, frase, 26);
  const agora = new Date();
  const next = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()+1, 0,0,2);
  setTimeout(carregarFraseDoDia, next - agora);
}

// ========= FULLCALENDAR ==========
function inicializarCalendario(){
  let tries = 0;
  function tryInit() {
    const el = safeGet('calendario');
    if (!window.FullCalendar || !el) {
      if (tries++ < 15) return void setTimeout(tryInit, 60);
      return console.warn('[Dashboard] FullCalendar indisponível');
    }
    if (_calendarInstance){ _calendarInstance.destroy(); _calendarInstance = null; }
    _calendarInstance = new FullCalendar.Calendar(el, {
      initialView: 'dayGridMonth',
      locale: 'pt-br',
      firstDay: 1,
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
      buttonText: { today:'Hoje', month:'Mês', week:'Semana', day:'Dia' }
    });
    _calendarInstance.render();
  }
  tryInit();
}

// ========= CLOCK & WEATHER ==========
async function fetchUserLocation(){
  try {
    const r = await fetch("/dashboard/ipinfo/");
    const d = await r.json();
    if (d.city && d.country){
      weatherCity     = `${d.city},${d.country}`;
      weatherCityName = d.city;
    }
  } catch { weatherCity = DEFAULT_CITY; }
}
function startClock(){
  if (_clk) clearInterval(_clk);
  _clk = setInterval(()=>{
    const now = new Date();
    const hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
    const ce = safeGet('clock');
    if (ce) ce.textContent = `${hh}:${mm}:${ss}`;
    updateWeatherIcon(now.getHours());
  },1000);
}
function updateWeatherIcon(h){
  const ic = safeGet('weather-icon');
  if (!ic) return;
  const tgt = (h<6||h>=18)? ICON_NIGHT: ICON_DAY;
  if (!ic.src.includes(tgt)){
    ic.style.opacity = 0;
    setTimeout(()=>{ ic.src = tgt; ic.style.opacity = 1; },250);
  }
}
async function fetchWeather(){
  try {
    const city = weatherCity.normalize("NFD").replace(/[\u0300-\u036f]/g,'');
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=pt_br`
    );
    const d = await r.json();
    const te = safeGet('weather-temp');
    if (te) te.textContent = `${Math.round(d.main.temp)}°C`;
  } catch {
    const te = safeGet('weather-temp');
    if (te) te.textContent = '--°C';
  }
}
async function fetchForecast(){
  try {
    const city = weatherCity.normalize("NFD").replace(/[\u0300-\u036f]/g,'');
    const r = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&cnt=24&appid=${OPENWEATHER_API_KEY}&lang=pt_br`
    );
    const d = await r.json();
    const name    = weatherCityName || d.city?.name || (weatherCity?.split(',')[0] || '');
    const country = d.city?.country || (weatherCity?.split(',')[1] || '');
    const cityEl  = safeGet('forecast-city'); if (cityEl) cityEl.textContent = name ? (country ? `${name} - ${country}` : name) : '';
    const days = {};
    d.list.forEach(it=>{
      const date = new Date(it.dt_txt);
      const wd   = date.toLocaleDateString('pt-BR',{weekday:'short'});
      (days[wd] = days[wd]||[]).push(it);
    });
    let html = '';
    Object.keys(days).slice(0,3).forEach(day => {
      const temps = days[day].map(i=>i.main.temp);
      const max   = Math.round(Math.max(...temps));
      const min   = Math.round(Math.min(...temps));
      html += `
        <div class="forecast-item">
          <span class="forecast-day">${day}:</span>
          <span class="forecast-temps">${max}° / ${min}°</span>
          <span class="forecast-emoji">${getWeatherEmoji(days[day][0].weather[0].main)}</span>
        </div>`;
    });
    const ul = safeGet('forecast-list');
    if (ul) ul.innerHTML = html;
  } catch {
    const ul = safeGet('forecast-list');
    if (ul) ul.innerHTML = "<span class='text-red-500'>Erro ao buscar previsão.</span>";
  }
}
function getWeatherEmoji(w){
  return { Clear:"☀️", Clouds:"☁️", Rain:"🌧️", Drizzle:"🌦️", Thunderstorm:"⛈️", Snow:"❄️" }[w]||"🌡️";
}
function setupWeatherDropdown(){
  const ic = safeGet('weather-icon'), tp = safeGet('weather-temp'), dd = safeGet('weather-forecast-dropdown');
  if (!ic||!tp||!dd) return;
  const show=()=>{ dd.classList.remove('hidden'); fetchForecast(); }, hide=()=>{ dd.classList.add('hidden'); };
  ic.addEventListener('click', show); tp.addEventListener('click', show);
  document.addEventListener('click', e=>{ if (!dd.contains(e.target)&&e.target!==ic&&e.target!==tp) hide(); });
}

// ========= NOTÍCIAS (2 ITENS) ==========
async function carregarNoticiasTecnologia(){
  const ul = safeGet('noticiasTecnologia'); if (!ul) return;
  ul.innerHTML = '<li>Carregando notícias...</li>';
  try {
    const r = await fetch(NEWS_API_URL, { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    if (!r.ok) throw new Error();
    const j = await r.json();
    ul.innerHTML = (Array.isArray(j.noticias) ? j.noticias.slice(0,2) : []).map(n=>`
      <li style="margin-bottom:8px;">
        <a href="${n.link}" target="_blank" style="color:#19e4ff;">${n.title}</a><br>
        <small style="color:#3ef4ff;">Fonte: ${n.fonte}</small>
      </li>`).join('') || '<li>Sem notícias recentes agora.</li>';
  } catch {
    ul.innerHTML = '<li>Falha ao carregar notícias.</li>';
  }
}

// ========= GRÁFICO DO FLUXO (REAL, últimos 6 meses) ==========
async function atualizarGraficoFluxoCaixa(){
  const ready = await waitFor(()=>window.Chart && safeGet('graficoFluxoCaixa'));
  if (!ready) { console.warn('[Dashboard] Chart.js indisponível, pulando gráfico por enquanto.'); return; }

  const c = safeGet('graficoFluxoCaixa');
  const hoje = new Date();
  const startRef = firstDayOfMonth(addMonths(hoje, -5));
  const endRef   = lastDayOfMonth(hoje);
  const labels = [], meses = [];
  for (let i=0; i<6; i++){
    const d = addMonths(startRef, i);
    labels.push(monthLabel(d));
    meses.push(monthKey(d));
  }
  const somaE = Object.fromEntries(meses.map(k=>[k,0]));
  const somaS = Object.fromEntries(meses.map(k=>[k,0]));
  let ok = false;

  try {
    const url = new URL(FLUXO_LISTAR_URL, window.location.origin);
    url.searchParams.set('periodo','custom');
    url.searchParams.set('inicio', toISO(startRef));
    url.searchParams.set('fim', toISO(endRef));
    url.searchParams.set('tipo','todos');

    const resp = await fetch(url.toString(), { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (Array.isArray(data.movimentos)){
      for (const m of data.movimentos){
        const dt = tryParseDate(m.data);
        if (!dt) continue;
        const mk = monthKey(dt);
        if (!(mk in somaE)) continue;
        const tipo = (m.tipo || '').toLowerCase();
        const valor = parseDecimalStr(m.valor);
        const status = (extractStatus(m.descricao) || '').toLowerCase();
        const contar = status ? (status === 'realizado') : true;
        if (!contar) continue;

        if (tipo === 'entrada') somaE[mk] += valor;
        else if (tipo === 'saida' || tipo === 'saída') somaS[mk] += valor;
      }
      ok = true;
    }
  } catch (e){
    console.warn('[Dashboard] Falha ao puxar fluxo real, mantendo placeholder.', e);
  }

  const dadosE = labels.map((_,i)=> somaE[meses[i]] || 0);
  const dadosS = labels.map((_,i)=> somaS[meses[i]] || 0);

  if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
  const ctx = c.getContext('2d');
  _chartInstance = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Entradas', data: (ok?dadosE:[4100,3500,4600,5800,4900,5900]), backgroundColor:'#00acee', borderRadius:7, maxBarThickness:32 },
        { label:'Saídas',   data: (ok?dadosS:[3200,2700,3800,4300,4000,4200]), backgroundColor:'#ffe44a', borderRadius:7, maxBarThickness:32 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#7fdcff', font:{family:'Orbitron'}}}},
      scales:{
        x:{ ticks:{ color:'#7fdcff', font:{family:'Orbitron'}}, grid:{ color:'#182a3c' } },
        y:{ ticks:{ color:'#b1eaff', font:{family:'Roboto'}},  grid:{ color:'#182a3c' } }
      }
    }
  });
}

// ========= VISÃO GERAL DO MÊS (real) ==========
async function atualizarVisaoGeralMes(){
  const elE = safeGet('entradasMes');
  const elS = safeGet('saidasMes');
  const elD = safeGet('destaqueMes');
  if (!elE || !elS || !elD) return;

  try {
    const url = new URL(FLUXO_LISTAR_URL, window.location.origin);
    url.searchParams.set('periodo','mes');
    url.searchParams.set('tipo','todos');

    const resp = await fetch(url.toString(), { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    let entradas = 0, saidas = 0;
    const cats = {};
    if (Array.isArray(data.movimentos)){
      for (const m of data.movimentos){
        const tipo = (m.tipo || '').toLowerCase();
        const valor = parseDecimalStr(m.valor);
        const status = (extractStatus(m.descricao) || '').toLowerCase();
        const contar = status ? (status === 'realizado') : true;
        if (!contar) continue;

        if (tipo === 'entrada') entradas += valor;
        else if (tipo === 'saida' || tipo === 'saída') saidas += valor;

        const cat = (m.categoria && String(m.categoria).trim()) ? String(m.categoria).trim() : 'Sem categoria';
        if (!cats[cat]) cats[cat] = { e:0, s:0 };
        if (tipo === 'entrada') cats[cat].e += valor;
        if (tipo === 'saida' || tipo === 'saída') cats[cat].s += valor;
      }
    }

    elE.textContent = formatBRL(entradas);
    elS.textContent = formatBRL(saidas);

    let topCat = null, topVal = 0;
    for (const [nome, vs] of Object.entries(cats)){
      const total = (vs.e || 0) + (vs.s || 0);
      if (total > topVal){
        topVal = total; topCat = { nome, total };
      }
    }
    elD.textContent = (topCat && topVal > 0)
      ? `Destaque: ${topCat.nome} (${formatBRL(topCat.total)})`
      : 'Nenhum destaque até o momento.';
  } catch (e){
    console.warn('[Dashboard] Visão do mês: falha ao carregar.', e);
  }
}

// ========= MINI-KPIs FINANCEIROS ==========
async function atualizarMiniKpisFinanceiro(){
  const elRecHoje  = safeGet('receberHoje');
  const elPagHoje  = safeGet('pagarHoje');
  const elRecMes   = safeGet('recebimentosMes');
  if (!elRecHoje || !elPagHoje || !elRecMes) return;

  try {
    const url = new URL(FLUXO_LISTAR_URL, window.location.origin);
    url.searchParams.set('periodo','mes');
    url.searchParams.set('tipo','todos');

    const resp = await fetch(url.toString(), { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    let receberHoje = 0, pagarHoje = 0, recebimentosMes = 0;
    const hojeISO = toISO(new Date());

    if (Array.isArray(data.movimentos)){
      for (const m of data.movimentos){
        const tipo   = (m.tipo || '').toLowerCase();
        const valor  = parseDecimalStr(m.valor);
        const status = (extractStatus(m.descricao) || '').toLowerCase();

        const d = tryParseDate(m.data);
        const dISO = d ? toISO(d) : null;

        if (dISO === hojeISO && tipo === 'entrada' && status === 'previsto'){
          receberHoje += valor;
        }
        if (dISO === hojeISO && (tipo === 'saida' || tipo === 'saída') && status === 'previsto'){
          pagarHoje += valor;
        }
        if (tipo === 'entrada' && status === 'realizado'){
          recebimentosMes += valor;
        }
      }
    }

    elRecHoje.textContent = formatBRL(receberHoje);
    elPagHoje.textContent = formatBRL(pagarHoje);
    elRecMes.textContent  = formatBRL(recebimentosMes);
  } catch(e){
    console.warn('[Dashboard] Mini-KPIs: falha ao carregar.', e);
  }
}

// ========= KPIs DO ESTOQUE (com fallback) ==========
async function carregarKpisEstoque(){
  const produtosEl = safeGet('produtosEstoque');
  const valorEl    = safeGet('valorEstoque');
  const avisosEl   = safeGet('produtosCriticos');
  if (!produtosEl || !valorEl || !avisosEl) return;

  // tenta endpoint dedicado primeiro
  try {
    const r = await fetch(KPIS_API_URL, { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();

    const temDados = (j && (j.produtos_estoque !== undefined || j.valor_total !== undefined));
    if (temDados){
      produtosEl.textContent = (j.produtos_estoque ?? 0);
      valorEl.textContent    = formatBRL(j.valor_total);
      const a = j.avisos || {};
      const label = `${a.total || 0} produtos críticos`;
      avisosEl.textContent = label;
      return; // sucesso
    }
    throw new Error('KPIs vazios');
  } catch (e) {
    console.warn('[Dashboard] KPIs: usando fallback via /estoque/listar/.', e);
  }

  // fallback: calcula via lista do estoque
  try {
    const r2 = await fetch('/estoque/listar/', { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
    const d = await r2.json();

    const produtos = Array.isArray(d.produtos) ? d.produtos : [];
    const totalSkusComEstoque = produtos.filter(p => Number(p.quantidade) > 0).length;
    const valorTotal = produtos.reduce((acc, p) => acc + (parseFloat(p.valor_total) || 0), 0);

    const negativos = produtos.filter(p => Number(p.quantidade) < 0).length;
    const zerados   = produtos.filter(p => Number(p.quantidade) === 0).length;
    const criticos  = produtos.filter(p => Number(p.quantidade) > 0 && Number(p.quantidade) <= 6).length;
    const totalAvisos = negativos + zerados + criticos;

    produtosEl.textContent = totalSkusComEstoque;
    valorEl.textContent    = formatBRL(valorTotal);
    avisosEl.textContent   = `${totalAvisos} produtos críticos`;
  } catch (e2){
    console.error('[Dashboard] Fallback KPIs falhou.', e2);
    produtosEl.textContent = '0';
    valorEl.textContent    = formatBRL(0);
    avisosEl.textContent   = '0 produtos críticos';
  }
}

// ========= INSIGHTS (2 por dia) ==========
async function carregarInsightDoDia(){
  const elTexto = safeGet('insightDia');
  const elFonte = safeGet('insightFonte');
  if (!elTexto || !elFonte) return;

  elTexto.textContent = 'Carregando insights...';
  elFonte.innerHTML = '';

  try {
    const r = await fetch(`${INSIGHT_API_URL}?all=1`, { headers:{ 'X-Requested-With':'XMLHttpRequest' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();

    const lista = Array.isArray(j.insights) && j.insights.length
      ? j.insights
      : (j.insight ? [j.insight] : []);
    if (!lista.length) throw new Error('Sem insights');

    const n = lista.length;
    const i1 = dayOfYear() % n;
    const i2 = (i1 + 1) % n;
    const a = lista[i1], b = lista[i2];

    const f1 = a.fonte_nome || (new URL(a.fonte).host.replace(/^www\./,''));
    const f2 = b.fonte_nome || (new URL(b.fonte).host.replace(/^www\./,''));

    elTexto.innerHTML =
      `• ${a.texto}<br><small style="color:#3ef4ff;">Fonte: <a href="${a.fonte}" target="_blank" rel="noopener">${f1}</a></small><br>` +
      `• ${b.texto}<br><small style="color:#3ef4ff;">Fonte: <a href="${b.fonte}" target="_blank" rel="noopener">${f2}</a></small>`;

    elFonte.innerHTML = '';
  } catch (e) {
    console.warn('[Dashboard] Insight remoto falhou, usando fallback.', e);
    elTexto.innerHTML =
      '• Automatize o repetível, foque no essencial.<br><small style="color:#3ef4ff;">Fonte: <a href="https://www.sebrae.com.br/sites/PortalSebrae" target="_blank" rel="noopener">sebrae.com.br</a></small><br>' +
      '• Dados bem organizados reduzem retrabalho.<br><small style="color:#3ef4ff;">Fonte: <a href="https://www.gov.br/governodigital/pt-br" target="_blank" rel="noopener">gov.br</a></small>';
    elFonte.innerHTML = '';
  }
}

// ========= FOTO DO DIA ==========
async function carregarImagemUnsplash(){
  try {
    const r = await fetch(`https://api.unsplash.com/photos/random?query=technology&client_id=${UNSPLASH_KEY}`);
    const j = await r.json();
    if (j.urls?.regular){
      safeGet('imagemDia').src = j.urls.regular;
      safeGet('autorImagemDia').textContent = j.user?.name||'-';
      safeGet('fonteImagemDia').href = j.links?.html || '#';
      safeGet('fonteImagemDia').textContent = 'Ver no Unsplash';
    }
  } catch{}
}

// ========= ATALHOS (cartões inteiros clicáveis + tooltips) ==========
function bindDashboardShortcuts(){
  const root = document.querySelector('.dashboard-main-grid') || document;

  const go = (url) => {
    const final = withSlash(url);
    if (typeof window.carregarTela === 'function') {
      window.carregarTela(final);
    } else {
      window.location.href = final;
    }
  };

  // helper: torna o "cartão" pai clicável
  function makeCardClickable(childEl, url, title){
    if (!childEl) return;
    const card = childEl.closest('.neon-card, .dashboard-card, .kpi-card, .card, .box, .pane, .card-estoque, .card-financeiro') || childEl.parentElement;
    if (!card) return;
    card.style.cursor = 'pointer';
    if (title) card.title = title;
    if (!card.__cardClickBound){
      card.addEventListener('click', ()=>go(url));
      card.__cardClickBound = true;
    }
    childEl.style.cursor = 'pointer';
    if (title) childEl.title = title;
    if (!childEl.__valClickBound){
      childEl.addEventListener('click', ()=>go(url));
      childEl.__valClickBound = true;
    }
  }

  // ESTOQUE — 3 cards
  makeCardClickable(safeGet('produtosEstoque'), '/estoque', 'Ir para estoque');
  makeCardClickable(safeGet('valorEstoque'), '/estoque', 'Ir para estoque');
  makeCardClickable(safeGet('produtosCriticos'), '/estoque?view=avisos', 'Ir para estoque');

  // FINANCEIRO — mini KPIs
  makeCardClickable(safeGet('receberHoje'), '/fluxo_caixa?periodo=hoje&tipo=entrada&status=Previsto', 'Ir para fluxo de caixa');
  makeCardClickable(safeGet('pagarHoje'), '/fluxo_caixa?periodo=hoje&tipo=saida&status=Previsto', 'Ir para fluxo de caixa');
  makeCardClickable(safeGet('recebimentosMes'), '/fluxo_caixa?periodo=mes&tipo=entrada&status=Realizado', 'Ir para fluxo de caixa');

  // VISÃO DO MÊS — card inteiro -> mês; números -> filtros
  const ent = safeGet('entradasMes');
  const sai = safeGet('saidasMes');

  function findCommonCard(a, b){
    const viaA = a && a.closest('.neon-card, .dashboard-card, .kpi-card, .card, .box, .pane, .card-financeiro');
    const viaB = b && b.closest('.neon-card, .dashboard-card, .kpi-card, .card, .box, .pane, .card-financeiro');
    if (viaA && viaA === viaB) return viaA || viaB;
    if (viaA && (!b || viaA.contains(b))) return viaA;
    if (viaB && (!a || viaB.contains(a))) return viaB;

    if (!a && !b) return null;
    const first = a || b;
    const other = (first === a) ? b : a;
    if (!first) return null;
    if (!other) return first.parentElement;

    const set = new Set();
    let n = first, hops = 0;
    while (n && hops++ < 8){ set.add(n); n = n.parentElement; }
    n = other; hops = 0;
    while (n && hops++ < 8){
      if (set.has(n)) return n;
      n = n.parentElement;
    }
    return first.parentElement;
  }

  // usa o ID se existir; senão procura o ancestral comum
  const idCard = document.getElementById('cardVisaoMes');
  const cardVisao = idCard || findCommonCard(ent, sai);

  if (cardVisao){
    cardVisao.style.cursor = 'pointer';
    cardVisao.title = 'Ir para fluxo de caixa (mês)';
    if (!cardVisao.__cardClickBound){
      cardVisao.addEventListener('click', () => go('/fluxo_caixa?periodo=mes'));
      cardVisao.__cardClickBound = true;
    }
  }

  if (ent){
    ent.style.cursor = 'pointer';
    ent.title = 'Ir para fluxo de caixa (entradas do mês)';
    ent.addEventListener('click', (e) => {
      e.stopPropagation();
      go('/fluxo_caixa?periodo=mes&tipo=entrada');
    });
  }
  if (sai){
    sai.style.cursor = 'pointer';
    sai.title = 'Ir para fluxo de caixa (saídas do mês)';
    sai.addEventListener('click', (e) => {
      e.stopPropagation();
      go('/fluxo_caixa?periodo=mes&tipo=saida');
    });
  }
}

// ========= AGENDAMENTO DIÁRIO (00:01) ==========
function scheduleDailyAt(hour, minute, cb){
  function program(){
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const ms = next - now;
    setTimeout(()=>{ Promise.resolve(cb()).finally(program); }, ms);
  }
  program();
}

function refreshDailyWidgets(){
  carregarInsightDoDia();
  carregarNoticiasTecnologia();
  carregarImagemUnsplash();
  atualizarGraficoFluxoCaixa();
  atualizarVisaoGeralMes();
  atualizarMiniKpisFinanceiro();
  carregarKpisEstoque();
}

function scheduleDailyRefresh(){
  scheduleDailyAt(0, 1, refreshDailyWidgets);
}

// ========= INIT ==========
async function dashboardInit(){
  try { await carregarKpisEstoque(); } catch {}
  try { carregarFraseDoDia(); } catch {}

  try {
    await fetchUserLocation();
    startClock();
    fetchWeather();
    setupWeatherDropdown();
    setInterval(fetchWeather, 15*60*1000);
  } catch {}

  try { inicializarCalendario(); setTimeout(inicializarCalendario, 50); } catch {}

  try { await atualizarGraficoFluxoCaixa(); } catch (e){ console.warn(e); }
  try { await atualizarVisaoGeralMes(); } catch (e){ console.warn(e); }
  try { await atualizarMiniKpisFinanceiro(); } catch (e){ console.warn(e); }

  try { carregarInsightDoDia(); } catch {}
  try { carregarImagemUnsplash(); } catch {}
  try { carregarNoticiasTecnologia(); } catch {}

  try { bindDashboardShortcuts(); } catch {}
  try { scheduleDailyRefresh(); } catch {}
}

// roda no F5
if (document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', dashboardInit);
} else {
  dashboardInit();
}

// Atualiza quando o estoque/caixa sinaliza alteração
window.addEventListener('spa-kpis-dirty', (e) => {
  try {
    const mods = e?.detail?.modules || [];
    if (!mods.length || mods.includes('dashboard') || mods.includes('estoque')) {
      carregarKpisEstoque();
    }
    if (!mods.length || mods.includes('financeiro') || mods.includes('dashboard')) {
      atualizarGraficoFluxoCaixa();
      atualizarVisaoGeralMes();
      atualizarMiniKpisFinanceiro();
    }
  } catch {}
});

console.log('[Dashboard] OK');
