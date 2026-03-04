from django.contrib import admin
from .models import MovimentacaoCaixa

@admin.register(MovimentacaoCaixa)
class MovimentacaoCaixaAdmin(admin.ModelAdmin):
    list_display = ('data', 'tipo', 'valor', 'descricao', 'categoria', 'observacao', 'criado_em')
    list_filter = ('tipo', 'data', 'categoria')
    search_fields = ('descricao', 'categoria', 'observacao')
    date_hierarchy = 'data'
