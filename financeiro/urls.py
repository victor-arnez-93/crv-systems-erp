from django.urls import path
from . import views

app_name = 'financeiro'

urlpatterns = [
    path('', views.financeiro_view, name='parcial'),
    path('exportar_pdf/', views.exportar_pdf, name='exportar_pdf'),
    path('exportar_excel/', views.exportar_excel, name='exportar_excel'),
]
