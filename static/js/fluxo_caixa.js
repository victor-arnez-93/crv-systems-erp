/* =========================================================================
   FLUXO DE CAIXA — CRV SPA (filtros impecáveis + binds delegados SPA-safe)
   • Recorte por período no front: mes | semana | hoje | data | custom | todos
   • Tipo/Conta/Status aplicados no back + offline (combinado)
   • Parser NF-e (tpNF/CFOP), idempotência, fila offline
   • Binds delegados: botões Importar e filtros nunca “morrem” após reinjeção
   • Emite eventos: 'crv-caixa-atualizado' e 'crv-areas-dirty'
   ========================================================================= */
(function () {
  const ROOT_ID = 'fluxo-caixa';
  const root = () => document.getElementById(ROOT_ID);
  const r0 = root(); if (!r0 || r0.__fxc_bound__) return; r0.__fxc_bound__ = true;

  const XHR_HEADER = { 'X-Requested-With': 'XMLHttpRequest' };
  const CRED = { credentials:'same-origin' };

  const qs  = (s, el=root()) => el.querySelector(s);
  const qsa = (s, el=root()) => Array.from(el.querySelectorAll(s));
  const getCSRF = () => (document.cookie.match(/csrftoken=([^;]+)/)||[])[1]||'';

  const pad2=(n)=>String(n).padStart(2,'0');
  const toISO=(d)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const parseBRDate=(s)=>/^\d{2}\/\d{2}\/\d{4}$/.test(s)?`${s.slice(6,10)}-${s.slice(3,5)}-${s.slice(0,2)}`:s;
  const dispDate=(iso)=>/^\d{4}-\d{2}-\d{2}$/.test(iso)?`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:(iso||'');
  function numBRL(x){ if(x==null)return 0; if(typeof x==='number'&&isFinite(x))return x;
    let s=String(x).replace(/[^\d.,-]/g,''); const last=Math.max(s.lastIndexOf(','),s.lastIndexOf('.'));
    if(last>=0&&s[last]===','){ s=s.replace(/\./g,'').replace(',','.'); } else { s=s.replace(/,/g,''); }
    const n=Number(s); return isFinite(n)?n:0;
  }
  const fmtTipo=(t)=>String(t).toLowerCase()==='entrada'?'entrada':'saida';

  // ------ helpers de período (front faz o recorte)
  const todayISO = ()=> toISO(new Date());
  const monthRangeISO = (d=new Date())=>{
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return [toISO(start), toISO(end)];
  };
  const weekRangeISO = (d=new Date())=>{
    const wd = d.getDay(); // 0..6 (dom..sab)
    const diffToMon = (wd+6)%7;
    const start = new Date(d); start.setDate(d.getDate()-diffToMon);
    const end   = new Date(start); end.setDate(start.getDate()+6);
    return [toISO(start), toISO(end)];
  };

  // ----- Toasts
  const Toasts={ el:qs('#fxc-toasts'),
    show(msg,type='success',ms=5600){
      const holder = this.el || qs('#fxc-toasts') || (()=>{
        const d=document.createElement('div'); d.id='fxc-toasts'; root()?.appendChild(d); return d;
      })();
      const box=document.createElement('div'); box.className=`fxc-toast ${type}`; box.textContent=msg;
      holder.appendChild(box); requestAnimationFrame(()=>box.classList.add('show'));
      setTimeout(()=>{ box.classList.remove('show'); setTimeout(()=>box.remove(),240); }, ms);
    }
  };

  // ----- Elementos/KPIs acessados sempre que precisar (não cacheia nós)
  const EL = {
    periodo: ()=>qs('#filtroPeriodo'), tipo:()=>qs('#filtroTipo'), conta:()=>qs('#filtroConta'), status:()=>qs('#filtroStatus'),
    data:()=>qs('#filtroData'), inicio:()=>qs('#filtroInicio'), fim:()=>qs('#filtroFim'), btnBuscar:()=>qs('#btnAplicarFiltros'),
    kpiIn:()=>qs('#kpiEntradas'), kpiOut:()=>qs('#kpiSaidas'), kpiBal:()=>qs('#kpiSaldo'),
    tbody:()=>qs('#tabelaMovimentos tbody')||qs('#tabelaMovimentos'),
    listaVazia:()=>qs('#listaVazia'),
    selectAll:()=>qs('#selectAll'), btnExcluir:()=>qs('#btnExcluirSelecionados'), bulkInfo:()=>qs('#bulkInfo'),
    btnImportar:()=>qs('#btnImportarNFe'), btnImportarPasta:()=>qs('#btnImportarNFePasta'),
    inpFiles:()=>document.getElementById('inputXmlNFe'),
    inpDir:()=>document.getElementById('inputXmlNFePasta'),
    fData:()=>qs('#campoData'), fTipo:()=>qs('#campoTipo'), fValor:()=>qs('#campoValor'),
    fCategoria:()=>qs('#campoCategoria'), fDescricao:()=>qs('#campoDescricao'),
    fObservacao:()=>qs('#campoObservacao'), fConta:()=>qs('#campoConta'), fStatus:()=>qs('#campoStatus'),
    btnSalvar:()=>qs('#btnSalvar')
  };

  // cria/garante inputs ocultos (recria após reinjeção)
  function ensureHiddenInputs(){
    const rt = root(); if(!rt) return;
    if(!EL.inpFiles()){
      const i=document.createElement('input'); i.type='file'; i.id='inputXmlNFe'; i.accept='.xml'; i.multiple=true; i.hidden=true; rt.appendChild(i);
    }
    if(!EL.inpDir()){
      const i=document.createElement('input'); i.type='file'; i.id='inputXmlNFePasta'; i.accept='.xml'; i.multiple=true; i.hidden=true;
      // mesmo em browsers sem diretório, manteremos fallback via SHIFT/ALT
      rt.appendChild(i);
    }
  }

  // ----- Filtros (visibilidade)
  function show(elm,val=true){ if(elm&&elm.parentElement) elm.parentElement.style.display=val?'':'none'; }
  function applyPeriodoVisibility(){
    const v=EL.periodo()?.value || 'mes';
    show(EL.data(),  v==='data');
    show(EL.inicio(),v==='custom');
    show(EL.fim(),   v==='custom');
  }

  function filtrosToParams(){
    const usp=new URLSearchParams(); const p=EL.periodo()?.value || 'mes';
    usp.set('tipo', EL.tipo()?.value || 'todos');
    if(p==='data'){ usp.set('periodo','data'); if(EL.data()?.value) usp.set('data',EL.data().value); }
    else if(p==='custom'){ usp.set('periodo','custom'); if(EL.inicio()?.value) usp.set('inicio',EL.inicio().value); if(EL.fim()?.value) usp.set('fim',EL.fim().value); }
    else if(['mes','semana','hoje','todos'].includes(p)){ if(p==='todos'){ usp.set('periodo','custom'); usp.set('inicio','1900-01-01'); usp.set('fim','2099-12-31'); } else usp.set('periodo',p); }
    else usp.set('periodo','mes');
    if(EL.conta()?.value && EL.conta().value!=='todas') usp.set('conta',EL.conta().value);
    if(EL.status()?.value && EL.status().value!=='todos') usp.set('status',EL.status().value);
    return usp;
  }

  // ----------------- OFFLINE QUEUE -----------------
  const LS_OFF = 'caixa_offline_queue';
  const offLoad = ()=>{ try{ return JSON.parse(localStorage.getItem(LS_OFF)||'[]'); }catch{return [];} };
  const offSave = (arr)=>{ try{ localStorage.setItem(LS_OFF, JSON.stringify(arr)); }catch{} };
  const offAdd  = (m)=>{ const arr=offLoad(); arr.push({ ...m, id:`local-${Date.now()}-${Math.random().toString(36).slice(2,7)}` }); offSave(arr); };
  const offRemoveById = (id)=> offSave(offLoad().filter(x=>x.id!==id));
  async function offFlush(){
    const arr = offLoad(); if(!arr.length) return;
    const keep=[];
    for(const m of arr){ const ok=await salvarMovServer(m); if(!ok) keep.push(m); }
    offSave(keep);
    if(arr.length && !keep.length) Toasts.show('Pendências do Caixa sincronizadas.', 'success', 3800);
  }

  // ------------- BUSCAR TODOS p/ DEDUP -------------
  async function fetchAssinaturasCaixa(){
    try{
      const resp=await fetch('/fluxo_caixa/listar/?periodo=custom&inicio=1900-01-01&fim=2099-12-31&tipo=todos',{headers:XHR_HEADER,...CRED});
      if(!resp.ok) return new Set();
      const data=await resp.json();
      const movs=Array.isArray(data.movimentos)?data.movimentos:[];
      const set=new Set();
      movs.forEach(m=>{
        const v=Number(m.valor)||0; const ref=m.ref||refFromDesc(m.descricao||'')||'';
        set.add(`${(m.data||'').slice(0,10)}|${fmtTipo(m.tipo)}|${v.toFixed(2)}|${ref}`);
      });
      return set;
    }catch{ return new Set(); }
  }

  // ----------------- LISTAGEM (com filtros perfeitos no front) -----------------
  async function listar(){
    let respData={movimentos:[],resumo:{entradas:'0',saidas:'0',saldo:'0'}};
    const usp=filtrosToParams();

    try{
      const resp=await fetch(`/fluxo_caixa/listar/?${usp.toString()}`,{headers:XHR_HEADER,...CRED});
      const ct=resp.headers.get('content-type')||''; if(resp.ok && ct.includes('application/json')) respData=await resp.json();
    }catch(e){ console.warn('[listar]',e); }

    // filtros
    const tipoFiltro   = EL.tipo()?.value   || 'todos';
    const contaFiltro  = EL.conta()?.value  || 'todas';
    const statusFiltro = EL.status()?.value || 'todos';
    const periodo      = EL.periodo()?.value|| 'mes';
    const dataFixa     = EL.data()?.value   || '';
    const [iniCustom, fimCustom] = [EL.inicio()?.value||'', EL.fim()?.value||''];

    // intervalo
    let ini='', fim='';
    if(periodo==='mes'){ [ini,fim] = monthRangeISO(); }
    else if(periodo==='semana'){ [ini,fim] = weekRangeISO(); }
    else if(periodo==='hoje'){ ini=fim=todayISO(); }
    else if(periodo==='data' && dataFixa){ ini=fim=dataFixa; }
    else if(periodo==='custom' && iniCustom && fimCustom){ ini=iniCustom; fim=fimCustom; }
    const inRange = (iso)=>{ if(!iso) return false; if(!ini && !fim) return true; return (!ini || iso>=ini) && (!fim || iso<=fim); };

    // offline filtrado
    let offline = offLoad().filter(m=>{
      const iso=(m.data||'').slice(0,10);
      const okPeriodo = inRange(iso);
      const okTipo = tipoFiltro==='todos' ? true : fmtTipo(m.tipo)===fmtTipo(tipoFiltro);
      const metas = parseMetas(m.descricao||'');
      const okConta = contaFiltro==='todas' ? true : (metas.conta||'').toLowerCase().includes(contaFiltro.toLowerCase());
      const okStatus= statusFiltro==='todos'? true : (metas.status||'').toLowerCase().includes(statusFiltro.toLowerCase());
      return okPeriodo && okTipo && okConta && okStatus;
    });

    // servidor filtrado novamente (consistência)
    const back = Array.isArray(respData.movimentos)?respData.movimentos:[];
    const backFiltered = back.filter(m=>{
      const iso=(m.data||'').slice(0,10);
      const okPeriodo = inRange(iso);
      const okTipo = tipoFiltro==='todos' ? true : fmtTipo(m.tipo||'')===fmtTipo(tipoFiltro);
      const metas = parseMetas(m.descricao||'');
      const okConta = contaFiltro==='todas' ? true : (metas.conta||'').toLowerCase().includes(contaFiltro.toLowerCase());
      const okStatus= statusFiltro==='todos'? true : (metas.status||'').toLowerCase().includes(statusFiltro.toLowerCase());
      return okPeriodo && okTipo && okConta && okStatus;
    });

    // combinar + dedup
    const comb = dedupStrong([...backFiltered, ...offline]);

    // KPIs
    const entradas = comb.filter(m=>fmtTipo(m.tipo)==='entrada').reduce((s,m)=>s+numBRL(m.valor),0);
    const saidas   = comb.filter(m=>fmtTipo(m.tipo)==='saida').reduce((s,m)=>s+numBRL(m.valor),0);
    EL.kpiIn()  && (EL.kpiIn().textContent  = money.format(entradas));
    EL.kpiOut() && (EL.kpiOut().textContent = money.format(saidas));
    EL.kpiBal() && (EL.kpiBal().textContent = money.format(entradas-saidas));

    renderTable(comb);
    offFlush();

    safeDispatch('crv-caixa-atualizado', {periodo:{ini:ini||'1900-01-01', fim:fim||'2099-12-31'}, resumo:{entradas,saidas,saldo:entradas-saidas}});
    return comb;
  }

  // ----- Render tabela
  function parseMetas(desc=''){ let clean=desc, conta=null, status=null;
    const m1=desc.match(/\[@conta=([^\]]+)\]/i); if(m1){conta=m1[1].trim(); clean=clean.replace(m1[0],'').trim();}
    const m2=desc.match(/\[@status=([^\]]+)\]/i); if(m2){status=m2[1].trim(); clean=clean.replace(m2[0],'').trim();}
    return { clean, conta, status };
  }
  function renderTable(movs){
    const tbody=EL.tbody(); if(!tbody) return; tbody.innerHTML='';
    const listaVazia=EL.listaVazia();

    if(!movs?.length){ if(listaVazia) listaVazia.style.display=''; const sa=EL.selectAll(); if(sa) sa.checked=false; const bi=EL.bulkInfo(); if(bi) bi.textContent='0 selecionados'; return; }
    if(listaVazia) listaVazia.style.display='none';

    const frag=document.createDocumentFragment();
    movs.forEach(m=>{
      const isLocal = String(m.id||'').startsWith('local-');
      const tr=document.createElement('tr'); const metas=parseMetas(m.descricao||''); const badge=fmtTipo(m.tipo)==='entrada'?'badge-in':'badge-out';
      tr.innerHTML=`
        <td><input type="checkbox" class="chkrow" data-id="${m.id||''}" data-local="${isLocal?'1':'0'}"></td>
        <td>${dispDate((m.data||'').slice(0,10))}</td>
        <td><span class="badge ${badge}">${fmtTipo(m.tipo)}${isLocal?'*':''}</span></td>
        <td>${money.format(numBRL(m.valor))}</td>
        <td>${metas.clean||''}</td>
        <td>${m.categoria||''}</td>
        <td>${metas.conta||''}</td>
        <td>${metas.status||''}</td>
        <td><button class="button danger btnDel" data-id="${m.id||''}" data-local="${isLocal?'1':'0'}"><i class="fas fa-trash"></i></button></td>`;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    const chks=qsa('.chkrow');
    const sa=EL.selectAll(), bi=EL.bulkInfo();
    if(sa) sa.onchange=()=>{ chks.forEach(c=>c.checked=sa.checked); if(bi) bi.textContent=`${chks.filter(c=>c.checked).length} selecionados`; };
    chks.forEach(c=>c.addEventListener('change',()=>{ if(bi) bi.textContent=`${qsa('.chkrow:checked').length} selecionados`; if(sa) sa.checked=chks.length&&chks.every(x=>x.checked); }));
  }

  // ------------------------- XML helpers -------------------------
  function xmlPickAll(xmlStr, localName){
    try{
      const dom = new DOMParser().parseFromString(xmlStr, 'application/xml');
      const arr = [...dom.getElementsByTagName(localName), ...dom.getElementsByTagNameNS('*', localName)]
        .map(el=>(el.textContent||'').trim()).filter(Boolean);
      if(arr.length) return arr;
    }catch{}
    const rx = new RegExp(`<(?:\\w+:)?${localName}[^>]*>([\\s\\S]*?)<\\/\\w*:?${localName}>`,'ig');
    const out=[]; let m; while((m=rx.exec(xmlStr))) out.push((m[1]||'').trim()); return out;
  }
  const xmlPick=(s,n)=>(xmlPickAll(s,n)[0]||'');
  function xmlInfNFeId(s){ try{ const dom=new DOMParser().parseFromString(s,'application/xml'); const inf=dom.getElementsByTagNameNS('*','infNFe')[0]||dom.getElementsByTagName('infNFe')[0]; let id=inf?.getAttribute('Id')||''; if(id&&/^NFe/i.test(id)) id=id.replace(/^NFe/i,''); return id; }catch{ return ''; } }

  // ----------------- Idempotência por XML -----------------
  const loadXmlCache=()=>{ try{ return new Set(JSON.parse(localStorage.getItem('nfe_imported_keys')||'[]')); }catch{return new Set();} };
  const saveXmlCache=(set)=>{ try{ localStorage.setItem('nfe_imported_keys', JSON.stringify(Array.from(set))); }catch{} };
  async function readKeysFromFiles(files){
    const out=[];
    for(const f of files){
      try{
        const s=await f.text();
        const ch=xmlPick(s,'chNFe')||xmlInfNFeId(s);
        const cnpjs=xmlPickAll(s,'CNPJ'); const cEmit=cnpjs[0]||'', cDest=cnpjs[1]||'';
        const serie=xmlPick(s,'serie')||xmlPick(s,'nSerie')||''; const nNF=xmlPick(s,'nNF')||'';
        const dh=xmlPick(s,'dhEmi')||xmlPick(s,'dEmi')||'';
        const key=ch||`${cEmit}-${cDest}-${serie}-${nNF}-${(dh||'').slice(0,10)}`.replace(/\s+/g,'');
        out.push({file:f, key});
      }catch{ out.push({file:f, key:null}); }
    } return out;
  }

  // ----------------- Classificação por XML -----------------
  function classificaTipo(xml){
    const tp=(xmlPick(xml,'tpNF')||'').trim();
    if(tp==='0'||tp==='00') return 'entrada';
    if(tp==='1'||tp==='01') return 'saida';
    const cfops=xmlPickAll(xml,'CFOP');
    if(cfops.length){ const lead=String(cfops[0]).trim()[0]; if('567'.includes(lead)) return 'saida'; if('123'.includes(lead)) return 'entrada'; }
    return 'entrada';
  }

  async function parseXmlFiles(files){
    const movs=[]; const avisos={semTpNF:0, semData:0, valorZero:0};
    for(const f of files){
      try{
        const xml=await f.text();
        const tipo=classificaTipo(xml); if(!xmlPick(xml,'tpNF')) avisos.semTpNF++;
        const dhEmi=xmlPick(xml,'dhEmi')||xmlPick(xml,'dEmi'); const dataISO=dhEmi?dhEmi.slice(0,10):toISO(new Date()); if(!dhEmi) avisos.semData++;
        let total=0; xmlPickAll(xml,'vProd').forEach(v=>total+=numBRL(v)); if(!total) total=numBRL(xmlPick(xml,'vNF')||xmlPick(xml,'vTotTrib')||'0'); if(!total) avisos.valorZero++;
        const nNF=xmlPick(xml,'nNF')||''; const chNFe=xmlPick(xml,'chNFe')||xmlInfNFeId(xml); const ref=chNFe||nNF;
        const categoria=(tipo==='entrada')?'Compra':'Venda'; const contaMeta=(tipo==='entrada')?'Banco PJ':'PIX';
        const descricao=`[@conta=${contaMeta}][@status=Realizado] NF-e${ref?` ${ref}`:''} - ${categoria}`;
        movs.push({ data:dataISO, tipo, valor:Number(total.toFixed(2)), descricao, categoria, ref });
      }catch(e){ console.warn('[parseXmlFiles] Ignorado', f?.name, e); }
    }
    return { movs, avisos };
  }

  // ----------------- Dedup (data|tipo|valor|ref) -----------------
  const refFromDesc=(s='')=>((s.match(/\b\d{8,44}\b/)||[])[0]||'');
  function dedupStrong(arr){
    const map=new Map();
    arr.forEach(m=>{ const v=Number(m.valor)||0; const ref=m.ref||refFromDesc(m.descricao||'')||''; const key=`${(m.data||'').slice(0,10)}|${fmtTipo(m.tipo)}|${v.toFixed(2)}|${ref}`; if(!map.has(key)) map.set(key,m); });
    return [...map.values()];
  }

  // ----------------- POST servidor (único) + fallback offline -----------------
  async function salvarMovServer(m){
    const fd=new FormData();
    fd.append('data', (m.data||'').slice(0,10));
    fd.append('tipo', fmtTipo(m.tipo));
    fd.append('valor', (Number(m.valor)||0).toFixed(2));
    fd.append('descricao', (m.descricao||'').trim());
    fd.append('categoria', m.categoria || '');
    fd.append('csrfmiddlewaretoken', getCSRF());
    try{
      const resp = await fetch('/fluxo_caixa/adicionar/', { method:'POST', headers:{...XHR_HEADER,'X-CSRFToken':getCSRF()}, body: fd, ...CRED });
      return resp.ok;
    }catch{ return false; }
  }

  // ----------------- Importação (delegada) -----------------
  function clickImportArquivos(ev){
    const filesInput = EL.inpFiles(); const dirInput = EL.inpDir();
    if(!filesInput || !dirInput) ensureHiddenInputs();
    if(ev && (ev.shiftKey||ev.altKey)){ // fallback pasta
      if(dirInput) dirInput.click();
      else { const i=EL.inpFiles(); i.setAttribute('webkitdirectory',''); i.setAttribute('directory',''); i.click(); i.removeAttribute('webkitdirectory'); i.removeAttribute('directory'); }
    } else {
      const i=EL.inpFiles(); if(i){ i.removeAttribute('webkitdirectory'); i.removeAttribute('directory'); i.click(); }
    }
  }
  function clickImportPasta(){
    const dirInput = EL.inpDir();
    if(dirInput) dirInput.click();
    else { const i=EL.inpFiles(); i.setAttribute('webkitdirectory',''); i.setAttribute('directory',''); i.click(); i.removeAttribute('webkitdirectory'); i.removeAttribute('directory'); }
  }

  async function handleFiles(fileList){
    const files=Array.from(fileList||[]).filter(f=>/\.xml$/i.test(f.name)); if(!files.length) return;

    // cache local (idempotência)
    const cache=loadXmlCache(); const keys=await readKeysFromFiles(files);
    const dups=keys.filter(k=>!k.key||cache.has(k.key));
    let processarTodos=true;
    if(dups.length) processarTodos=confirm(`Foram detectados ${dups.length} XML(s) já importados.\nDeseja REPROCESSÁ-LOS?`);
    let filesToUse=files;
    if(!processarTodos){ const allowed=new Set(keys.filter(k=>k.key&&!cache.has(k.key)).map(k=>k.file.name)); filesToUse=files.filter(f=>allowed.has(f.name)); }
    if(!filesToUse.length){ clearInputs(); return; }

    // 1) NF-e (estoque + financeiro centralizado no app nfe)
    try{
      const fd=new FormData();
      filesToUse.forEach(f=>{
        fd.append('xmlfile', f, f.name);
        fd.append('xmlfile[]', f, f.name);
      });
      await fetch('/nfe/importar_xml/', {
        method:'POST',
        body: fd,
        headers:{...XHR_HEADER,'X-CSRFToken':getCSRF()},
        ...CRED
      }).catch(()=>{});
    }catch{}

    // 2) Parser do front
    const { movs:fallbackMovs, avisos } = await parseXmlFiles(filesToUse);

    // 3) Dedup contra o Caixa existente
    const assinaturas = await fetchAssinaturasCaixa();
    const strongKey = (m) => {
      const v=Number(m.valor)||0; const ref=m.ref||refFromDesc(m.descricao||'')||'';
      return `${(m.data||'').slice(0,10)}|${fmtTipo(m.tipo)}|${v.toFixed(2)}|${ref}`;
    };
    let movs = dedupStrong(fallbackMovs).filter(m=>!assinaturas.has(strongKey(m)));

    // 4) Salvar (server ou offline)
    let ent=0, sai=0, pend=0, ignored=0; const usedDates=[];
    for(const m of movs){
      const v=Number(m.valor)||0; if(!m.data || v<=0){ ignored++; continue; }
      const ok = await salvarMovServer(m);
      if(!ok){ offAdd(m); pend++; }
      else { if(fmtTipo(m.tipo)==='entrada') ent++; else sai++; usedDates.push(m.data); }
    }

    // 5) Atualiza cache de XMLs
    const nset=loadXmlCache(); keys.forEach(k=>k.key&&nset.add(k.key)); saveXmlCache(nset);

    // 6) Ajusta período ao min→max (dos salvos no server)
    const allDates=usedDates.sort(); if(allDates.length && EL.periodo()&&EL.inicio()&&EL.fim()){ EL.periodo().value='custom'; EL.inicio().value=allDates[0]; EL.fim().value=allDates[allDates.length-1]; applyPeriodoVisibility(); }

    clearInputs(); await listar();

    // 7) Feedback + notifica áreas
    const msg=[
      `Importação: ${ent} entrada(s), ${sai} saída(s)`,
      'Classificação por XML (tpNF/CFOP) aplicada.',
      pend ? `Pendentes (offline): ${pend}` : null,
      (avisos.semTpNF?`XML(s) sem tpNF: ${avisos.semTpNF}`:null),
      (avisos.semData?`XML(s) sem data: ${avisos.semData}`:null),
      (avisos.valorZero?`XML(s) com valor 0: ${avisos.valorZero}`:null),
      (ignored?`Ignorados: ${ignored}`:null)
    ].filter(Boolean).join(' • ');
    Toasts.show(msg, pend?'error':'success', 6500);

    safeDispatch('crv-areas-dirty',{areas:['estoque','financeiro','dashboard']});
  }

  function clearInputs(){ if(EL.inpFiles()) EL.inpFiles().value=''; if(EL.inpDir()) EL.inpDir().value=''; }

  // ----- Lançamento manual (usa server; se cair, guarda offline)
  async function salvarLancamentoManual(ev){
    ev.preventDefault();
    const dataISO=parseBRDate(EL.fData()?.value||toISO(new Date()));
    const tipo=fmtTipo(EL.fTipo()?.value||'saida');
    const valor=numBRL(EL.fValor()?.value);
    let desc=(EL.fDescricao()?.value||'').trim(); const categoria=EL.fCategoria()?.value||''; const obs=EL.fObservacao()?.value||'';
    if(EL.fConta()?.value) desc=`[@conta=${EL.fConta().value}] ${desc}`.trim();
    if(EL.fStatus()?.value) desc=`[@status=${EL.fStatus().value}] ${desc}`.trim();
    if(!dataISO||!valor||valor<=0) return;

    const m={data:dataISO,tipo,valor,descricao:desc,categoria,observacao:obs};
    const ok=await salvarMovServer(m);
    if(!ok){ offAdd(m); Toasts.show('Sem conexão com o Caixa: lançamento salvo offline.', 'error'); }
    else   { Toasts.show('Lançamento salvo.', 'success'); }
    listar();
    safeDispatch('crv-areas-dirty',{areas:['financeiro','dashboard']});
  }

  // ----- Eventos DELEGADOS (nunca morrem)
  function bindDelegated(){
    const rt = root(); if(!rt) return;

    // clicks
    rt.addEventListener('click', (ev)=>{
      const t = ev.target;
      if(!t) return;

      // Importar XML(s)
      const b1 = t.closest && t.closest('#btnImportarNFe');
      if(b1){ ev.preventDefault(); ensureHiddenInputs(); clickImportArquivos(ev); return; }

      // Importar Pasta
      const b2 = t.closest && t.closest('#btnImportarNFePasta');
      if(b2){ ev.preventDefault(); ensureHiddenInputs(); clickImportPasta(); return; }

      // Buscar (aplica filtros)
      const b3 = t.closest && t.closest('#btnAplicarFiltros');
      if(b3){ ev.preventDefault(); applyPeriodoVisibility(); listar(); return; }

      // Salvar manual
      const b4 = t.closest && t.closest('#btnSalvar');
      if(b4){ salvarLancamentoManual(ev); return; }

// Excluir selecionados (versão corrigida)
const b5 = t.closest && t.closest('#btnExcluirSelecionados');
if (b5) {
  ev.preventDefault();
  const chks = qsa('.chkrow:checked');
  const ids = chks.map(c => c.dataset.id).filter(Boolean);
  if (!ids.length) {
    Toasts.show('Nenhum item selecionado.', 'error');
    return;
  }
  if (!confirm(`Excluir ${ids.length} movimentação(ões) selecionada(s)?`)) return;

  (async () => {
    const resp = await fetch('/fluxo_caixa/remover_selecionados/', {
      method: 'POST',
      headers: { ...XHR_HEADER, 'X-CSRFToken': getCSRF(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      ...CRED
    });

    const data = await resp.json();
    if (data.success) {
      await listar(); // <-- força atualização total
      Toasts.show('Movimentações removidas.', 'success');
      safeDispatch('crv-areas-dirty', { areas: ['financeiro', 'dashboard'] });
    } else {
      Toasts.show('Erro ao remover movimentações.', 'error');
    }

    // limpar seleção
    qsa('.chkrow:checked').forEach(c => c.checked = false);
    const bi = qs('#bulkInfo');
    if (bi) bi.textContent = '0 selecionados';
    const sa = EL.selectAll();
    if (sa) sa.checked = false;
  })();

  return;
}


      // Excluir individual (delegado)
      const bDel = t.closest && t.closest('.btnDel');
      if(bDel){
        const id=bDel.dataset.id||''; const isLocal = bDel.dataset.local==='1';
        if(!confirm('Deseja excluir este lançamento?')) return;
        (async ()=>{
          if(isLocal){ offRemoveById(id); }
          else { await fetch(`/fluxo_caixa/remover/${id}/`,{method:'POST',headers:{...XHR_HEADER,'X-CSRFToken':getCSRF()},...CRED}); }
          listar(); Toasts.show('Movimentação removida.','success');
          safeDispatch('crv-areas-dirty',{areas:['financeiro','dashboard']});
        })();
        return;
      }
    });

    // changes (filtros e inputs de arquivo)
    rt.addEventListener('change', (ev)=>{
      const id = ev.target && ev.target.id;
      if(['filtroPeriodo','filtroTipo','filtroConta','filtroStatus','filtroData','filtroInicio','filtroFim'].includes(id)){
        applyPeriodoVisibility(); listar(); return;
      }
      if(id==='inputXmlNFe' || id==='inputXmlNFePasta'){
        handleFiles(ev.target.files); return;
      }
    });
  }

  // ----------------- POST servidor helper -----------------
  async function salvarMov(m){
    const ok = await salvarMovServer(m);
    if(ok) return true;
    offAdd(m);
    return true;
  }

  // ----------------- Eventos cross-telas -----------------
  function safeDispatch(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

  // ----------------- Init -----------------
  ensureHiddenInputs();
  bindDelegated();
  applyPeriodoVisibility();
  listar();

  // Rebind após cada injeção SPA
  document.addEventListener('spa-page-loaded', ()=>{
    const rt = root(); if(!rt) return;
    ensureHiddenInputs();
    applyPeriodoVisibility();
    bindDelegated(); // idempotente: listeners são no mesmo container; o browser evita duplicatas por referência de função, mas mantemos simples
    listar();
  });

  new MutationObserver(()=>{}).observe(document.documentElement,{childList:true,subtree:true});
})();
