(function(){ if(window.__ESTOQUE_JS_PATCHED__) return; window.__ESTOQUE_JS_PATCHED__=true;
// static/js/estoque.js

console.log('--- estoque.js carregado ---');

// -------------------- Helpers AJAX (padrão SPA) --------------------
const AJAX_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json'
};

function withSlash(url) {
  if (url.includes('?')) {
    const [base, qs] = url.split('?');
    return (base.endsWith('/') ? base : base + '/') + '?' + qs;
  }
  return url.endsWith('/') ? url : url + '/';
}

async function parseJSONOrThrow(resp) {
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    console.error('HTTP', resp.status, txt.slice(0, 200));
    throw new Error(`HTTP ${resp.status}`);
  }
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await resp.text().catch(() => '');
    console.error('Esperava JSON, recebi:', txt.slice(0, 200));
    throw new Error('Resposta não-JSON');
  }
  return resp.json();
}

function getCookie(name) {
  let value = null;
  document.cookie.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k === name) value = decodeURIComponent(v);
  });
  return value;
}

// -------------------- Inicialização SPA --------------------
window.inicializarEstoqueSPA = function () {
  const btnFechar = document.getElementById('btn-fechar-estoque');
  if (btnFechar) {
    btnFechar.onclick = () => carregarTela('/dashboard/inicial/');
  }

  const formFiltro = document.getElementById('filtro-estoque-form');
  if (formFiltro) {
    formFiltro.onsubmit = (e) => {
      e.preventDefault();
      carregarEstoque();
    };
  }

  // Modal novo produto
  const abrirNovo = document.getElementById('btn-add-produto');
  if (abrirNovo) {
    abrirNovo.onclick = () => {
      document.getElementById('modalAddProduto').style.display = 'flex';
    };
  }

  const fecharModalProduto = () => {
    document.getElementById('modalAddProduto').style.display = 'none';

    const form = document.getElementById('form-adicionar-produto');
    if (form) form.reset();

    const erroDiv = document.getElementById('erro-adicionar-produto');
    if (erroDiv) erroDiv.textContent = '';
  };

  const btnFecharModal = document.getElementById('btn-fechar-modal-produto');
  if (btnFecharModal) btnFecharModal.onclick = fecharModalProduto;

  const btnCancelarModal = document.getElementById('cancelar-modal-produto');
  if (btnCancelarModal) btnCancelarModal.onclick = fecharModalProduto;

  // Submeter novo produto
  const formAdicionar = document.getElementById('form-adicionar-produto');
  if (formAdicionar) {
    formAdicionar.onsubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(formAdicionar);

      fetch(withSlash('/estoque/adicionar'), {
        method: 'POST',
        headers: {
          ...AJAX_HEADERS,
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: formData,
        credentials: 'same-origin'
      })
        .then(parseJSONOrThrow)
        .then(data => {
          if (data.success) {
            fecharModalProduto();
            carregarEstoque();
            // >>> avisa o dashboard para recarregar KPIs
            window.dispatchEvent(new CustomEvent('spa-kpis-dirty', { detail: { modules: ['estoque','dashboard'] }}));
          } else {
            const erros = Object.values(data.errors || {}).flat().join(', ');
            const erroDiv = document.getElementById('erro-adicionar-produto');
            if (erroDiv) {
              erroDiv.textContent = erros || 'Erro ao adicionar produto.';
            }
          }
        })
        .catch(err => {
          console.error(err);
          const erroDiv = document.getElementById('erro-adicionar-produto');
          if (erroDiv) {
            erroDiv.textContent = 'Erro ao adicionar produto.';
          }
        });
    };
  }

  // Importar XML(s)
  const btnImportarXML = document.getElementById('btn-importar-xml');
  const inputImportarXML = document.getElementById('inputImportarXML');
  if (btnImportarXML && inputImportarXML) {
    btnImportarXML.onclick = () => {
      try {
        if (typeof inputImportarXML.showPicker === 'function') inputImportarXML.showPicker();
        else inputImportarXML.click();
      } catch {
        inputImportarXML.click();
      }
    };

    inputImportarXML.onchange = (e) => importarXML(e.target.files);
  }

  // Importar pasta
  const btnImportarPasta = document.getElementById('btn-importar-pasta');
  const inputImportarPasta = document.getElementById('inputImportarPastaXML');
  if (btnImportarPasta && inputImportarPasta) {
    btnImportarPasta.onclick = () => {
      try {
        if (typeof inputImportarPasta.showPicker === 'function') inputImportarPasta.showPicker();
        else inputImportarPasta.click();
      } catch {
        inputImportarPasta.click();
      }
    };

    inputImportarPasta.onchange = (e) => importarXML(e.target.files, true);
  }

  const btnAtualizar = document.getElementById('btn-atualizar-estoque');
  if (btnAtualizar) btnAtualizar.onclick = carregarEstoque;

  const btnFecharRemover = document.getElementById('btn-fechar-modal-remover');
  if (btnFecharRemover) {
    btnFecharRemover.onclick = () => {
      document.getElementById('modal-remover-produto').style.display = 'none';
    };
  }

  const btnCancelarRemover = document.getElementById('cancelar-remover-produto');
  if (btnCancelarRemover) {
    btnCancelarRemover.onclick = () => {
      document.getElementById('modal-remover-produto').style.display = 'none';
    };
  }

  const btnConfirmarRemover = document.getElementById('confirmar-remover-produto');
  if (btnConfirmarRemover) {
    btnConfirmarRemover.onclick = () => {
      document.getElementById('modal-remover-produto').style.display = 'none';
      carregarEstoque();
      // >>> avisa o dashboard após remoção em massa
      window.dispatchEvent(new CustomEvent('spa-kpis-dirty', { detail: { modules: ['estoque','dashboard'] }}));
    };
  }

  // Carregar lista
  carregarEstoque();
};

