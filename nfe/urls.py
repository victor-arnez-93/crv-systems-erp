from django.urls import path
from . import views

app_name = "nfe"

urlpatterns = [
    path("importar_xml/", views.importar_xml, name="importar_xml"),
    path("importar_multiplos/", views.importar_multiplos, name="importar_multiplos"),
]
