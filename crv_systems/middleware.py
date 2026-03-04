from django.shortcuts import redirect

class RedirectToHomeOnRefreshMiddleware:
    WHITELIST_PREFIXES = (
        '/dashboard/',
        '/accounts/',
        '/estoque/',
        '/financeiro/',
        '/fluxo_caixa/',
        '/configuracoes/',
        '/admin/',
        '/static/',
        '/media/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method in ('GET', 'HEAD') and request.user.is_authenticated:
            is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
            is_whitelisted = request.path.startswith(self.WHITELIST_PREFIXES)
            is_root = (request.path == '/')

            if not is_ajax and not is_whitelisted and not is_root:
                return redirect('/dashboard/inicial/')

        return self.get_response(request)