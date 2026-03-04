from django.db import models

class MovimentacaoCaixa(models.Model):
    TIPO_CHOICES = (
        ('entrada', 'Entrada'),
        ('saida', 'Saída'),
    )
    data = models.DateField('Data', auto_now_add=True)
    tipo = models.CharField('Tipo', max_length=7, choices=TIPO_CHOICES)
    valor = models.DecimalField('Valor', max_digits=12, decimal_places=2)
    descricao = models.CharField('Descrição', max_length=255)
    categoria = models.CharField('Categoria', max_length=80, blank=True)
    observacao = models.TextField('Observação', blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.valor:.2f} em {self.data}"
