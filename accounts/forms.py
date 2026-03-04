from django import forms
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class RegistrationForm(forms.ModelForm):
    """
    Formulário de cadastro sem confirmação de senha extra,
    usando apenas um campo 'password1'.
    """
    password1 = forms.CharField(
        label="Senha",
        widget=forms.PasswordInput(attrs={
            'class': 'input-field',
            'placeholder': '••••••••',
        }),
        min_length=6,
        help_text="Sua senha deve ter no mínimo 6 caracteres."
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password1']
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'input-field',
                'placeholder': 'Digite seu usuário'
            }),
            'email': forms.EmailInput(attrs={
                'class': 'input-field',
                'placeholder': 'seu@exemplo.com'
            }),
        }
        labels = {
            'username': 'Usuário',
            'email': 'E-mail',
        }

    def clean_username(self):
        u = self.cleaned_data['username']
        if User.objects.filter(username=u).exists():
            raise ValidationError("Este usuário já está em uso.")
        return u

    def clean_email(self):
        e = self.cleaned_data['email']
        if User.objects.filter(email=e).exists():
            raise ValidationError("Este e-mail já está cadastrado.")
        return e

    def save(self, commit=True):
        """
        Cria o usuário definindo a senha corretamente
        e não armazena 'password1' como campo direto.
        """
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user
