from django.urls import path
from . import views

app_name = "fluxo_caixa"

urlpatterns = [
    path("", views.fluxo_caixa_view, name="fluxo_caixa"),
    path("listar/", views.listar_movimentacoes, name="listar_movimentacoes"),
    path("adicionar/", views.adicionar_movimentacao, name="adicionar_movimentacao"),
    path("remover/<int:pk>/", views.remover_movimentacao, name="remover_movimentacao"),
    path("remover_selecionados/", views.remover_selecionados, name="remover_selecionados"),
]
