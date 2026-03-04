from django import forms
from .models import ProdutoEstoque

class ProdutoEstoqueForm(forms.ModelForm):
    class Meta:
        model = ProdutoEstoque
        fields = [
            'nome', 'codigo_barras', 'quantidade', 'valor_unitario',
            'fornecedor', 'numero_nf', 'data_nf'
        ]
        widgets = {
            'data_nf': forms.DateInput(attrs={'type': 'date'}),
        }
