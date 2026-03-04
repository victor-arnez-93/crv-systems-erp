// financeiro.js

window.inicializarFinanceiroSPA = function() {
  // FECHAR CARD
  const btnFechar = document.getElementById('btn-fechar-financeiro');
  if (btnFechar) {
    btnFechar.onclick = function() {
      carregarTela('/dashboard/inicial/');
    };
  }

  // Listener para mostrar datas personalizadas
  const selectPeriodo = document.getElementById('filtro-periodo');
  if (selectPeriodo) {
    selectPeriodo.addEventListener('change', function() {
      var show = this.value === 'personalizado';
      document.getElementById('dataDe').style.display = show ? '' : 'none';
      document.getElementById('ateLabel').style.display = show ? '' : 'none';
      document.getElementById('dataAte').style.display = show ? '' : 'none';
    });
  }

  // Filtros SPA
  const filtrosForm = document.getElementById('filtros-financeiro-form');
  if (filtrosForm) {
    filtrosForm.onsubmit = function(e) {
      e.preventDefault();
      carregarFinanceiroSPA();
    };
  }

  // Exportação PDF/Excel
  const btnExportarPDF = document.querySelector('.btn-exportar-pdf');
  if (btnExportarPDF) {
    btnExportarPDF.onclick = function() {
      document.getElementById('exportPDFPeriodo').value = document.getElementById('filtro-periodo').value;
      document.getElementById('exportPDFTipo').value    = document.getElementById('filtro-tipo').value;
      document.getElementById('exportPDFDataDe').value  = document.getElementById('dataDe').value;
      document.getElementById('exportPDFDataAte').value = document.getElementById('dataAte').value;
      document.getElementById('formExportarPDF').submit();
    };
  }
  const btnExportarExcel = document.querySelector('.btn-exportar-excel');
  if (btnExportarExcel) {
    btnExportarExcel.onclick = function() {
      document.getElementById('exportExcelPeriodo').value = document.getElementById('filtro-periodo').value;
      document.getElementById('exportExcelTipo').value    = document.getElementById('filtro-tipo').value;
      document.getElementById('exportExcelDataDe').value  = document.getElementById('dataDe').value;
      document.getElementById('exportExcelDataAte').value = document.getElementById('dataAte').value;
      document.getElementById('formExportarExcel').submit();
    };
  }

  // Alternar gráfico
  const btnAlternar = document.querySelector('.btn-alternar-grafico');
  if (btnAlternar) {
    btnAlternar.onclick = function() {
      tipoGraficoAtual = (tipoGraficoAtual === 'barras') ? 'pizza' : 'barras';
      desenharGraficoFinanceiro();
    };
  }

  // Gráfico
  desenharGraficoFinanceiro();
};

// SPA: Atualiza card via fetch sem reload
function carregarFinanceiroSPA() {
  const periodo = document.getElementById('filtro-periodo')?.value || '';
  const tipo    = document.getElementById('filtro-tipo')?.value || '';
  const dataDe  = document.getElementById('dataDe')?.value || '';
  const dataAte = document.getElementById('dataAte')?.value || '';
  let params = [];
  if (periodo) params.push('periodo=' + encodeURIComponent(periodo));
  if (tipo) params.push('tipo=' + encodeURIComponent(tipo));
  if (periodo === 'personalizado') {
    if (dataDe) params.push('data_de=' + encodeURIComponent(dataDe));
    if (dataAte) params.push('data_ate=' + encodeURIComponent(dataAte));
  }
  let url = '/financeiro/?' + params.join('&');
  fetch(url, { headers: { "x-requested-with": "XMLHttpRequest" } })
    .then(r => r.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const card = doc.querySelector('.card-financeiro');
      const atual = document.querySelector('.card-financeiro');
      if (card && atual) {
          atual.replaceWith(card);
          // Reinicializa tudo!
          window.inicializarFinanceiroSPA && window.inicializarFinanceiroSPA();
      } else {
          console.warn('Card financeiro não encontrado no DOM ou na resposta.');
      }
    });
}

// Chart.js
let graficoFinanceiro = null;
let tipoGraficoAtual = 'barras';

function desenharGraficoFinanceiro() {
  const canvas = document.getElementById('financeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dados = window.financeiroDadosGrafico || {
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
    movimentacoes: []
  };

  // Limpa o canvas e mostra mensagem se não houver dados
  if (
    (!dados.total_entradas || dados.total_entradas === 0) &&
    (!dados.total_saidas || dados.total_saidas === 0) &&
    (!dados.saldo || dados.saldo === 0)
  ) {
    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Escreve mensagem no meio do canvas
    ctx.save();
    ctx.font = "1.1rem Orbitron, sans-serif";
    ctx.fillStyle = "#aaa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Nenhuma movimentação financeira cadastrada", canvas.width/2, canvas.height/2);
    ctx.restore();
    return;
  }

  if (graficoFinanceiro) {
    graficoFinanceiro.destroy();
    graficoFinanceiro = null;
  }
  if (tipoGraficoAtual === 'barras') {
    graficoFinanceiro = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Entradas', 'Saídas', 'Saldo'],
        datasets: [{
          label: 'R$',
          data: [
            dados.total_entradas,
            dados.total_saidas,
            dados.saldo
          ],
          backgroundColor: [
            '#22e62eaa', // Entradas
            '#ff2264bb', // Saídas
            '#0099ffaa'  // Saldo
          ],
          borderColor: [
            '#22e62e',
            '#ff2264',
            '#0099ff'
          ],
          borderWidth: 2,
          borderRadius: 11
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          title: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#fff",
              font: { family: 'Orbitron, sans-serif', size: 14 }
            }
          },
          x: {
            ticks: {
              color: "#fff",
              font: { family: 'Orbitron, sans-serif', size: 14 }
            }
          }
        }
      }
    });
  } else if (tipoGraficoAtual === 'pizza') {
    graficoFinanceiro = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Entradas', 'Saídas'],
        datasets: [{
          data: [
            dados.total_entradas,
            dados.total_saidas
          ],
          backgroundColor: [
            '#22e62eaa',
            '#ff2264bb'
          ],
          borderColor: [
            '#22e62e',
            '#ff2264'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: "#fff",
              font: { family: 'Orbitron, sans-serif', size: 13 }
            }
          },
          title: { display: false }
        }
      }
    });
  }
}

window.desenharGraficoFinanceiro = desenharGraficoFinanceiro;
