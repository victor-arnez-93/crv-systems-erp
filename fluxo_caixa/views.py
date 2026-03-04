from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
import calendar
from django.views.decorators.csrf import csrf_exempt
import json
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.exceptions import FieldDoesNotExist
from django.db.models import Sum
from django.http import JsonResponse, HttpResponseBadRequest, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import select_template
from django.template import TemplateDoesNotExist
from django.utils import timezone
from django.views.decorators.http import require_http_methods

# Modelo já existente
from financeiro.models import MovimentacaoFinanceira


# -------- datas --------
def _to_date(iso_str: str | None) -> date | None:
    if not iso_str:
        return None
    try:
        y, m, d = [int(x) for x in iso_str.split("-")]
        return date(y, m, d)
    except Exception:
        return None

def _month_bounds(d: date) -> tuple[date, date]:
    first = d.replace(day=1)
    last_day = calendar.monthrange(d.year, d.month)[1]
    last = d.replace(day=last_day)
    return first, last

def _week_bounds(d: date) -> tuple[date, date]:
    start = d - timedelta(days=d.isoweekday() - 1)
    end = start + timedelta(days=6)
    return start, end

def _daterange_for_periodo(periodo: str, data_str: str | None,
                           inicio_str: str | None, fim_str: str | None,
                           today: date) -> tuple[date, date]:
    periodo = (periodo or "mes").lower()
    if periodo == "hoje":   return today, today
    if periodo == "semana": return _week_bounds(today)
    if periodo == "mes":    return _month_bounds(today)
    if periodo == "data":
        d = _to_date(data_str) or today
        return d, d
    if periodo == "custom":
        ini = _to_date(inicio_str) or today
        fim = _to_date(fim_str) or ini
        if fim < ini: ini, fim = fim, ini
        return ini, fim
    return _month_bounds(today)

def _is_datetime_field(model_cls, field_name: str) -> bool:
    try:
        from django.db.models import DateTimeField
        field = model_cls._meta.get_field(field_name)
        return isinstance(field, DateTimeField)
    except (FieldDoesNotExist, Exception):
        return False

def _fmt_brl_str(v: Decimal | None) -> str:
    if v is None: v = Decimal("0")
    return f"{v.quantize(Decimal('0.01')):.2f}"

def _fmt_ddmmyyyy(d: date) -> str:
    return d.strftime("%d/%m/%Y")


# -------- views --------
@login_required
@require_http_methods(["GET"])
def fluxo_caixa_view(request: HttpRequest) -> HttpResponse:
    """
    Entrega o parcial da tela para SPA. Procura múltiplos caminhos de template
    (com e sem _parcial) para evitar 500 por TemplateDoesNotExist.
    """
    candidates = [
        # mais prováveis no seu projeto
        "financeiro/fluxo_caixa_parcial.html",
        "financeiro/fluxo_caixa.html",
        # variações por app/pasta
        "fluxo_caixa/fluxo_caixa_parcial.html",
        "fluxo_caixa/fluxo_caixa.html",
        "financeiro/partials/fluxo_caixa_parcial.html",
        "partials/fluxo_caixa_parcial.html",
    ]
    try:
        tmpl = select_template(candidates)
        html = tmpl.render({}, request)
        return HttpResponse(html)
    except TemplateDoesNotExist as e:
        # Evita 500 e mostra claramente qual caminho está faltando
        msg = (
            "<div style='padding:16px;color:#ff7b86'>"
            "Template do Fluxo de Caixa não encontrado.<br>"
            f"Tentados: {', '.join(candidates)}"
            "</div>"
        )
        return HttpResponse(msg, status=200)


