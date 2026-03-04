# core/routing.py
from django.urls import path
from .ws import DashboardConsumer, FinanceiroConsumer, FluxoConsumer

websocket_urlpatterns = [
    path("ws/dashboard/", DashboardConsumer.as_asgi()),
    path("ws/financeiro/", FinanceiroConsumer.as_asgi()),
    path("ws/fluxo/", FluxoConsumer.as_asgi()),
]
