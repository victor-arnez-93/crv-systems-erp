from django.contrib import admin
from django.urls import path, include
from .views import switch_theme, home_redirect  # Importa nova view

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Rota para alternar o tema
    path('switch-theme/', switch_theme, name='switch-theme'),

    # Página inicial - redireciona se logado
    path('', home_redirect, name='home'),

    # Autenticação (login, cadastro, logout, menu)
    path('accounts/', include('accounts.urls', namespace='accounts')),

    # Demais módulos
    path('estoque/', include('estoque.urls', namespace='estoque')),
    path('financeiro/', include('financeiro.urls', namespace='financeiro')),
    path('fluxo_caixa/', include('fluxo_caixa.urls')),
    path('caixa/', include('caixa.urls')),
    path('nfe/', include('nfe.urls', namespace='nfe')),
    path('configuracoes/', include('configuracoes.urls', namespace='configuracoes')),
    path('dashboard/', include('dashboard.urls')),
    path('cadastro/', include('cadastro.urls')),
]
