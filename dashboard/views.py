from django.shortcuts import render
from django.template.loader import render_to_string
from django.http import JsonResponse
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlparse
from datetime import datetime
import feedparser
import requests
from django.views.decorators.http import require_GET

from estoque.models import ProdutoEstoque


# ===== Helpers =====
def _brl_str(valor: Decimal) -> str:
    if valor is None:
        valor = Decimal('0.00')
    return str(valor.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def _day_of_year(dt: datetime) -> int:
    return int(dt.strftime('%j'))  # 1..366


# ========== DASHBOARD INICIAL ==========
def dashboard_inicial(request):
    # KPIs do estoque (regras do prompt)
    qs_all = ProdutoEstoque.objects.all()
    qs_pos = qs_all.filter(quantidade__gt=0)

    total_produtos = qs_pos.count()
    valor_total = sum([p.quantidade * p.valor_unitario for p in qs_pos]) if qs_pos.exists() else Decimal('0.00')

    avisos_neg = qs_all.filter(quantidade__lt=0).count()
    avisos_zero = qs_all.filter(quantidade=0).count()
    avisos_crit = qs_all.filter(quantidade__gt=0, quantidade__lte=6).count()
    total_avisos = avisos_neg + avisos_zero + avisos_crit

    context = {
        'total_produtos': total_produtos,
        'valor_total': valor_total,
        'avisos_total': total_avisos,
        'avisos_neg': avisos_neg,
        'avisos_zero': avisos_zero,
        'avisos_crit': avisos_crit,
        'usuario': request.user.get_full_name() or request.user.username or "Usuário",
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'dashboard/dashboard_inicial.html', context)

    context['partial'] = render_to_string('dashboard/dashboard_inicial.html', context=context, request=request)
    return render(request, 'base.html', context)


# ========== API: KPIs DE ESTOQUE (JSON) ==========
def kpis_estoque(request):
    qs_all = ProdutoEstoque.objects.all()
    qs_pos = qs_all.filter(quantidade__gt=0)

    produtos_estoque = qs_pos.count()
    valor_total = sum([p.quantidade * p.valor_unitario for p in qs_pos]) if qs_pos.exists() else Decimal('0.00')

    negativos = qs_all.filter(quantidade__lt=0).count()
    zerados   = qs_all.filter(quantidade=0).count()
    criticos  = qs_all.filter(quantidade__gt=0, quantidade__lte=6).count()

    data = {
        "success": True,
        "produtos_estoque": produtos_estoque,
        "valor_total": _brl_str(valor_total),
        "avisos": {
            "negativos": negativos,
            "zerados": zerados,
            "criticos": criticos,
            "total": negativos + zerados + criticos
        }
    }
    return JsonResponse(data)


# ========== NOTÍCIAS ==========
def noticias_startups_tecmundo(request):
    startups_feed = 'https://startups.com.br/feed/'
    tecmundo_feed = 'https://feeds.feedburner.com/tecmundo/tudo'

    itens = []
    try:
        p = feedparser.parse(startups_feed)
        for e in p.entries[:4]:
            itens.append({'title': e.title, 'link': e.link, 'fonte': 'Startups.com.br'})
    except Exception:
        pass

    try:
        p = feedparser.parse(tecmundo_feed)
        for e in p.entries[:4]:
            itens.append({'title': e.title, 'link': e.link, 'fonte': 'Tecmundo'})
    except Exception:
        pass

    itens = itens[:8] or [{'title': 'Sem notícias no momento', 'link': '#', 'fonte': '—'}]
    return JsonResponse({'noticias': itens})


# ========== INSIGHT DO DIA — CURIOSIDADE CURTA (PT-BR) ==========
def insights_tecnologia(request):
    """
    Retorna 1 curiosidade/insight por dia (PT-BR), curta e de impacto, com fonte clicável.
    Se ?all=1, retorna a lista completa (para navegação opcional no front).
    """
    FACTS_BASE = [
        # Segurança / privacidade  (links da Cartilha -> raiz para evitar 404)
        {"texto": "Brasil foi o 6º país mais atacado por ransomware em 2023.", "fonte": "https://securityintelligence.com", "fonte_nome": "securityintelligence.com"},
        {"texto": "Golpes de phishing aumentam em datas comerciais e fins de semana.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Autenticação em 2 fatores reduz fortemente o risco de invasões a contas.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Backups frequentes são a defesa mais eficaz contra sequestro de dados (ransomware).", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Senhas repetidas em vários sites aumentam muito o impacto de vazamentos.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Mensagens urgentes que pedem dados são sinal clássico de golpe — desconfie.", "fonte": "https://www.safernet.org.br/", "fonte_nome": "safernet.org.br"},
        {"texto": "Links encurtados podem esconder riscos: prefira copiar e colar o endereço completo.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Atualizações automáticas corrigem falhas: adiar pode deixar o sistema vulnerável.", "fonte": "https://www.kaspersky.com.br/resource-center", "fonte_nome": "kaspersky.com.br"},
        {"texto": "Dispositivos sem senha no Wi-Fi doméstico facilitam invasões à rede inteira.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Desconfiar de anexos .zip/.exe evita muitos incidentes em empresas.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},
        {"texto": "Navegadores modernos oferecem senha forte automática — use e salve com proteção.", "fonte": "https://support.google.com/chrome/answer/95606?hl=pt-BR", "fonte_nome": "google.com"},
        {"texto": "Cópias locais + nuvem formam a dupla de backup mais segura para pequenas empresas.", "fonte": "https://cartilha.cert.br/", "fonte_nome": "cartilha.cert.br"},

        # Pagamentos / PIX
        {"texto": "PIX já é o meio de pagamento mais usado no Brasil em número de transações.", "fonte": "https://www.bcb.gov.br/estabilidadefinanceira/pix", "fonte_nome": "bcb.gov.br"},
        {"texto": "PIX tem liquidação 24/7 e chega em segundos para a maioria das transações.", "fonte": "https://www.bcb.gov.br/estabilidadefinanceira/pix", "fonte_nome": "bcb.gov.br"},
        {"texto": "Golpes com QR Code geralmente exploram pressa e distração — confira o valor e o recebedor.", "fonte": "https://www.bcb.gov.br/estabilidadefinanceira/pix/seguranca", "fonte_nome": "bcb.gov.br"},
        {"texto": "Conferir nome e valor no PIX evita golpes comuns com QR Code.", "fonte": "https://www.bcb.gov.br/estabilidadefinanceira/pix/seguranca", "fonte_nome": "bcb.gov.br"},

        # ERP / Estoque / Financeiro
        {"texto": "ERP integra estoque, vendas e financeiro — menos digitação em duplicidade.", "fonte": "https://www.sebrae.com.br/sites/PortalSebrae", "fonte_nome": "sebrae.com.br"},
        {"texto": "Baixas automáticas de estoque via NF-e reduzem divergências de quantidade.", "fonte": "https://www.nfe.fazenda.gov.br/portal/principal.aspx", "fonte_nome": "nfe.fazenda.gov.br"},
        {"texto": "Conferir NCM/CFOP corretos na NF-e evita retrabalho contábil.", "fonte": "https://www.gov.br/receitafederal", "fonte_nome": "receitafederal.gov.br"},
        {"texto": "Estoque parado custa: acompanhar giro ajuda a liberar caixa.", "fonte": "https://www.sebrae.com.br/sites/PortalSebrae", "fonte_nome": "sebrae.com.br"},
        {"texto": "Conciliação de vendas (cartão/PIX) agiliza o fechamento do caixa.", "fonte": "https://www.bcb.gov.br/estabilidadefinanceira/pix", "fonte_nome": "bcb.gov.br"},
        {"texto": "Inventários periódicos detectam perdas e ajustes de cadastro.", "fonte": "https://www.sebrae.com.br/sites/PortalSebrae", "fonte_nome": "sebrae.com.br"},

        # Uso de tecnologia no BR / produtividade
        {"texto": "A maioria dos brasileiros acessa a internet principalmente pelo celular.", "fonte": "https://cetic.br/pt/pesquisas/domicilios/", "fonte_nome": "cetic.br"},
        {"texto": "WhatsApp está entre os aplicativos mais usados pelos brasileiros no dia a dia.", "fonte": "https://datareportal.com/reports/digital-2024-brazil", "fonte_nome": "datareportal.com"},
        {"texto": "Mais pessoas no Brasil usam internet para conversar do que para e-mail ou bancos.", "fonte": "https://cetic.br/pt/pesquisas/domicilios/", "fonte_nome": "cetic.br"},
        {"texto": "Automatizar tarefas repetitivas libera tempo para decisões estratégicas.", "fonte": "https://www.sebrae.com.br/sites/PortalSebrae", "fonte_nome": "sebrae.com.br"},
        {"texto": "Dados bem organizados reduzem retrabalho e erros em processos.", "fonte": "https://www.gov.br/governodigital/pt-br", "fonte_nome": "gov.br"},
        {"texto": "Dashboards funcionam melhor quando mostram poucas métricas realmente úteis.", "fonte": "https://canaltech.com.br/negocios/", "fonte_nome": "canaltech.com.br"},

        # Infra / rede
        {"texto": "5G melhora a velocidade, mas a estabilidade depende da cobertura e do aparelho.", "fonte": "https://www.anatel.gov.br/institucional/5g", "fonte_nome": "anatel.gov.br"},
        {"texto": "Wi-Fi lento muitas vezes é sinal de interferência: roteadores vizinhos e paredes importam.", "fonte": "https://olhardigital.com.br/tag/wi-fi/", "fonte_nome": "olhardigital.com.br"},

        # Curiosidades gerais
        {"texto": "Computação em nuvem permite pagar apenas pelo que é usado — como água e luz.", "fonte": "https://aws.amazon.com/pt/what-is-cloud-computing/", "fonte_nome": "aws.amazon.com"},
        {"texto": "IA generativa acelera tarefas, mas precisa de revisão humana para evitar erros.", "fonte": "https://tecnoblog.net/", "fonte_nome": "tecnoblog.net"},
    ]

    # Deduplicar por texto, mantendo a ordem
    texts = set()
    pool = []
    for item in FACTS_BASE:
        if item["texto"] in texts:
            continue
        texts.add(item["texto"])
        # garantir fonte_nome
        if not item.get("fonte_nome"):
            try:
                item["fonte_nome"] = urlparse(item["fonte"]).netloc.replace("www.", "")
            except Exception:
                item["fonte_nome"] = "—"
        pool.append(item)

    # Navegação opcional (?all=1)
    if request.GET.get('all'):
        return JsonResponse({"success": True, "insights": pool, "pool_size": len(pool)})

    # Um por dia (determinístico)
    idx = _day_of_year(datetime.now()) % len(pool)
    insight = pool[idx]
    return JsonResponse({"success": True, "insight": insight, "pool_size": len(pool)})


@require_GET
def ip_info(request):
    try:
        resp = requests.get("https://ipapi.co/json/", timeout=5)
        if resp.status_code == 200:
            return JsonResponse(resp.json())
        return JsonResponse({"error": "Falha ao obter IP info"}, status=resp.status_code)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)