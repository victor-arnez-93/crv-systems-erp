# core/services.py
from django.db import transaction
from django.utils import timezone
from django.apps import apps
from decimal import Decimal
from .events import estoque_alterado, lancamento_criado, dashboard_atualizar

Produto = apps.get_model('estoque', 'ProdutoEstoque')
Movimentacao = apps.get_model('financeiro', 'MovimentacaoFinanceira')

@transaction.atomic
def atualizar_estoque(produto_id: int, tipo: str, quantidade: int, valor_unitario: Decimal, origem: str, ref: str = None):
    """Atualiza estoque e dispara evento"""
    produto = Produto.objects.select_for_update().get(id=produto_id)

    delta = quantidade if tipo == 'entrada' else -quantidade
    produto.quantidade = max(produto.quantidade + delta, 0)
    produto.valor_unitario = valor_unitario
    produto.save(update_fields=['quantidade', 'valor_unitario'])

    estoque_alterado.send(sender=atualizar_estoque,
                          produto_id=produto.id,
                          delta=delta,
                          origem=origem,
                          ref=ref)
    dashboard_atualizar.send(sender=atualizar_estoque, motivos={'estoque'})
    return produto

@transaction.atomic
def criar_lancamento(tipo: str, valor: Decimal, descricao: str, produto_nome=None,
                     numero_nf=None, fornecedor_cliente=None, origem=None, ref=None):
    """Cria movimentação financeira e dispara evento"""
    mov = Movimentacao.objects.create(
        tipo=tipo,
        data=timezone.now().date(),
        valor=valor,
        descricao=descricao or "",
        produto_nome=produto_nome or "",
        numero_nf=numero_nf or "",
        fornecedor_cliente=fornecedor_cliente or ""
    )

    lancamento_criado.send(sender=criar_lancamento,
                           tipo=tipo,
                           valor=float(valor),
                           data=str(mov.data),
                           origem=origem,
                           ref=ref)
    dashboard_atualizar.send(sender=criar_lancamento, motivos={'financeiro', 'fluxo'})
    return mov

@transaction.atomic
def registrar_movimentacao_completa(produto_id: int, tipo: str, quantidade: int,
                                    valor_unitario: Decimal, fornecedor_cliente: str = "",
                                    numero_nf: str = "", origem="MANUAL"):
    """Executa atualização de estoque e criação de lançamento"""
    produto = atualizar_estoque(produto_id, tipo, quantidade, valor_unitario, origem, numero_nf)
    valor_total = quantidade * valor_unitario

    if tipo == 'entrada':
        tipo_fin = 'saida'  # compra => saída de dinheiro
        descricao = f"Compra de {produto.nome}"
    else:
        tipo_fin = 'entrada'  # venda => entrada de dinheiro
        descricao = f"Venda de {produto.nome}"

    criar_lancamento(tipo_fin, valor_total, descricao,
                     produto_nome=produto.nome,
                     numero_nf=numero_nf,
                     fornecedor_cliente=fornecedor_cliente,
                     origem=origem,
                     ref=numero_nf)

    dashboard_atualizar.send(sender=registrar_movimentacao_completa,
                             motivos={'estoque', 'financeiro', 'fluxo', 'dashboard'})
