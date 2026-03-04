from django.db import models

class Cliente(models.Model):
    nome            = models.CharField("Nome completo", max_length=150, default='')
    cpf             = models.CharField("CPF", max_length=14, default='')
    rg              = models.CharField("RG", max_length=20, blank=True, null=True, default='')
    data_nascimento = models.DateField("Data de nascimento", blank=True, null=True, default=None)
    telefone        = models.CharField("Telefone/WhatsApp", max_length=20, default='')
    email           = models.EmailField("E-mail", default='')
    cep             = models.CharField("CEP", max_length=9, default='')
    endereco        = models.CharField("Endereço", max_length=200, default='')
    cidade          = models.CharField("Cidade", max_length=100, default='')
    estado          = models.CharField("UF", max_length=2, default='')
    criado_em       = models.DateTimeField("Criado em", auto_now_add=True)

    def __str__(self):
        return self.nome


class Fornecedor(models.Model):
    nome               = models.CharField("Razão social / Nome fantasia", max_length=150, default='')
    cnpj               = models.CharField("CNPJ", max_length=18, default='')
    inscricao_estadual = models.CharField("Inscrição estadual", max_length=20, blank=True, null=True, default='')
    representante      = models.CharField("Representante", max_length=100, default='')
    telefone           = models.CharField("Telefone/WhatsApp", max_length=20, default='')
    email              = models.EmailField("E-mail", default='')
    cep                = models.CharField("CEP", max_length=9, default='')
    endereco           = models.CharField("Endereço", max_length=200, default='')
    cidade             = models.CharField("Cidade", max_length=100, default='')
    estado             = models.CharField("UF", max_length=2, default='')
    criado_em          = models.DateTimeField("Criado em", auto_now_add=True)

    def __str__(self):
        return self.nome
