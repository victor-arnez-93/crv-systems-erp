from django.shortcuts import redirect, render

def switch_theme(request):
    atual = request.session.get('fundo', '8')
    try:
        idx = int(atual)
    except ValueError:
        idx = 8
    proximo = idx + 1 if idx < 8 else 1
    request.session['fundo'] = str(proximo)
    return redirect(request.META.get('HTTP_REFERER', '/'))

def home_redirect(request):
    """
    Se o usuário estiver autenticado, envia para a Dashboard Inicial.
    Se não, mostra a tela initial.html.
    """
    if request.user.is_authenticated:
        return redirect('/dashboard/inicial/')
    return render(request, 'initial.html')
