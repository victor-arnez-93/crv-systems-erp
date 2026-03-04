from django.urls import path
from . import views

app_name = 'configuracoes'

urlpatterns = [
    path('', views.configuracoes_view, name='configuracoes'),
    path('parcial/', views.configuracoes_view, name='parcial'),
]
