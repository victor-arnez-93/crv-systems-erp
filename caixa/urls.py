from django.urls import path
from . import views

app_name = 'caixa'

urlpatterns = [
    path('', views.caixa_view, name='pdv'),
]
