from django import forms
from .models import Empresa
from django.core.validators import RegexValidator

class EmpresaForm(forms.ModelForm):
    cnpj = forms.CharField(
        label='CNPJ',
        max_length=18,
        validators=[
            RegexValidator(
                regex=r'^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$',
                message="Digite um CNPJ válido no formato XX.XXX.XXX/XXXX-XX"
            )
        ],
        widget=forms.TextInput(attrs={'placeholder': '00.000.000/0000-00'})
    )

    class Meta:
        model = Empresa
        fields = ['nome', 'cnpj', 'email', 'telefone', 'endereco', 'cidade', 'estado']
        widgets = {
            'nome': forms.TextInput(attrs={'placeholder': 'Nome da Empresa'}),
            'email': forms.EmailInput(attrs={'placeholder': 'email@empresa.com'}),
            'telefone': forms.TextInput(attrs={'placeholder': '(00) 00000-0000'}),
            'endereco': forms.TextInput(attrs={'placeholder': 'Rua, número, bairro'}),
            'cidade': forms.TextInput(attrs={'placeholder': 'Cidade'}),
            'estado': forms.TextInput(attrs={'placeholder': 'UF'}),
        }