// -------------------- Funções principais --------------------
function carregarEstoque() {
  const form = document.getElementById('filtro-estoque-form');
  if (!form) return;

  const paramsArr = [];
  Array.from(form.elements)
    .filter(el => el.name && el.name.startsWith('busca_') && el.value)
    .forEach(el => paramsArr.push(`${encodeURIComponent(el.name)}=${encodeURIComponent(el.value)}`));

  let url = withSlash('/estoque/listar');
  if (paramsArr.length) url += `?${paramsArr.join('&')}`;

  const ul = document.getElementById('estoque-ul');
  const loading = document.getElementById('estoque-loading');
  const vazio = document.getElementById('estoque-vazio');

  ul.innerHTML = '';
  vazio.style.display = 'none';
  loading.style.display = 'block';

  fetch(url, { headers: AJAX_HEADERS, credentials: 'same-origin' })
    .then(parseJSONOrThrow)
    .then(data => {
      loading.style.display = 'none';

      if (!data || !Array.isArray(data.produtos) || !data.produtos.length) {
        vazio.style.display = 'block';
      } else {
        ul.innerHTML = `
  <li class="estoque-header-massa" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px 2px 2px;border-bottom:1px solid #205;">
    <div class="est-bulk-left">
      <input type="checkbox" id="check-selecionar-tudo" style="transform:scale(1.18); margin-right: 6px;" title="Selecionar tudo">
      <span style="font-weight:bold; color:#bfe4ff; font-family: 'Orbitron', sans-serif; letter-spacing: .3px;">Selecionar todos</span>
      <span id="estoqueBulkInfo" class="est-bulk-count">0 selecionados</span>
    </div>
    <button type="button" id="btn-excluir-selecionados" class="button primary" disabled title="Excluir Selecionados">Excluir Selecionados</button>
  </li>`.trim();

        data.produtos.forEach(p => {
          const li = document.createElement('li');
          li.className = 'estoque-item neon-border';

          if (p.negativo) {
            li.style.background = '#ffe6f2';
            li.style.border = '2px solid #ff487a';
            li.style.boxShadow = '0 0 18px #ff487a44';
          }

          li.innerHTML = `
  <input type="checkbox" class="check-produto" value="${p.id}" style="margin-right: 7px;">
  <div style="display:inline-block;vertical-align:middle;">
    <b>${p.nome}</b> <span style="color:#0ff;">[${p.codigo_barras}]</span><br>
    <span class="estoque-label">${p.quantidade} un x R$ ${parseFloat(p.valor_unitario).toFixed(2)} = <b>R$ ${parseFloat(p.valor_total).toFixed(2)}</b></span>
    <span class="estoque-label"> | NF: ${p.numero_nf || '-'} (${p.data_nf || '-'})</span>
    <span class="estoque-label"> | Fornecedor: ${p.fornecedor || '-'}</span>
  </div>
  <button class="button" onclick="removerProduto(${p.id})" title="Remover"><i class="fas fa-trash"></i></button>
`.trim();

          ul.appendChild(li);
        });

        const btnExcluir = document.getElementById('btn-excluir-selecionados');
        if (btnExcluir) {
          btnExcluir.onclick = function () {
            const selecionados = Array.from(document.querySelectorAll('.check-produto:checked')).map(cb => cb.value);
            if (!selecionados.length) return;

            if (!confirm('Excluir os itens selecionados?')) return;

            fetch(withSlash('/estoque/excluir_selecionados'), {
              method: 'POST',
              headers: {
                ...AJAX_HEADERS,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
              },
              body: JSON.stringify({ ids: selecionados }),
              credentials: 'same-origin'
            })
              .then(parseJSONOrThrow)
              .then(d => {
                if (d.success) {
                  carregarEstoque();
                  exibirAvisoEstoque('Itens excluídos com sucesso!', false);
                  // >>> avisa o dashboard após exclusão em massa
                  window.dispatchEvent(new CustomEvent('spa-kpis-dirty', { detail: { modules: ['estoque','dashboard'] }}));
                } else {
                  exibirAvisoEstoque('Erro ao excluir: ' + (d.error || ''), true);
                }
              })
              .catch(err => {
                console.error(err);
                exibirAvisoEstoque('Erro ao excluir.', true);
              });
          };
        }

        const checkAll = document.getElementById('check-selecionar-tudo');
        if (checkAll) {
          checkAll.onchange = (e) => {
            const marcado = e.target.checked;
            document.querySelectorAll('.check-produto').forEach(cb => { cb.checked = marcado; });
            atualizarAcoesMassa();
          };
        }

        document.querySelectorAll('.check-produto').forEach(cb => {
          cb.onchange = atualizarAcoesMassa;
        });

        atualizarAcoesMassa();
      }

      atualizarSugestoes(data.produtos || []);

      // >>> NOVO: se vier do atalho ?view=avisos, foca na lista de sugestões
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'avisos') {
          setTimeout(() => {
            const sug = document.getElementById('sugestoes-ul');
            if (sug) {
              sug.scrollIntoView({ behavior: 'smooth', block: 'center' });
              sug.style.outline = '2px solid #19e4ff';
              sug.style.boxShadow = '0 0 18px #19e4ff77';
              setTimeout(() => { sug.style.outline = ''; sug.style.boxShadow = ''; }, 1600);
            }
          }, 120);
        }
      } catch {}

    })
    .catch(err => {
      console.error(err);
      loading.style.display = 'none';
      exibirAvisoEstoque('Erro ao carregar estoque.', true);
    });
}

