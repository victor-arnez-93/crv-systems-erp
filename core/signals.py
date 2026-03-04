# core/signals.py
from django.dispatch import receiver
from django.db.models import Sum
from django.apps import apps
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from .events import estoque_alterado, lancamento_criado, dashboard_atualizar

Produto = apps.get_model('estoque', 'ProdutoEstoque')
Movimentacao = apps.get_model('financeiro', 'MovimentacaoFinanceira')

def _push(group: str, event: str, data: dict):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(group, {
        "type": "send_json",
        "event": event,
        "data": data,
    })

def _recalcular_kpis():
    total_estoque = Produto.objects.aggregate(s=Sum('quantidade'))['s'] or 0
    valor_estoque = Produto.objects.aggregate(s=Sum('quantidade') * Sum('valor_unitario'))['s'] or 0
    entradas = Movimentacao.objects.filter(tipo='entrada').aggregate(s=Sum('valor'))['s'] or 0
    saidas = Movimentacao.objects.filter(tipo='saida').aggregate(s=Sum('valor'))['s'] or 0
    saldo = entradas - saidas
    data = {
        'total_estoque': int(total_estoque),
        'valor_estoque': float(valor_estoque or 0),
        'entradas': float(entradas or 0),
        'saidas': float(saidas or 0),
        'saldo': float(saldo or 0),
    }
    cache.set('dashboard:kpis', data, 60)
    return data

@receiver(estoque_alterado)
def on_estoque_alterado(sender, **kwargs):
    _push('dashboard', 'estoque_alterado', {'produto_id': kwargs.get('produto_id'),
                                            'delta': kwargs.get('delta'),
                                            'origem': kwargs.get('origem')})

@receiver(lancamento_criado)
def on_lancamento_criado(sender, **kwargs):
    _push('financeiro', 'lancamento_criado', {
        'tipo': kwargs.get('tipo'),
        'valor': kwargs.get('valor'),
        'data': kwargs.get('data'),
        'origem': kwargs.get('origem'),
    })

@receiver(dashboard_atualizar)
def on_dashboard_atualizar(sender, **kwargs):
    data = _recalcular_kpis()
    _push('dashboard', 'kpis', data)
    _push('financeiro', 'kpis', data)
    _push('fluxo', 'kpis', data)
