from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    path('inicial/', views.dashboard_inicial, name='dashboard_inicial'),
    path('kpis/', views.kpis_estoque, name='kpis_estoque'),
    path('noticias-startups-tecmundo/', views.noticias_startups_tecmundo, name='noticias_startups_tecmundo'),
    path('insights-tecnologia/', views.insights_tecnologia, name='insights_tecnologia'),
    path('ipinfo/', views.ip_info, name='ip_info'),
]