function atualizarAcoesMassa() {
  const checks = Array.from(document.querySelectorAll('.check-produto'));
  const selecionados = checks.filter(cb => cb.checked).length;

  const btnExcluir = document.getElementById('btn-excluir-selecionados');
  if (btnExcluir) {
    btnExcluir.disabled = !selecionados;
    btnExcluir.style.opacity = selecionados ? '1' : '0.45';
    btnExcluir.style.cursor = selecionados ? 'pointer' : 'not-allowed';
  }

  const bulkInfo = document.getElementById('estoqueBulkInfo');
  if (bulkInfo) bulkInfo.textContent = `${selecionados} selecionados`;

  const checkAll = document.getElementById('check-selecionar-tudo');
  if (checkAll) {
    checkAll.checked = checks.length > 0 && selecionados === checks.length;
    checkAll.indeterminate = selecionados > 0 && selecionados < checks.length;
  }
}

function importarXML(files, multiplo) {
  if (!files || !files.length) return;

  const url = withSlash(multiplo ? '/nfe/importar_multiplos' : '/nfe/importar_xml');
  const fd = new FormData();

  if (multiplo) {
    Array.from(files).forEach(f => fd.append('xmlfiles', f));
  } else {
    Array.from(files).forEach(f => fd.append('xmlfile', f));
  }

  fetch(url, {
    method: 'POST',
    headers: {
      ...AJAX_HEADERS,
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: fd,
    credentials: 'same-origin'
  })
    .then(parseJSONOrThrow)
    .then(d => {
      if (d.success) {
        exibirAvisoEstoque(d.aviso || 'Produtos importados com sucesso!', false);
        carregarEstoque();
        // >>> avisa o dashboard após importação XML
        window.dispatchEvent(new CustomEvent('spa-kpis-dirty', { detail: { modules: ['estoque','dashboard'] }}));
      } else {
        exibirAvisoEstoque('Erro: ' + (d.error || d.reason || 'Falha ao importar XML.'), true);
      }
    })
    .catch(err => {
      console.error(err);
      exibirAvisoEstoque('Erro ao importar XML.', true);
    });
}

function exibirAvisoEstoque(msg, negativo) {
  let aviso = document.getElementById('aviso-estoque');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-estoque';
    aviso.style = 'width:100%;text-align:center;font-size:1.13rem;padding:10px 0;margin-bottom:10px;';
    const card = document.querySelector('.card-estoque');
    if (card) card.insertBefore(aviso, card.children[2] || card.firstChild);
  }

  aviso.textContent = msg;
  aviso.style.background = negativo ? '#320c1e' : '#0e263a';
  aviso.style.color = negativo ? '#ff487a' : '#00ffe7';
  aviso.style.fontWeight = 'bold';
  aviso.style.borderRadius = '13px';
  aviso.style.boxShadow = negativo ? '0 0 14px #ff487a55' : '0 0 12px #00ffe744';
  aviso.style.border = negativo ? '2px solid #ff487a99' : '2px solid #00ffe799';
  aviso.style.display = 'block';

  setTimeout(() => {
    const a = document.getElementById('aviso-estoque');
    if (a) a.remove();
  }, 7000);
}

