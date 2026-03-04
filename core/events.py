# core/events.py
from django.dispatch import Signal

# eventos principais
estoque_alterado = Signal()       # produto_id, delta, origem, ref
lancamento_criado = Signal()      # tipo, valor, data, origem, ref
dashboard_atualizar = Signal()    # motivos: set[str]
