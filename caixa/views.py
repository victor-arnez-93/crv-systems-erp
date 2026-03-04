from django.shortcuts import render
from django.template.loader import render_to_string

def caixa_view(request):
    """
    Mesmo padrão do estoque_view:
    - Se for SPA/AJAX: retorna só o partial.
    - Se for acesso direto/F5: renderiza base.html com context['partial'].
    """
    NOME_PARTIAL = 'tela_caixa/pdv_parcial.html'
    context = {}

    # SPA (AJAX)
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, NOME_PARTIAL, context)

    # F5 / acesso direto
    context['partial'] = render_to_string(NOME_PARTIAL, context=context, request=request)
    return render(request, 'base.html', context)
