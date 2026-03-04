# configuracoes/views.py

from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.template.loader import render_to_string
import json
from django.utils import timezone

from .forms import EmpresaForm
from .models import Empresa

def configuracoes_view(request):
    tema_atual = request.session.get('fundo', 2)
    usuario_logado = request.user.get_full_name() or request.user.username or "Usuário"
    # Sempre usa o horário da última autenticação do usuário
    if hasattr(request.user, 'last_login') and request.user.last_login:
        horario_login_dt = timezone.localtime(request.user.last_login)
        horario_login = horario_login_dt.strftime('%d/%m/%Y %H:%M')
    else:
        horario_login = '-'

    # Busca dados da empresa (primeiro registro)
    empresa = Empresa.objects.first()
    if request.method == 'POST' and 'empresa_form_submit' in request.POST:
        form_empresa = EmpresaForm(request.POST, instance=empresa)
        if form_empresa.is_valid():
            form_empresa.save()
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'sucesso': True, 'mensagem': 'Dados salvos!'})
        else:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'sucesso': False, 'erros': form_empresa.errors}, status=400)
    else:
        form_empresa = EmpresaForm(instance=empresa)

    context = {
        'tema_atual': tema_atual,
        'usuario_logado': usuario_logado,
        'horario_login': horario_login,
        'form_empresa': form_empresa,
    }
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'configuracoes/configuracoes_parcial.html', context)
    context['partial'] = render_to_string('configuracoes/configuracoes_parcial.html', context=context, request=request)
    return render(request, 'base.html', context)


@csrf_exempt
def aplicar_tema(request):
    if request.method == 'POST':
        body = json.loads(request.body.decode())
        fundo = int(body.get('fundo', 2))
        request.session['fundo'] = fundo
        return JsonResponse({'sucesso': True})
    return JsonResponse({'sucesso': False}, status=400)