function atualizarSugestoes(produtos) {
  const ul = document.getElementById('sugestoes-ul');
  if (!ul) return;

  ul.innerHTML = '';

  const negativos = produtos.filter(p => p.quantidade < 0);
  const zerados = produtos.filter(p => p.quantidade === 0);
  const criticos = produtos.filter(p => p.quantidade > 0 && p.quantidade <= 6).sort((a, b) => a.quantidade - b.quantidade);

  if (negativos.length) {
    negativos.forEach(p => {
      const li = document.createElement('li');
      li.style.color = '#ff487a';
      li.style.fontWeight = 'bold';
      li.textContent = `${p.nome} — ESTOQUE NEGATIVO!`;
      ul.appendChild(li);
    });
  }

  if (zerados.length) {
    zerados.forEach(p => {
      const li = document.createElement('li');
      li.style.color = '#ffd84a';
      li.style.fontWeight = 'bold';
      li.textContent = `${p.nome} — Sem estoque (REPONHA)`;
      ul.appendChild(li);
    });
  }

  if (criticos.length) {
    criticos.forEach(p => {
      const li = document.createElement('li');
      li.style.color = '#ffe97b';
      li.textContent = `${p.nome} — Apenas ${p.quantidade} em estoque`;
      ul.appendChild(li);
    });
  }

  if (!negativos.length && !zerados.length && !criticos.length) {
    ul.innerHTML = '<li>Nenhuma sugestão no momento.</li>';
  }

  if (ul.children.length > 3) {
    ul.style.maxHeight = '130px';
    ul.style.overflowY = 'auto';
  } else {
    ul.style.maxHeight = '';
    ul.style.overflowY = '';
  }
}

// exposto global (compat.)
window.removerProduto = function (id) {
  if (!confirm('Deseja realmente remover este produto?')) return;

  fetch(withSlash(`/estoque/remover/${id}`), {
    method: 'POST',
    headers: {
      ...AJAX_HEADERS,
      'X-CSRFToken': getCookie('csrftoken')
    },
    credentials: 'same-origin'
  })
    .then(parseJSONOrThrow)
    .then(() => {
      carregarEstoque();
      exibirAvisoEstoque('Produto removido com sucesso!', false);
      // >>> avisa o dashboard após remoção unitária
      window.dispatchEvent(new CustomEvent('spa-kpis-dirty', { detail: { modules: ['estoque','dashboard'] }}));
    })
    .catch(err => {
      console.error(err);
      exibirAvisoEstoque('Erro ao remover produto.', true);
    });
};

// Reexecuta a inicialização quando o SPA carregar a tela
window.addEventListener('spa-page-loaded', function () {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/estoque')) {
    if (typeof window.inicializarEstoqueSPA === 'function') {
      window.inicializarEstoqueSPA();
    }
  }
});

})(); // <— IIFE de encapsulamento
