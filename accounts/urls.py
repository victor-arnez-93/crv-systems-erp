from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

app_name = 'accounts'

urlpatterns = [
    # Cadastro de novo usuário
    path('cadastro/', views.cadastro, name='cadastro'),

    # Login
    path('login/', views.login_view, name='login'),


    # Aceita GET e redireciona corretamente para '/'
    path('logout/', views.logout_view, name='logout'),

    # Dashboard/menu principal (após login)
    path('menu/', views.menu_principal, name='menu_principal'),
]
