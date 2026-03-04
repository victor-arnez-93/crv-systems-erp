// configuracoes.js

const temas = [
  { id: 1, thumb: '/static/imagens/fundo_1.png', nome: 'Azul Tech' },
  { id: 2, thumb: '/static/imagens/fundo_2.png', nome: 'Tech Dark' },
  { id: 3, thumb: '/static/imagens/fundo_3.png', nome: 'Minimal Dark' },
  { id: 4, thumb: '/static/imagens/fundo_4.png', nome: 'Chip Moderno' },
  { id: 5, thumb: '/static/imagens/fundo_5.png', nome: 'Gold Blocks' },
  { id: 6, thumb: '/static/imagens/fundo_6.png', nome: 'White Tech' },
  { id: 7, thumb: '/static/imagens/fundo_7.png', nome: 'Clean Dots' },
  { id: 8, thumb: '/static/imagens/fundo_8.png', nome: 'Blue Network' },
  { id: 9, thumb: '/static/imagens/fundo_9.png', nome: 'Galaxy Grid' },
  { id: 10, thumb: '/static/imagens/fundo_10.png', nome: 'Digital Nodes' },
];

let temaSelecionado = window.sessionStorage.getItem('previewTema');
if (!temaSelecionado) {
  if (typeof window.currentTema !== 'undefined' && window.currentTema) {
    temaSelecionado = window.currentTema;
  } else {
    temaSelecionado = 2;
  }
}
temaSelecionado = parseInt(temaSelecionado);

function renderTemas() {
  const list = document.querySelector('.tema-list');
  if (!list) return;
  list.innerHTML = '';
  let idxSel = temas.findIndex(t => t.id == temaSelecionado);
  if (idxSel === -1) idxSel = 0;
  const t = temas[idxSel];
  const div = document.createElement('div');
  div.className = 'tema-item selected';
  div.title = t.nome;
  div.innerHTML = `<img src="${t.thumb}" class="tema-thumb" alt="${t.nome}"/>`;
  div.onclick = () => previewTema(t.id);
  list.appendChild(div);

  // Nome do tema selecionado
  const nomeDiv = document.getElementById('tema-nome-exibido');
  if (nomeDiv) {
    nomeDiv.textContent = t ? t.nome : '';
    nomeDiv.style.textAlign = "center";
    nomeDiv.style.fontWeight = "600";
    nomeDiv.style.width = "100%";
  }
}

function previewTema(id) {
  temaSelecionado = id;
  renderTemas();
  document.body.style.backgroundImage = `url('/static/imagens/fundo_${id}.png')`;
  sessionStorage.setItem('previewTema', id);

  // SALVA NO BACKEND e mantém ao dar F5
  fetch('/configuracoes/aplicar-tema/', {
    method: 'POST',
    headers: {'X-CSRFToken': getCookie('csrftoken'), 'Content-Type': 'application/json'},
    body: JSON.stringify({fundo: temaSelecionado})
  }).then(r=>r.json()).then(resp=>{
    // Não recarrega a tela! Só salva no backend/session!
  });
}

function getCookie(name) {
  return document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(name + "="))?.split("=")[1] || "";
}

// FUNÇÃO PRINCIPAL: Binds SPA para TODOS os modais e eventos da tela de configurações
window.inicializarConfiguracoesSPA = function() {
  // ----------- TEMA -----------
  renderTemas();
  let setaEsq = document.querySelector('.tema-arrow-left');
  let setaDir = document.querySelector('.tema-arrow-right');
  if(setaEsq) setaEsq.onclick = ()=>{
    let idx = temas.findIndex(t=>t.id==temaSelecionado);
    if(idx>0) previewTema(temas[idx-1].id);
  };
  if(setaDir) setaDir.onclick = ()=>{
    let idx = temas.findIndex(t=>t.id==temaSelecionado);
    if(idx<temas.length-1) previewTema(temas[idx+1].id);
  };
  const previewId = sessionStorage.getItem('previewTema');
  if(previewId) previewTema(previewId);

  // ----------- MODAL CADASTRO EMPRESA -----------
  const modal = document.getElementById('modal-cadastro-empresa');
  const formModal = document.getElementById('form-empresa-modal');
  if(formModal) {
    formModal.onsubmit = async function(e) {
      e.preventDefault();
      const data = new FormData(formModal);
      data.append('empresa_form_submit', '1');
      const resp = await fetch(window.location.pathname, {
        method: 'POST',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        body: data
      });
      let msg = document.getElementById('modal-empresa-mensagem');
      if(resp.ok) {
        msg.style.display = "none";
        modal.style.display = "none";
        window.location.href = "/dashboard/inicial/";
      } else {
        let res = await resp.json();
        msg.innerText = res.erros ? Object.values(res.erros).join("\n") : "Erro ao salvar.";
        msg.style.display = "block";
      }
    }
  }

  // ----------- MODAL DETALHES DA EMPRESA -----------
  var btnDetalhes = document.getElementById('btn-ver-detalhes');
  var modalDetalhes = document.getElementById('modal-detalhes-empresa');
  var btnFecharDetalhes = document.getElementById('btn-fechar-detalhes');
  if(btnDetalhes && modalDetalhes){
    btnDetalhes.onclick = function() {
      modalDetalhes.style.display = "flex";
    };
  }
  if(btnFecharDetalhes && modalDetalhes){
    btnFecharDetalhes.onclick = function() {
      modalDetalhes.style.display = "none";
    };
  }

  // ----------- MODAL ALTERAR SENHA -----------
  var btnAlterarSenha = document.getElementById('btn-alterar-senha');
  var modalSenha = document.getElementById('modal-alterar-senha');
  var btnFecharSenha = document.getElementById('btn-fechar-senha');
  if(btnAlterarSenha && modalSenha){
    btnAlterarSenha.onclick = function() {
      modalSenha.style.display = "flex";
    };
  }
  if(btnFecharSenha && modalSenha){
    btnFecharSenha.onclick = function() {
      modalSenha.style.display = "none";
      document.getElementById('form-alterar-senha').reset();
      document.getElementById('msg-alterar-senha').textContent = '';
    };
  }

  // SUBMIT alteração de senha AJAX
  var formSenha = document.getElementById('form-alterar-senha');
  if(formSenha){
    formSenha.onsubmit = async function(e){
      e.preventDefault();
      var msg = document.getElementById('msg-alterar-senha');
      msg.textContent = '';
      var fd = new FormData(formSenha);
      try {
        let resp = await fetch('/accounts/password_change/', {
          method: 'POST',
          headers: {'X-Requested-With': 'XMLHttpRequest'},
          body: fd
        });
        if(resp.ok) {
          msg.style.color = "#3fdc71";
          msg.textContent = "Senha alterada com sucesso!";
          setTimeout(function(){
            modalSenha.style.display = "none";
            formSenha.reset();
            msg.textContent = '';
          }, 1200);
        } else {
          let res = await resp.json();
          msg.style.color = "#ff6060";
          msg.textContent = res.erros ? Object.values(res.erros).join("\n") : "Erro ao alterar senha.";
        }
      } catch(e){
        msg.style.color = "#ff6060";
        msg.textContent = "Erro de comunicação.";
      }
    };
  }
};
