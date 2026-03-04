// static/js/pdv.js
console.log('--- pdv.js carregado ---');

window.inicializarPDVSPA = function () {
  const root = document.getElementById('card-pdv');
  if (!root) return;

  // ---- Elementos ----
  const elCodigo    = root.querySelector('#pdvCodigo');
  const elQtd       = root.querySelector('#pdvQtd');
  const elRows      = root.querySelector('#pdvRows');

  const elSubtotal  = root.querySelector('#pdvSubtotal');
  const elDesconto  = root.querySelector('#pdvDesconto');
  const elTotal     = root.querySelector('#pdvTotal');
  const elRecebido  = root.querySelector('#pdvRecebido');
  const elTroco     = root.querySelector('#pdvTroco');

  const btnNova         = root.querySelector('#pdvBtnNovaVenda');
  const btnCancelarItem = root.querySelector('#pdvBtnCancelarItem');
  const btnFinalizar    = root.querySelector('#pdvBtnFinalizar');

  // Fechar card (mesmo padrão do estoque)
  const btnFechar = document.getElementById('btn-fechar-pdv');
  if (btnFechar) {
    btnFechar.onclick = function () {
      carregarTela('/dashboard/inicial/');
    };
  }

  // ---- Estado ----
  const itens = [];

  // ---- Helpers ----
  function moedaBR(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function recalc() {
    const subtotal = itens.reduce((acc, it) => acc + it.qtd * it.vu, 0);
    const desconto = parseFloat(elDesconto.value || 0);
    const total    = Math.max(subtotal - desconto, 0);
    const recebido = parseFloat(elRecebido.value || 0);
    const troco    = Math.max(recebido - total, 0);

    elSubtotal.textContent = moedaBR(subtotal);
    elTotal.textContent    = moedaBR(total);
    elTroco.textContent    = moedaBR(troco);
  }
  function render() {
    elRows.innerHTML = '';
    itens.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'pdv-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '80px 140px 1.8fr 110px 120px 140px 120px';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      row.style.padding = '10px 8px';
      row.style.borderBottom = '1px solid rgba(255,255,255,.06)';
      row.innerHTML = `
        <div class="c-num">${i + 1}</div>
        <div class="c-cod">${it.codigo}</div>
        <div class="c-desc">${it.desc}</div>
        <div class="c-qtd">${it.qtd}</div>
        <div class="c-vu">${moedaBR(it.vu)}</div>
        <div class="c-total">${moedaBR(it.qtd * it.vu)}</div>
        <div class="c-acoes"><a href="#" data-remove="${i}" class="action-link">remover</a></div>
      `;
      elRows.appendChild(row);
    });
    recalc();
  }
  function addItem(codigo, qtd) {
    // MVP: mock – depois integrar com backend
    const precoFake = 9.90;
    const descFake  = 'Produto ' + codigo;
    itens.push({ codigo, desc: descFake, qtd, vu: precoFake });
    render();
  }
  function novaVenda() {
    itens.splice(0, itens.length);
    elCodigo.value   = '';
    elQtd.value      = '1';
    elDesconto.value = '0';
    elRecebido.value = '0';
    render();
    elCodigo.focus();
  }

  // ---- Binds ----
  elCodigo && elCodigo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codigo = (elCodigo.value || '').trim();
      const qtd = Math.max(parseInt(elQtd.value || '1', 10), 1);
      if (!codigo) return;
      addItem(codigo, qtd);
      elCodigo.value = '';
      elQtd.value = '1';
    }
  });

  elRows && elRows.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-remove]');
    if (a) {
      e.preventDefault();
      const idx = parseInt(a.getAttribute('data-remove'), 10);
      if (!isNaN(idx)) {
        itens.splice(idx, 1);
        render();
      }
    }
  });

  [elDesconto, elRecebido].forEach(el => el && el.addEventListener('input', recalc));

  btnNova && btnNova.addEventListener('click', novaVenda);

  btnCancelarItem && btnCancelarItem.addEventListener('click', () => {
    itens.pop();
    render();
  });

  btnFinalizar && btnFinalizar.addEventListener('click', () => {
    if (itens.length === 0) {
      alert('Nenhum item na venda.');
      return;
    }
    alert('Venda finalizada (MVP). Integração com backend vem na próxima etapa.');
    novaVenda();
  });

  // ---- Atalhos (sem F5) ----
  if (window.__pdvKeyHandler) {
    window.removeEventListener('keydown', window.__pdvKeyHandler);
  }
  window.__pdvKeyHandler = (e) => {
    const hasMod = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    if (hasMod) return; // Ctrl+F5 continua recarregando (cache bust)
    if (e.key === 'F3') { e.preventDefault(); btnCancelarItem && btnCancelarItem.click(); }
    else if (e.key === 'F6') { e.preventDefault(); btnNova && btnNova.click(); }
    else if (e.key === 'F9') { e.preventDefault(); btnFinalizar && btnFinalizar.click(); }
  };
  window.addEventListener('keydown', window.__pdvKeyHandler);

  // Carrega estado inicial
  novaVenda();
};

// Reexecuta a inicialização quando o SPA carregar a tela (mesmo padrão do estoque)
window.addEventListener('spa-page-loaded', function() {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/caixa')) {
    if (typeof window.inicializarPDVSPA === 'function') {
      window.inicializarPDVSPA();
    }
  }
});