@login_required
@require_http_methods(["GET"])
def listar_movimentacoes(request: HttpRequest) -> JsonResponse:
    tz_now = timezone.localtime()
    today = tz_now.date()

    periodo   = request.GET.get("periodo", "mes")
    data_str  = request.GET.get("data")
    inicio_str= request.GET.get("inicio")
    fim_str   = request.GET.get("fim")

    dt_ini, dt_fim = _daterange_for_periodo(periodo, data_str, inicio_str, fim_str, today)

    uses_datetime = _is_datetime_field(MovimentacaoFinanceira, "data")
    if uses_datetime:
        start_dt = datetime.combine(dt_ini, time.min)
        end_dt   = datetime.combine(dt_fim, time.max)
        if getattr(settings, "USE_TZ", False):
            start_dt = timezone.make_aware(start_dt)
            end_dt   = timezone.make_aware(end_dt)
        qs = MovimentacaoFinanceira.objects.filter(data__range=(start_dt, end_dt))
    else:
        qs = MovimentacaoFinanceira.objects.filter(data__range=(dt_ini, dt_fim))

    qs = qs.select_related()

    movimentos = []
    for m in qs.order_by("-data", "-id"):
        d_show = timezone.localtime(m.data).date() if uses_datetime else m.data
        movimentos.append({
            "id": m.id,  # <-- garante que o JS tenha o id
            "data": _fmt_ddmmyyyy(d_show),
            "tipo": getattr(m, "tipo", "") or "",
            "valor": _fmt_brl_str(getattr(m, "valor", Decimal("0"))),
            "descricao": getattr(m, "descricao", "") or "",
            "categoria": getattr(m, "categoria", "") or "",
        })

    entradas_val = qs.filter(tipo="entrada").aggregate(s=Sum("valor")).get("s") or Decimal("0")
    saidas_val   = qs.filter(tipo="saida").aggregate(s=Sum("valor")).get("s") or Decimal("0")
    saldo_val    = entradas_val - saidas_val

    payload = {
        "movimentos": movimentos,
        "resumo": {
            "entradas": _fmt_brl_str(entradas_val),
            "saidas":   _fmt_brl_str(saidas_val),
            "saldo":    _fmt_brl_str(saldo_val),
        },
        "periodo": {"inicio": dt_ini.isoformat(), "fim": dt_fim.isoformat()},
    }
    return JsonResponse(payload)

@login_required
@require_http_methods(["POST"])
def adicionar_movimentacao(request: HttpRequest) -> JsonResponse:
    if request.content_type and "application/json" in request.content_type:
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            return HttpResponseBadRequest("JSON inválido")
        data_iso = (body.get("data") or "").strip()
        tipo     = (body.get("tipo") or "").strip().lower()
        valor_str= (body.get("valor") or "").strip()
        descricao= (body.get("descricao") or "").strip()
    else:
        data_iso = (request.POST.get("data") or "").strip()
        tipo     = (request.POST.get("tipo") or "").strip().lower()
        valor_str= (request.POST.get("valor") or "").strip()
        descricao= (request.POST.get("descricao") or "").strip()

    if tipo not in {"entrada", "saida"}:
        return HttpResponseBadRequest("Tipo inválido")

    d = _to_date(data_iso)
    if not d:
        return HttpResponseBadRequest("Data inválida")

    try:
        valor = Decimal(valor_str)
    except (InvalidOperation, TypeError):
        return HttpResponseBadRequest("Valor inválido")

    uses_datetime = _is_datetime_field(MovimentacaoFinanceira, "data")
    if uses_datetime:
        dt = datetime.combine(d, time(12, 0))
        if getattr(settings, "USE_TZ", False):
            dt = timezone.make_aware(dt)
        obj = MovimentacaoFinanceira.objects.create(
            data=dt, tipo=tipo, valor=valor, descricao=descricao or ""
        )
    else:
        obj = MovimentacaoFinanceira.objects.create(
            data=d, tipo=tipo, valor=valor, descricao=descricao or ""
        )

    return JsonResponse({"success": True, "id": obj.id})

@login_required
@require_http_methods(["POST"])
def remover_movimentacao(request: HttpRequest, pk: int) -> JsonResponse:
    obj = get_object_or_404(MovimentacaoFinanceira, pk=pk)
    obj.delete()
    return JsonResponse({"success": True})

# ---- novo para exclusão múltipla ----
@login_required
@require_http_methods(["POST"])
@csrf_exempt
def remover_selecionados(request: HttpRequest) -> JsonResponse:
    try:
        dados = json.loads(request.body.decode("utf-8"))
        ids = [int(x) for x in dados.get("ids", []) if str(x).isdigit()]
        if not ids:
            return JsonResponse({"success": False, "error": "Nenhum ID recebido."})
        MovimentacaoFinanceira.objects.filter(id__in=ids).delete()
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)})