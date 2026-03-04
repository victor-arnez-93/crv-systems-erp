import datetime
from decimal import Decimal
import json

from django.db.models import F, Q, Sum
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.template.loader import render_to_string

from financeiro.models import MovimentacaoFinanceira
from .models import ProdutoEstoque
from .forms import ProdutoEstoqueForm


# === SPA Partial universal ===
def estoque_view(request):
    NOME_PARTIAL = 'estoque/estoque_parcial.html'
    context = {}
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, NOME_PARTIAL, context)
    context['partial'] = render_to_string(NOME_PARTIAL, context=context, request=request)
    return render(request, 'base.html', context)


def listar_produtos(request):
    busca_nome = request.GET.get('busca_nome', '').strip()
    busca_ean = request.GET.get('busca_ean', '').strip()
    busca_fornecedor = request.GET.get('busca_fornecedor', '').strip()

    produtos = ProdutoEstoque.objects.all()
    if busca_nome:
        produtos = produtos.filter(nome__icontains=busca_nome)
    if busca_ean:
        produtos = produtos.filter(codigo_barras__icontains=busca_ean)
    if busca_fornecedor:
        produtos = produtos.filter(fornecedor__icontains=busca_fornecedor)

    data = []
    for p in produtos:
        data.append({
            'id': p.id,
            'nome': p.nome,
            'codigo_barras': p.codigo_barras,
            'quantidade': p.quantidade,
            'valor_unitario': str(p.valor_unitario),
            'valor_total': str(p.valor_total()),
            'fornecedor': p.fornecedor,
            'numero_nf': p.numero_nf,
            'data_nf': p.data_nf.strftime('%Y-%m-%d') if p.data_nf else '',
            'negativo': p.quantidade < 0,
        })
    return JsonResponse({'produtos': data})


@csrf_exempt
@require_POST
def adicionar_produto(request):
    form = ProdutoEstoqueForm(request.POST)
    if form.is_valid():
        form.save()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False, 'errors': form.errors}, status=400)


@csrf_exempt
@require_POST
def remover_produto(request, pk):
    produto = get_object_or_404(ProdutoEstoque, pk=pk)
    produto.delete()
    return JsonResponse({'success': True})


# ========= KPIs =========
def _kpis_atuais():
    """Agrega KPIs para Dashboard/Financeiro após importações."""
    hoje = datetime.date.today()
    inicio_mes = hoje.replace(day=1)

    def soma(qs):
        return qs.aggregate(s=Sum('valor'))['s'] or Decimal('0')

    ent_hoje = soma(MovimentacaoFinanceira.objects.filter(tipo='entrada', data=hoje))
    sai_hoje = soma(MovimentacaoFinanceira.objects.filter(tipo='saida', data=hoje))
    ent_mes  = soma(MovimentacaoFinanceira.objects.filter(tipo='entrada', data__gte=inicio_mes, data__lte=hoje))
    sai_mes  = soma(MovimentacaoFinanceira.objects.filter(tipo='saida', data__gte=inicio_mes, data__lte=hoje))

    produtos_qs = ProdutoEstoque.objects.all().annotate(_total=F('quantidade') * F('valor_unitario'))
    valor_estoque = produtos_qs.aggregate(s=Sum('_total'))['s'] or Decimal('0')
    itens_estoque = ProdutoEstoque.objects.aggregate(s=Sum('quantidade'))['s'] or 0

    kpis = {
        'financeiro': {
            'hoje': {
                'entradas': str(ent_hoje),
                'saidas':   str(sai_hoje),
                'saldo':    str(ent_hoje - sai_hoje),
            },
            'mes': {
                'entradas': str(ent_mes),
                'saidas':   str(sai_mes),
                'saldo':    str(ent_mes - sai_mes),
            }
        },
        'dashboard': {
            'estoque': {
                'valor_total': str(valor_estoque),
                'itens': int(itens_estoque or 0),
            }
        }
    }
    return kpis


@csrf_exempt
@require_POST
def excluir_selecionados(request):
    try:
        dados = json.loads(request.body)
        ids = dados.get('ids', [])
        if not ids:
            return JsonResponse({'success': False, 'error': 'Nenhum ID recebido.'})
        ProdutoEstoque.objects.filter(id__in=ids).delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
