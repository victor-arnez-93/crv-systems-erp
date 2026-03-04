import datetime
import xml.etree.ElementTree as ET
from decimal import Decimal

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from configuracoes.models import Empresa
from estoque.models import ProdutoEstoque
from financeiro.models import MovimentacaoFinanceira


NS = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}


def limpar_cnpj(cnpj):
    return ''.join(filter(str.isdigit, str(cnpj or '')))


# ========= Funções de importação XML =========
@csrf_exempt
@require_POST
def importar_xml(request):
    arquivos = request.FILES.getlist('xmlfile')
    if not arquivos:
        return JsonResponse({'success': False, 'error': 'Nenhum arquivo enviado.'}, status=400)

    empresa = Empresa.objects.first()
    cnpj_empresa = limpar_cnpj(empresa.cnpj) if empresa else ''
    if not cnpj_empresa:
        return JsonResponse({'success': False, 'error': 'CNPJ da empresa não cadastrado.'}, status=400)

    xmls_ignorados = []
    insuficientes = []

    try:
        with transaction.atomic():
            for xmlfile in arquivos:
                result = parse_xml_nfe_tipo(xmlfile, cnpj_empresa)
                produtos = result['produtos']
                tipo = result['tipo']  # 'compra' ou 'venda'
                parceiro_nome = result['parceiro_nome']
                numero_nf = result['numero_nf']
                data_nf = result['data_nf']

                if not tipo:
                    xmls_ignorados.append(numero_nf or getattr(xmlfile, 'name', 'Arquivo'))
                    continue

                for item in produtos:
                    qtd = int(item['quantidade'] or 0)
                    vunit = item['valor_unitario']

                    p, created = ProdutoEstoque.objects.get_or_create(
                        codigo_barras=item['codigo_barras'],
                        defaults={
                            'nome': item['nome'],
                            'quantidade': 0,
                            'valor_unitario': vunit,
                            'fornecedor': parceiro_nome if tipo == 'compra' else '',
                            'numero_nf': numero_nf,
                            'data_nf': data_nf,
                        }
                    )

                    if tipo == 'compra':
                        p.quantidade = int(p.quantidade or 0) + qtd
                    elif tipo == 'venda':
                        disponivel = int(p.quantidade or 0)
                        if qtd > disponivel:
                            insuficientes.append(f"{item['nome']} (disp: {disponivel}, req: {qtd})")
                            continue
                        p.quantidade = disponivel - qtd

                    # Atualizações comuns
                    p.nome = item['nome']
                    p.valor_unitario = vunit
                    p.fornecedor = parceiro_nome if tipo == 'compra' else ''
                    p.numero_nf = numero_nf
                    p.data_nf = data_nf
                    p.save()

                    # Lançamento financeiro
                    MovimentacaoFinanceira.objects.create(
                        tipo='entrada' if tipo == 'compra' else 'saida',
                        data=data_nf or datetime.date.today(),
                        valor=vunit * qtd,
                        descricao=f"{'Compra' if tipo == 'compra' else 'Venda'} automática (XML)",
                        produto_nome=item['nome'],
                        numero_nf=numero_nf,
                        fornecedor_cliente=parceiro_nome,
                    )

        aviso_partes = []
        if insuficientes:
            aviso_partes.append(f"Estoque insuficiente para: {', '.join(insuficientes)}")
        if xmls_ignorados:
            aviso_partes.append(f"XML(s) ignorado(s): {', '.join(xmls_ignorados)} (CNPJ não corresponde à empresa)")
        aviso = " | ".join(aviso_partes)

        return JsonResponse({
            'success': True,
            'aviso': aviso,
            'dirty': ['dashboard', 'financeiro', 'estoque']
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def importar_multiplos(request):
    arquivos = request.FILES.getlist('xmlfiles')
    if not arquivos:
        return JsonResponse({'success': False, 'error': 'Nenhum arquivo enviado.'}, status=400)

    empresa = Empresa.objects.first()
    cnpj_empresa = limpar_cnpj(empresa.cnpj) if empresa else ''
    if not cnpj_empresa:
        return JsonResponse({'success': False, 'error': 'CNPJ da empresa não cadastrado.'}, status=400)

    xmls_ignorados = []
    insuficientes = []

    try:
        with transaction.atomic():
            for xmlfile in arquivos:
                result = parse_xml_nfe_tipo(xmlfile, cnpj_empresa)
                produtos = result['produtos']
                tipo = result['tipo']
                parceiro_nome = result['parceiro_nome']
                numero_nf = result['numero_nf']
                data_nf = result['data_nf']

                if not tipo:
                    xmls_ignorados.append(numero_nf or getattr(xmlfile, 'name', 'Arquivo'))
                    continue

                for item in produtos:
                    qtd = int(item['quantidade'] or 0)
                    vunit = item['valor_unitario']

                    p, created = ProdutoEstoque.objects.get_or_create(
                        codigo_barras=item['codigo_barras'],
                        defaults={
                            'nome': item['nome'],
                            'quantidade': 0,
                            'valor_unitario': vunit,
                            'fornecedor': parceiro_nome if tipo == 'compra' else '',
                            'numero_nf': numero_nf,
                            'data_nf': data_nf,
                        }
                    )

                    if tipo == 'compra':
                        p.quantidade = int(p.quantidade or 0) + qtd
                    elif tipo == 'venda':
                        disponivel = int(p.quantidade or 0)
                        if qtd > disponivel:
                            insuficientes.append(f"{item['nome']} (disp: {disponivel}, req: {qtd})")
                            continue
                        p.quantidade = disponivel - qtd

                    p.nome = item['nome']
                    p.valor_unitario = vunit
                    p.fornecedor = parceiro_nome if tipo == 'compra' else ''
                    p.numero_nf = numero_nf
                    p.data_nf = data_nf
                    p.save()

                    MovimentacaoFinanceira.objects.create(
                        tipo='entrada' if tipo == 'compra' else 'saida',
                        data=data_nf or datetime.date.today(),
                        valor=vunit * qtd,
                        descricao=f"{'Compra' if tipo == 'compra' else 'Venda'} automática (XML)",
                        produto_nome=item['nome'],
                        numero_nf=numero_nf,
                        fornecedor_cliente=parceiro_nome,
                    )

        aviso_partes = []
        if insuficientes:
            aviso_partes.append(f"Estoque insuficiente para: {', '.join(insuficientes)}")
        if xmls_ignorados:
            aviso_partes.append(f"XML(s) ignorado(s): {', '.join(xmls_ignorados)} (CNPJ não corresponde à empresa)")
        aviso = " | ".join(aviso_partes)

        return JsonResponse({
            'success': True,
            'aviso': aviso,
            'dirty': ['dashboard', 'financeiro', 'estoque']
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

def parse_xml_nfe_tipo(fileobj, cnpj_empresa):
    fileobj.seek(0)
    tree = ET.parse(fileobj)
    root = tree.getroot()

    infNFe = root.find('.//nfe:infNFe', NS)
    if infNFe is None:
        raise Exception("XML inválido: tag infNFe não encontrada.")

    ide = infNFe.find('.//nfe:ide', NS)
    numero_nf = ide.find('nfe:nNF', NS).text if ide is not None else ''
    dh = ide.find('nfe:dhEmi', NS).text if ide is not None else ''
    try:
        data_nf = datetime.datetime.fromisoformat(dh).date()
    except Exception:
        data_nf = None

    emit = infNFe.find('.//nfe:emit', NS)
    cnpj_emit = limpar_cnpj(emit.find('nfe:CNPJ', NS).text if emit is not None else '')
    parceiro_nome_emit = emit.find('nfe:xNome', NS).text if emit is not None else ''

    dest = infNFe.find('.//nfe:dest', NS)
    cnpj_dest = limpar_cnpj(dest.find('nfe:CNPJ', NS).text if dest is not None else '')
    parceiro_nome_dest = dest.find('nfe:xNome', NS).text if dest is not None else ''

    cnpj_empresa = limpar_cnpj(cnpj_empresa)

    tipo = None
    parceiro_nome = ""
    # 1. Comparação por CNPJ (empresa = emitente ou destinatário)
    if cnpj_empresa and cnpj_emit and cnpj_empresa == cnpj_emit:
        tipo = 'venda'
        parceiro_nome = parceiro_nome_dest
    elif cnpj_empresa and cnpj_dest and cnpj_empresa == cnpj_dest:
        tipo = 'compra'
        parceiro_nome = parceiro_nome_emit

    # 2. Reforço: tenta pelo tpNF e CFOP se não identificar pelo CNPJ
    if not tipo:
        tpNF = ide.find('nfe:tpNF', NS).text if ide is not None and ide.find('nfe:tpNF', NS) is not None else ''
        if tpNF.strip() == '0':
            tipo = 'compra'
            parceiro_nome = parceiro_nome_emit
        elif tpNF.strip() == '1':
            tipo = 'venda'
            parceiro_nome = parceiro_nome_dest
        else:
            # tenta pelo CFOP
            cfop_el = infNFe.find('.//nfe:CFOP', NS)
            cfop = cfop_el.text.strip() if cfop_el is not None else ''
            if cfop:
                if cfop[0] in ('1','2','3'):
                    tipo = 'compra'
                    parceiro_nome = parceiro_nome_emit
                elif cfop[0] in ('5','6','7'):
                    tipo = 'venda'
                    parceiro_nome = parceiro_nome_dest

    produtos = []
    for det in infNFe.findall('.//nfe:det', NS):
        prod = det.find('nfe:prod', NS)
        if prod is None:
            continue

        nome = (prod.find('nfe:xProd', NS).text if prod.find('nfe:xProd', NS) is not None else '')

        try:
            quantidade = int(float(prod.find('nfe:qCom', NS).text))
        except Exception:
            quantidade = 0

        try:
            valor_unitario = Decimal(prod.find('nfe:vUnCom', NS).text)
        except Exception:
            valor_unitario = Decimal('0')

        ean = prod.find('nfe:cEAN', NS)
        eanTrib = prod.find('nfe:cEANTrib', NS)
        if ean is not None and ean.text and ean.text != 'SEM GTIN':
            codigo = ean.text
        elif eanTrib is not None and eanTrib.text and eanTrib.text != 'SEM GTIN':
            codigo = eanTrib.text
        else:
            # usa o nome como chave estável para somar corretamente produtos iguais
            codigo = nome.strip().upper().replace(" ", "_")

        produtos.append({
            'nome': nome,
            'quantidade': quantidade,
            'valor_unitario': valor_unitario,
            'codigo_barras': codigo,
        })

    return {
        'produtos': produtos,
        'tipo': tipo,
        'parceiro_nome': parceiro_nome,
        'numero_nf': numero_nf,
        'data_nf': data_nf
    }