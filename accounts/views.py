from django.shortcuts               import render, redirect
from django.contrib.auth            import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms      import AuthenticationForm
from django.contrib                 import messages
from .forms                         import RegistrationForm


def cadastro(request):
    """
    - GET: exibe o formulário de cadastro em branco.
    - POST válido: salva o usuário, mostra mensagem de sucesso e redireciona para a tela inicial.
    - POST inválido: mostra mensagem de erro.
    """
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Cadastrado com sucesso! Faça login para acessar o sistema.")
            return redirect('home')  # home = initial.html
        else:
            messages.error(request, "Erro no cadastro! Verifique todos os campos.")
    else:
        form = RegistrationForm()

    return render(request, 'accounts/cadastro.html', {'form': form})

def login_view(request):
    """
    - GET: exibe o formulário de login.
    - POST válido: autentica, faz login e redireciona para o menu principal.
    - POST inválido: mostra mensagem de erro e permanece na mesma página.
    """
    if request.GET.get("next"):
        messages.warning(request, "É necessário estar logado para acessar o sistema.")

    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            login(request, form.get_user())
            messages.success(request, "Login realizado com sucesso!")
            return redirect('dashboard:dashboard_inicial')
        else:
            messages.error(request, "Usuário ou senha inválidos.")
    else:
        form = AuthenticationForm()

    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    """
    Desloga o usuário e redireciona para a tela inicial.
    """
    logout(request)
    return redirect('home')  # Se sua url 'home' aponta para initial.html


@login_required
def menu_principal(request):
    """
    Exibe o dashboard lateral (menu_principal.html).
    Protegido por login.
    """
    return render(request, 'menu_principal.html')
