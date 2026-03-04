from django.apps import AppConfig

class FluxoCaixaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fluxo_caixa'    # nome do diretório do seu app
    label = 'fluxo_caixa'   # label único para evitar conflito (opcional, mas seguro)
