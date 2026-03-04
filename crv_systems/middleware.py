# crv_systems/middleware.py
from django.shortcuts import redirect

class RedirectToHomeOnRefreshMiddleware:
    # rotas permitidas em refresh (NÃO inclua '/')
    WHITELIST_PREFIXES = (
        '/dashboard/inicial/',
        '/accounts/login',
        '/accounts/logout',
        '/accounts/cadastro',  # <-- liberado: cadastro (prefixo cobre com/sem '/')
        '/cadastro',           # <-- caso sua rota pública seja /cadastro
        '/admin',
        '/static',
        '/media',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ('GET', 'HEAD') and request.user.is_authenticated:
            is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
            is_whitelisted = request.path.startswith(self.WHITELIST_PREFIXES)
            is_root = (request.path == '/')
            if not is_ajax and not is_whitelisted and not is_root:
                # qualquer refresh/acesso direto fora da whitelist -> Início
                return redirect('/dashboard/inicial/')
        return self.get_response(request)
