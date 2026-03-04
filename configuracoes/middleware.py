from django.shortcuts import redirect
from django.urls import reverse
from .models import Empresa

class CNPJObrigatorioMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Libera admin, login/logout e a própria rota de configurações para evitar loop
        paths_livres = [
            reverse('configuracoes:parcial'),
            reverse('accounts:logout'),
            reverse('accounts:login'),
            '/admin/',                   # Admin Django
        ]
        # Se o usuário não está autenticado, não bloqueia
        if not request.user.is_authenticated:
            return self.get_response(request)

        # Se o caminho começa com algum livre (ex: admin, static, etc)
        if any(request.path.startswith(path) for path in paths_livres) or request.path.startswith('/static/'):
            return self.get_response(request)

        # Checa se a Empresa tem CNPJ preenchido
        empresa = Empresa.objects.first()
        if not empresa or not empresa.cnpj or empresa.cnpj.strip() == "":
            return redirect('configuracoes:parcial')

        return self.get_response(request)
