from django.db import models

TIPO_MOVIMENTACAO = (
    ('entrada', 'Entrada'),
    ('saida', 'Saída'),
)

class MovimentacaoFinanceira(models.Model):
    tipo = models.CharField('Tipo', max_length=10, choices=TIPO_MOVIMENTACAO)
    data = models.DateField('Data')
    valor = models.DecimalField('Valor', max_digits=12, decimal_places=2)
    descricao = models.CharField('Descrição', max_length=255, blank=True)
    produto_nome = models.CharField('Produto', max_length=200, blank=True)  # para vincular com estoque se quiser
    numero_nf = models.CharField('Número da NF', max_length=40, blank=True)
    fornecedor_cliente = models.CharField('Fornecedor/Cliente', max_length=200, blank=True)

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.data} — R$ {self.valor} — {self.descricao}"
