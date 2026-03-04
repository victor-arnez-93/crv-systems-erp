from django.urls import path
from . import views

app_name = 'estoque'

urlpatterns = [
    # ROTA PRINCIPAL: agora usa a view universal estoque_view
    path('',                    views.estoque_view,        name='estoque'),
    # Caso alguém use diretamente a parcial, ainda pode deixar apontando para a antiga ou remover no futuro
    # path('parcial/',            views.parcial,             name='parcial'),   # (Pode remover depois)
    path('listar/',             views.listar_produtos,     name='listar_produtos'),
    path('adicionar/',          views.adicionar_produto,   name='adicionar_produto'),
    path('remover/<int:pk>/',   views.remover_produto,     name='remover_produto'),
    path('excluir_selecionados/', views.excluir_selecionados, name='excluir_selecionados'),
]
