// CRV Systems – Clientes/Fornecedores (SPA-safe)

(function(){
  if (window.__cadastroDocBound) return;
  window.__cadastroDocBound = true;

  // helpers
  function getCSRFCookie(name="csrftoken"){
    return document.cookie.split(";").map(c=>c.trim()).find(c=>c.startsWith(name+"="))?.split("=")[1] || "";
  }
  function ajax(url, opts={}, onOk){
    opts.headers = opts.headers || {};
    opts.headers["X-Requested-With"] = "XMLHttpRequest";
    if (!(opts.body instanceof FormData)) opts.headers["Content-Type"] = opts.headers["Content-Type"] || "application/json";
    if (["POST","PUT","DELETE"].includes((opts.method||"").toUpperCase())){
      const t = getCSRFCookie(); if (t) opts.headers["X-CSRFToken"] = t;
    }
    fetch(url, opts).then(r=>{
      const ct = r.headers.get("content-type")||"";
      if (r.status===204) return null;
      if (ct.includes("application/json")) return r.json();
      return r.text().then(html=>({html}));
    }).then(d=> onOk && onOk(d)).catch(err=>{ console.error(err); alert("Falha na comunicação."); });
  }

  // mascaras + busca
  document.addEventListener("input", function(e){
    const el = e.target, n = el && el.name; if(!el) return;
    const digits = v=>v.replace(/\D/g,""); const set=v=>el.value=v;

    if(n==="cpf"){ let v = digits(el.value).replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3}\.\d{3})(\d)/,"$1.$2").replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/,"$1-$2").replace(/(-\d{2})\d+?$/,"$1"); set(v); }
    if(n==="cnpj"){ let v = digits(el.value).replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/,"$1/$2").replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/,"$1-$2").replace(/(-\d{2})\d+?$/,"$1"); set(v); }
    if(n==="rg"){  let v = digits(el.value).replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/,"$1-$2").replace(/(-\d{1})\d+?$/,"$1"); set(v); }
    if(n==="inscricao_estadual"){ let v = digits(el.value).replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3})(\d)/,"$1.$2").replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/,"$1/$2").replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{3})(\d)/,"$1-$2").replace(/(-\d{3})\d+?$/,"$1"); set(v); }
    if(n==="telefone"){ let v = digits(el.value); if(v.length>10) v=v.replace(/^(\d{2})(\d{5})(\d{4}).*/,"($1) $2-$3"); else v=v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/,"($1) $2-$3"); set(v); }
    if(n==="cep"){ let v = digits(el.value).replace(/^(\d{5})(\d)/,"$1-$2").replace(/(-\d{3})\d+?$/,"$1"); set(v); }

    if(el.matches("#busca-clientes")){
      const t = el.value.toLowerCase();
      document.querySelectorAll("#tbody-clientes tr.cliente-row").forEach(tr=>{
        tr.style.display = (!t || tr.textContent.toLowerCase().includes(t)) ? "" : "none";
      });
    }
    if(el.matches("#busca-fornecedores")){
      const t = el.value.toLowerCase();
      document.querySelectorAll("#tbody-fornecedores tr.fornecedor-row").forEach(tr=>{
        tr.style.display = (!t || tr.textContent.toLowerCase().includes(t)) ? "" : "none";
      });
    }
  });

  // util: revelação progressiva (ouve input e change)
  function setupReveal(container, revealAll=false){
    const steps = Array.from(container.querySelectorAll(".step"));
    steps.forEach((s,i)=>{
      s.classList.toggle("step-show", revealAll ? true : i===0);
      s.classList.toggle("step-hidden", revealAll ? false : i!==0);
    });
    if (revealAll) return;
    steps.forEach((step,i)=>{
      const field = step.querySelector("input,select,textarea"); if(!field) return;
      const go = ()=>{ if(field.value && steps[i+1]){ steps[i+1].classList.remove("step-hidden"); steps[i+1].classList.add("step-show"); } };
      field.addEventListener("input", go);
      field.addEventListener("change", go);
    });
  }
  function setSaveEnabled(formSel, btnSel){
    const f = document.querySelector(formSel), b = document.querySelector(btnSel);
    if(!f || !b) return; const update=()=> b.disabled = !f.checkValidity();
    f.addEventListener("input", update); f.addEventListener("change", update); update();
  }

  // limita wrapper a 5 linhas
  function limitRows(wrapperSel, tableSel, rows){
    const wrapper = document.querySelector(wrapperSel);
    const table = document.querySelector(tableSel);
    if(!wrapper || !table) return;
    const headH = table.tHead ? table.tHead.getBoundingClientRect().height : 40;
    const first = table.tBodies[0]?.querySelector("tr:not(.empty-row)");
    const rowH = first ? first.getBoundingClientRect().height : 48;
    wrapper.style.maxHeight = Math.round(headH + rowH * rows) + "px";
    wrapper.style.overflowY = "auto";
  }

  function bindTela(){
    const temTela = document.getElementById("tbody-clientes") || document.getElementById("tbody-fornecedores");
    if(!temTela) return;

    // limita listas
    limitRows(".clientes-scroll", "#tabela-clientes", 5);
    limitRows(".fornecedores-scroll", "#tabela-fornecedores", 5);
    window.addEventListener("resize", ()=>{ limitRows(".clientes-scroll","#tabela-clientes",5); limitRows(".fornecedores-scroll","#tabela-fornecedores",5); }, {passive:true});

    // abrir "Novo"
    document.querySelector(".btn-novo-cliente")?.addEventListener("click", ()=>{
      const f = document.getElementById("formNovoCliente"); f && f.reset();
      document.getElementById("titulo-modal-cliente").innerHTML = '<i class="fas fa-user-plus"></i><span>Novo Cliente</span>';
      setupReveal(f.querySelector(".modal-grid-form"), false);
      document.getElementById("modalNovoCliente").style.display="flex";
      setSaveEnabled("#formNovoCliente","#btnSalvarCliente");
    });
    document.querySelector(".btn-novo-fornecedor")?.addEventListener("click", ()=>{
      const f = document.getElementById("formNovoFornecedor"); f && f.reset();
      document.getElementById("titulo-modal-fornecedor").innerHTML = '<i class="fas fa-truck-loading"></i><span>Novo Fornecedor</span>';
      setupReveal(f.querySelector(".modal-grid-form"), false);
      document.getElementById("modalNovoFornecedor").style.display="flex";
      setSaveEnabled("#formNovoFornecedor","#btnSalvarFornecedor");
    });

    // fechar modais (X, botão, fundo)
    document.querySelectorAll(".btn-fechar-modal").forEach(b=> b.addEventListener("click", ()=> {
      b.closest(".modal").style.display="none";
    }));
    document.querySelectorAll("#modalNovoCliente, #modalNovoFornecedor, #modalViewCliente, #modalViewFornecedor").forEach(m=>{
      m.addEventListener("click", e=>{ if(e.target===m) m.style.display="none"; });
    });
    document.querySelector(".btn-cancelar-novo-cliente")?.addEventListener("click", ()=> document.getElementById("modalNovoCliente").style.display="none");
    document.querySelector(".btn-cancelar-novo-fornecedor")?.addEventListener("click", ()=> document.getElementById("modalNovoFornecedor").style.display="none");

    // Visualização
    const openViewCliente = (id)=>{
      ajax(`/cadastro/clientes/${id}/detalhes/`, {method:"GET"}, (j)=>{
        const d = j?.dados || {};
        const map = {
          "view-cliente-nome": d.nome, "view-cliente-cpf": d.cpf || "—",
          "view-cliente-rg": d.rg || "—",
          "view-cliente-nasc": (function(n){ if(!n) return "—"; if(/^\d{4}-\d{2}-\d{2}/.test(n)){ const [y,m,dd]=n.split("T")[0].split("-"); return `${dd}/${m}/${y}`;} return n; })(d.data_nascimento),
          "view-cliente-tel": d.telefone || "—", "view-cliente-email": d.email || "—",
          "view-cliente-cep": d.cep || "—", "view-cliente-end": d.endereco || "—",
          "view-cliente-cid": d.cidade || "—", "view-cliente-uf": d.uf || "—"
        };
        Object.entries(map).forEach(([id,val])=>{ const el=document.getElementById(id); if(el) el.textContent = val; });
        document.getElementById("modalViewCliente").style.display="flex";
      });
    };
    const openViewFornecedor = (id)=>{
      ajax(`/cadastro/fornecedores/${id}/detalhes/`, {method:"GET"}, (j)=>{
        const d = j?.dados || {};
        const map = {
          "view-fornecedor-nome": d.nome, "view-fornecedor-cnpj": d.cnpj || "—",
          "view-fornecedor-ie": d.inscricao_estadual || "—", "view-fornecedor-rep": d.representante || "—",
          "view-fornecedor-tel": d.telefone || "—", "view-fornecedor-email": d.email || "—",
          "view-fornecedor-cep": d.cep || "—", "view-fornecedor-end": d.endereco || "—",
          "view-fornecedor-cid": d.cidade || "—", "view-fornecedor-uf": d.uf || "—"
        };
        Object.entries(map).forEach(([id,val])=>{ const el=document.getElementById(id); if(el) el.textContent = val; });
        document.getElementById("modalViewFornecedor").style.display="flex";
      });
    };

    // delegação Clientes
    const tbC = document.getElementById("tbody-clientes");
    if (tbC){
      tbC.onclick = null;
      tbC.addEventListener("click", function(e){
        const tr = e.target.closest("tr.cliente-row"); if(!tr) return;
        const id = tr.dataset.id;

        if (e.target.classList.contains("btn-editar-cliente")){
          e.stopPropagation();
          ajax(`/cadastro/clientes/${id}/detalhes/`, {method:"GET"}, (j)=>{
            const d = j?.dados || {};
            const f = document.getElementById("formNovoCliente"); if(!f) return;
            f.reset();
            f.nome.value = d.nome || "";
            f.cpf.value  = d.cpf || "";
            f.rg.value   = d.rg || "";
            f.data_nascimento.value = (function(n){ if(!n) return ""; if(/^\d{2}\/\d{2}\/\d{4}$/.test(n)){ const [dd,mm,yy]=n.split("/"); return `${yy}-${mm}-${dd}` } return n; })(d.data_nascimento);
            f.telefone.value = d.telefone || "";
            f.email.value    = d.email || "";
            f.cep.value      = d.cep || "";
            f.endereco.value = d.endereco || "";
            f.cidade.value   = d.cidade || "";
            if (f.uf) f.uf.value = d.uf || "";

            document.getElementById("titulo-modal-cliente").innerHTML = '<i class="fas fa-user-edit"></i><span>Editar Cliente</span>';
            setupReveal(f.querySelector(".modal-grid-form"), true);
            document.getElementById("modalNovoCliente").style.display="flex";
            setSaveEnabled("#formNovoCliente","#btnSalvarCliente");
            window.__editingClienteId = id;
          });
          return;
        }
        if (e.target.classList.contains("btn-deletar-cliente")){
          e.stopPropagation();
          if(!confirm("Excluir este cliente?")) return;
          ajax(`/cadastro/clientes/${id}/excluir/`, {method:"DELETE"}, ()=> tr.remove());
          return;
        }
        openViewCliente(id);
      });
    }

    // delegação Fornecedores
    const tbF = document.getElementById("tbody-fornecedores");
    if (tbF){
      tbF.onclick = null;
      tbF.addEventListener("click", function(e){
        const tr = e.target.closest("tr.fornecedor-row"); if(!tr) return;
        const id = tr.dataset.id;

        if (e.target.classList.contains("btn-editar-fornecedor")){
          e.stopPropagation();
          ajax(`/cadastro/fornecedores/${id}/detalhes/`, {method:"GET"}, (j)=>{
            const d = j?.dados || {};
            const f = document.getElementById("formNovoFornecedor"); if(!f) return;
            f.reset();
            f.nome.value  = d.nome || "";
            f.cnpj.value  = d.cnpj || "";
            f.inscricao_estadual.value = d.inscricao_estadual || "";
            f.representante.value      = d.representante || "";
            f.telefone.value           = d.telefone || "";
            f.email.value              = d.email || "";
            f.cep.value                = d.cep || "";
            f.endereco.value           = d.endereco || "";
            f.cidade.value             = d.cidade || "";
            if (f.uf) f.uf.value       = d.uf || "";

            document.getElementById("titulo-modal-fornecedor").innerHTML = '<i class="fas fa-user-cog"></i><span>Editar Fornecedor</span>';
            setupReveal(f.querySelector(".modal-grid-form"), true);
            document.getElementById("modalNovoFornecedor").style.display="flex";
            setSaveEnabled("#formNovoFornecedor","#btnSalvarFornecedor");
            window.__editingFornecedorId = id;
          });
          return;
        }
        if (e.target.classList.contains("btn-deletar-fornecedor")){
          e.stopPropagation();
          if(!confirm("Excluir este fornecedor?")) return;
          ajax(`/cadastro/fornecedores/${id}/excluir/`, {method:"DELETE"}, ()=> tr.remove());
          return;
        }
        openViewFornecedor(id);
      });
    }

    // SUBMITS
    const formC = document.getElementById("formNovoCliente");
    formC?.addEventListener("submit", function(e){
      e.preventDefault();
      const fd = new FormData(formC);
      const editId = window.__editingClienteId;
      const url = editId ? `/cadastro/clientes/${editId}/editar/` : "/cadastro/clientes/novo/";
      ajax(url, {method:"POST", body:fd}, (j)=>{
        document.getElementById("modalNovoCliente").style.display="none";
        window.__editingClienteId = null;
        if(j && j.id && !editId){
          const tr = document.createElement("tr");
          tr.className="cliente-row"; tr.dataset.id=j.id;
          tr.innerHTML = `<td>${fd.get("nome")||""}</td><td>${fd.get("email")||""}</td><td>${fd.get("telefone")||""}</td><td>${fd.get("cidade")||""}</td>
            <td><a class="acao-link editar btn-editar-cliente" data-id="${j.id}">Editar</a><a class="acao-link excluir btn-deletar-cliente" data-id="${j.id}">Excluir</a></td>`;
          document.getElementById("tbody-clientes").appendChild(tr);
        }
      });
    });

    const formF = document.getElementById("formNovoFornecedor");
    formF?.addEventListener("submit", function(e){
      e.preventDefault();
      const fd = new FormData(formF);
      const editId = window.__editingFornecedorId;
      const url = editId ? `/cadastro/fornecedores/${editId}/editar/` : "/cadastro/fornecedores/novo/";
      ajax(url, {method:"POST", body:fd}, (j)=>{
        document.getElementById("modalNovoFornecedor").style.display="none";
        window.__editingFornecedorId = null;
        if(j && j.id && !editId){
          const tr = document.createElement("tr");
          tr.className="fornecedor-row"; tr.dataset.id=j.id;
          tr.innerHTML = `<td>${fd.get("nome")||""}</td><td>${fd.get("email")||""}</td><td>${fd.get("telefone")||""}</td><td>${fd.get("cidade")||""}</td>
            <td><a class="acao-link editar btn-editar-fornecedor" data-id="${j.id}">Editar</a><a class="acao-link excluir btn-deletar-fornecedor" data-id="${j.id}">Excluir</a></td>`;
          document.getElementById("tbody-fornecedores").appendChild(tr);
        }
      });
    });
  }

  window.inicializarCadastroSPA = function(){ bindTela(); };
  document.addEventListener("DOMContentLoaded", ()=>{ if(document.getElementById("tbody-clientes")||document.getElementById("tbody-fornecedores")) bindTela(); });
  document.addEventListener("spa-page-loaded", ()=>{ if(document.getElementById("tbody-clientes")||document.getElementById("tbody-fornecedores")) bindTela(); });
})();
