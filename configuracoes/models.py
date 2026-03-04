from django.db import models

# Modelo para dados da empresa (Nome, CNPJ, e outros dados essenciais)
class Empresa(models.Model):
    nome = models.CharField("Nome da Empresa", max_length=120)
    cnpj = models.CharField("CNPJ", max_length=18, unique=True)
    email = models.EmailField("E-mail", blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)
    endereco = models.CharField("Endereço", max_length=200, blank=True, null=True)
    cidade = models.CharField("Cidade", max_length=60, blank=True, null=True)
    estado = models.CharField("Estado", max_length=2, blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nome or "Empresa sem nome"
