from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string
from .models import Cliente, Fornecedor

UF_LISTA = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

def cadastro_view(request):
    context = {
        'clientes': Cliente.objects.all().order_by('-criado_em'),
        'fornecedores': Fornecedor.objects.all().order_by('-criado_em'),
        'ufs': UF_LISTA,
    }
    # AJAX (SPA): retorna só a partial
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'cadastro/cadastro_unificado.html', context)
    # F5 ou acesso direto: retorna o layout completo com partial embutida
    context['partial'] = render_to_string('cadastro/cadastro_unificado.html', context=context, request=request)
    return render(request, 'base.html', context)

@csrf_exempt
@require_POST
def novo_cliente(request):
    nome            = request.POST.get('nome','').strip()
    cpf             = request.POST.get('cpf','').strip()
    rg              = request.POST.get('rg','').strip()
    data_nasc       = request.POST.get('data_nascimento','').strip()
    telefone        = request.POST.get('telefone','').strip()
    email           = request.POST.get('email','').strip()
    cep             = request.POST.get('cep','').strip()
    endereco        = request.POST.get('endereco','').strip()
    cidade          = request.POST.get('cidade','').strip()
    uf              = request.POST.get('uf','').strip()

    if not all([nome, cpf, data_nasc, telefone, email, cep, endereco, cidade, uf]):
        return JsonResponse({'sucesso': False, 'erro': 'Preencha todos os campos obrigatórios.'})

    c = Cliente.objects.create(
        nome=nome,
        cpf=cpf,
        rg=rg,
        data_nascimento=data_nasc,
        telefone=telefone,
        email=email,
        cep=cep,
        endereco=endereco,
        cidade=cidade,
        estado=uf
    )
    return JsonResponse({'sucesso': True, 'id': c.id})

@csrf_exempt
@require_POST
def novo_fornecedor(request):
    nome               = request.POST.get('nome','').strip()
    cnpj               = request.POST.get('cnpj','').strip()
    inscricao_estadual = request.POST.get('inscricao_estadual','').strip()
    representante      = request.POST.get('representante','').strip()
    telefone           = request.POST.get('telefone','').strip()
    email              = request.POST.get('email','').strip()
    cep                = request.POST.get('cep','').strip()
    endereco           = request.POST.get('endereco','').strip()
    cidade             = request.POST.get('cidade','').strip()
    uf                 = request.POST.get('uf','').strip()

    if not all([nome, cnpj, representante, telefone, email, cep, endereco, cidade, uf]):
        return JsonResponse({'sucesso': False, 'erro': 'Preencha todos os campos obrigatórios.'})

    f = Fornecedor.objects.create(
        nome=nome,
        cnpj=cnpj,
        inscricao_estadual=inscricao_estadual,
        representante=representante,
        telefone=telefone,
        email=email,
        cep=cep,
        endereco=endereco,
        cidade=cidade,
        estado=uf
    )
    return JsonResponse({'sucesso': True, 'id': f.id})

@csrf_exempt
def detalhes_cliente(request, pk):
    c = get_object_or_404(Cliente, pk=pk)
    return JsonResponse({'sucesso': True, 'dados': {
        'nome': c.nome,
        'cpf': c.cpf,
        'rg': c.rg,
        'data_nascimento': str(c.data_nascimento),
        'telefone': c.telefone,
        'email': c.email,
        'cep': c.cep,
        'endereco': c.endereco,
        'cidade': c.cidade,
        'uf': c.estado
    }})

@csrf_exempt
def detalhes_fornecedor(request, pk):
    f = get_object_or_404(Fornecedor, pk=pk)
    return JsonResponse({'sucesso': True, 'dados': {
        'nome': f.nome,
        'cnpj': f.cnpj,
        'inscricao_estadual': f.inscricao_estadual,
        'representante': f.representante,
        'telefone': f.telefone,
        'email': f.email,
        'cep': f.cep,
        'endereco': f.endereco,
        'cidade': f.cidade,
        'uf': f.estado
    }})

@csrf_exempt
@require_POST
def editar_cliente(request, pk):
    c = get_object_or_404(Cliente, pk=pk)
    c.nome            = request.POST.get('nome','').strip()
    c.cpf             = request.POST.get('cpf','').strip()
    c.rg              = request.POST.get('rg','').strip()
    c.data_nascimento = request.POST.get('data_nascimento','').strip()
    c.telefone        = request.POST.get('telefone','').strip()
    c.email           = request.POST.get('email','').strip()
    c.cep             = request.POST.get('cep','').strip()
    c.endereco        = request.POST.get('endereco','').strip()
    c.cidade          = request.POST.get('cidade','').strip()
    c.estado          = request.POST.get('uf','').strip()
    c.save()
    return JsonResponse({'sucesso': True})

@csrf_exempt
@require_POST
def editar_fornecedor(request, pk):
    f = get_object_or_404(Fornecedor, pk=pk)
    f.nome               = request.POST.get('nome','').strip()
    f.cnpj               = request.POST.get('cnpj','').strip()
    f.inscricao_estadual = request.POST.get('inscricao_estadual','').strip()
    f.representante      = request.POST.get('representante','').strip()
    f.telefone           = request.POST.get('telefone','').strip()
    f.email              = request.POST.get('email','').strip()
    f.cep                = request.POST.get('cep','').strip()
    f.endereco           = request.POST.get('endereco','').strip()
    f.cidade             = request.POST.get('cidade','').strip()
    f.estado             = request.POST.get('uf','').strip()
    f.save()
    return JsonResponse({'sucesso': True})

@csrf_exempt
def excluir_cliente(request, pk):
    if request.method == 'DELETE':
        Cliente.objects.filter(pk=pk).delete()
        return JsonResponse({'sucesso': True})
    return JsonResponse({'sucesso': False, 'erro': 'Método não permitido.'}, status=405)

@csrf_exempt
def excluir_fornecedor(request, pk):
    if request.method == 'DELETE':
        Fornecedor.objects.filter(pk=pk).delete()
        return JsonResponse({'sucesso': True})
    return JsonResponse({'sucesso': False, 'erro': 'Método não permitido.'}, status=405)
