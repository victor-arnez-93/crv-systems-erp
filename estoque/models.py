from django.db import models

class ProdutoEstoque(models.Model):
    nome = models.CharField('Produto', max_length=200)
    codigo_barras = models.CharField('Código de Barras (EAN/GTIN)', max_length=20, unique=True)
    quantidade = models.PositiveIntegerField('Quantidade')
    valor_unitario = models.DecimalField('Valor Unitário', max_digits=10, decimal_places=2)
    fornecedor = models.CharField('Fornecedor', max_length=200, blank=True)
    numero_nf = models.CharField('Número da NF', max_length=40, blank=True)
    data_nf = models.DateField('Data da NF', null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def valor_total(self):
        return self.quantidade * self.valor_unitario

    def __str__(self):
        return f"{self.nome} ({self.codigo_barras})"
