from django.urls import path
from . import views

urlpatterns = [
    path('geral/', views.cadastro_view, name='cadastro_unificado'),
    path('clientes/novo/', views.novo_cliente, name='clientes_novo'),
    path('fornecedores/novo/', views.novo_fornecedor, name='fornecedores_novo'),
    path('clientes/<int:pk>/detalhes/', views.detalhes_cliente, name='detalhes_cliente'),
    path('fornecedores/<int:pk>/detalhes/', views.detalhes_fornecedor, name='detalhes_fornecedor'),
    path('clientes/<int:pk>/editar/', views.editar_cliente, name='editar_cliente'),
    path('fornecedores/<int:pk>/editar/', views.editar_fornecedor, name='editar_fornecedor'),
    path('clientes/<int:pk>/excluir/', views.excluir_cliente, name='excluir_cliente'),
    path('fornecedores/<int:pk>/excluir/', views.excluir_fornecedor, name='excluir_fornecedor'),
]
