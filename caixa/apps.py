from django.apps import AppConfig

class CaixaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'caixa'                       # <- SEM prefixo
    verbose_name = 'Tela de Caixa (PDV)'
