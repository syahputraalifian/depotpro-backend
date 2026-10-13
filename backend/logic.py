"""Logika bisnis murni DepotPro (tanpa FastAPI/Mongo) supaya mudah diuji."""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

WIB = timezone(timedelta(hours=7))

ROLE_ALIASES = {
    "pemilik": "owner",
    "owner": "owner",
    "kasir": "cashier",
    "cashier": "cashier",
    "gudang": "warehouse_admin",
    "warehouse": "warehouse_admin",
    "warehouse_admin": "warehouse_admin",
    "driver": "driver",
    "kurir": "driver",
}
VALID_ROLES = {"owner", "cashier", "warehouse_admin", "driver"}

PAYMENT_METHODS = {"cash", "transfer", "qris", "tempo", "deposit"}
ORDER_STATUSES = {"pending", "assigned", "on_delivery", "delivered", "completed", "cancelled"}
PRICE_TYPES = ("eceran", "warung", "pangkalan", "korporat")

# Beban yang bukan beban operasional (sesuai PRD)
NON_OPERATING_EXPENSE = {"pembelian_supplier", "koreksi_deposit"}

DAY_LABELS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]


def normalize_role(role: Any) -> Optional[str]:
    if not isinstance(role, str):
        return None
    return ROLE_ALIASES.get(role.strip().lower())


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError, OverflowError):
        return default


# ---------------------------------------------------------------- waktu
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def parse_dt(value: Any) -> Optional[datetime]:
    """Parse ISO string -> aware datetime (UTC bila tanpa zona)."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def local_date(value: Any) -> Optional[date]:
    dt = parse_dt(value)
    return dt.astimezone(WIB).date() if dt else None


def today_wib(now: Optional[datetime] = None) -> date:
    return (now or now_utc()).astimezone(WIB).date()


# -------------------------------------------------------------- produk
def is_lpg(product: Dict[str, Any]) -> bool:
    category = str(product.get("category") or "").strip().lower()
    name = str(product.get("name") or "").lower()
    if category in {"lpg", "gas", "elpiji"}:
        return True
    return any(word in name for word in ("lpg", "elpiji", "bright gas", "gas "))


def product_kind(product: Dict[str, Any]) -> str:
    """'lpg' | 'galon' | 'other' (AMDK dus dsb)."""
    if is_lpg(product):
        return "lpg"
    category = str(product.get("category") or "").strip().lower()
    name = str(product.get("name") or "").lower()
    if category in {"water", "air isi ulang", "galon"} or "galon" in name or "isi ulang" in name:
        return "galon"
    return "other"


def shape_product(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Bentuk respons produk yang konsisten untuk Expo & Android."""
    p = {k: v for k, v in doc.items() if k != "_id"}
    filled = max(0, to_int(p.get("stock_filled", p.get("stock", 0))))
    empty = max(0, to_int(p.get("stock_empty", 0)))
    price = to_float(p.get("price", p.get("price_eceran", 0)))
    cost = to_float(p.get("cost_price"))
    freight = to_float(p.get("freight_cost"))
    depreciation = to_float(p.get("depreciation_cost"))

    p["stock_filled"] = filled
    p["stock"] = filled
    p["stock_empty"] = empty
    p["price"] = price
    p["price_eceran"] = to_float(p.get("price_eceran", price))
    p["cost_price"] = cost
    p["hpp"] = round(cost + freight + depreciation, 2)
    p["reorder_point"] = to_int(p.get("reorder_point", 0))
    p["total_sold"] = to_int(p.get("total_sold", 0))
    p["unit"] = p.get("unit") or "pcs"
    kind = product_kind(p)
    p["kind"] = kind
    # Field yang dipakai aplikasi Android
    p["empty_lpg_stock"] = empty if kind == "lpg" else 0
    p["empty_gallon_stock"] = empty if kind != "lpg" else 0
    p["low_stock"] = filled <= p["reorder_point"]
    return p


def resolve_unit_price(product: Dict[str, Any], price_type: Optional[str] = None) -> float:
    """Harga satuan di sisi server (tidak percaya harga dari klien)."""
    tier = (price_type or "").strip().lower()
    candidates: List[Any] = []
    if tier in PRICE_TYPES:
        candidates.append(product.get(f"price_{tier}"))
    candidates += [product.get("price"), product.get("price_eceran")]
    for value in candidates:
        number = to_float(value, 0.0)
        if number > 0:
            return number
    raise ValueError("Harga produk belum dikonfigurasi")


def normalize_payment(value: Any) -> str:
    method = str(value or "cash").strip().lower()
    return method if method in PAYMENT_METHODS else ""


def receivable_status(total: float, paid: float) -> str:
    if paid >= total - 1e-9 and total > 0:
        return "paid"
    return "partial" if paid > 0 else "unpaid"


# -------------------------------------------------------------- driver
DRIVER_DEFAULTS = {
    "status": "available",
    "base_salary": 25000.0,
    "gallon_commission_rate": 750.0,
    "lpg_commission_rate": 500.0,
    "fuel_allowance": 10000.0,
    "deductions": 0.0,
    "completed_deliveries": 0,
    "gallons_delivered": 0,
    "lpg_delivered": 0,
}


def shape_driver(doc: Dict[str, Any]) -> Dict[str, Any]:
    d = {k: v for k, v in doc.items() if k != "_id"}
    for key, default in DRIVER_DEFAULTS.items():
        if d.get(key) is None:
            d[key] = default
    d.update(driver_take_home(d))
    return d


def driver_take_home(d: Dict[str, Any]) -> Dict[str, float]:
    gallon_incentive = to_int(d.get("gallons_delivered")) * to_float(d.get("gallon_commission_rate"), 750.0)
    lpg_incentive = to_int(d.get("lpg_delivered")) * to_float(d.get("lpg_commission_rate"), 500.0)
    total_incentive = gallon_incentive + lpg_incentive
    take_home = (
        to_float(d.get("base_salary"), 25000.0)
        + total_incentive
        + to_float(d.get("fuel_allowance"), 10000.0)
        - to_float(d.get("deductions"))
    )
    return {
        "gallon_incentive": gallon_incentive,
        "lpg_incentive": lpg_incentive,
        "total_incentive": total_incentive,
        "take_home_pay": max(0.0, take_home),
    }


# ------------------------------------------------------------- laporan
def _active(orders: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [o for o in orders if o.get("status") != "cancelled"]


def order_hpp(order: Dict[str, Any]) -> float:
    if order.get("total_hpp") is not None:
        return to_float(order.get("total_hpp"))
    return sum(to_float(i.get("hpp")) * to_int(i.get("qty")) for i in order.get("items", []))


def sum_sales(orders: Iterable[Dict[str, Any]], day: Optional[date] = None, month: Optional[tuple] = None) -> float:
    total = 0.0
    for o in _active(orders):
        d = local_date(o.get("created_at"))
        if day is not None and d != day:
            continue
        if month is not None and (d is None or (d.year, d.month) != month):
            continue
        total += to_float(o.get("total_amount"))
    return total


def daily_sales(orders: Iterable[Dict[str, Any]], days: int = 7, today: Optional[date] = None) -> List[Dict[str, Any]]:
    today = today or today_wib()
    orders = list(orders)
    result = []
    for offset in range(days - 1, -1, -1):
        d = today - timedelta(days=offset)
        result.append({
            "day": DAY_LABELS_ID[d.weekday()],
            "date": d.isoformat(),
            "amount": sum_sales(orders, day=d),
        })
    return result


def build_summary(
    orders: List[Dict[str, Any]],
    expenses: List[Dict[str, Any]],
    receivables: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    today: Optional[date] = None,
) -> Dict[str, Any]:
    today = today or today_wib()
    active = _active(orders)
    total_sales = sum(to_float(o.get("total_amount")) for o in active)
    total_hpp = sum(order_hpp(o) for o in active)
    total_expenses = sum(
        to_float(e.get("amount"))
        for e in expenses
        if str(e.get("category") or "").strip().lower() not in NON_OPERATING_EXPENSE
    )
    outstanding = sum(
        max(0.0, to_float(r.get("total_amount")) - to_float(r.get("paid_amount")))
        for r in receivables
        if r.get("status") != "cancelled"
    )
    gallons_sold = 0
    lpg_sold = 0
    for o in active:
        for item in o.get("items", []):
            kind = item.get("kind")
            qty = to_int(item.get("qty", item.get("quantity")))
            if kind == "galon":
                gallons_sold += qty
            elif kind == "lpg":
                lpg_sold += qty

    shaped = [shape_product(p) for p in products]
    return {
        "total_sales": total_sales,
        "today_sales": sum_sales(active, day=today),
        "month_sales": sum_sales(active, month=(today.year, today.month)),
        "total_orders": len(active),
        "total_products": len(products),
        "gallons_sold": gallons_sold,
        "lpg_sold": lpg_sold,
        "total_hpp": total_hpp,
        "total_expenses": total_expenses,
        "total_receivables": outstanding,
        "net_profit": total_sales - total_hpp - total_expenses,
        "empty_gallons": sum(p["empty_gallon_stock"] for p in shaped),
        "empty_lpg": sum(p["empty_lpg_stock"] for p in shaped),
        "low_stock_count": sum(1 for p in shaped if p["low_stock"]),
        "daily_sales": daily_sales(active, 7, today),
    }


def build_daily_report(
    orders: List[Dict[str, Any]],
    expenses: List[Dict[str, Any]],
    receivables: List[Dict[str, Any]],
    day: date,
    settlements: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Ringkasan satu hari (zona WIB) untuk tutup kasir. Pengeluaran dianggap dibayar tunai dari laci.

    Uang tunai pesanan yang diantar driver BARU masuk laci saat setorannya diterima (settlements).
    """
    todays = [o for o in orders if local_date(o.get("created_at")) == day]
    active = [o for o in todays if o.get("status") != "cancelled"]
    cancelled = [o for o in todays if o.get("status") == "cancelled"]

    by_method: Dict[str, Dict[str, Any]] = {}
    for o in active:
        m = str(o.get("payment_method") or o.get("payment_type") or "cash").strip().lower()
        row = by_method.setdefault(m, {"method": m, "count": 0, "amount": 0.0})
        row["count"] += 1
        row["amount"] += to_float(o.get("total_amount"))

    items: Dict[str, Dict[str, Any]] = {}
    for o in active:
        for it in o.get("items", []) or []:
            name = str(it.get("product_name") or "?")
            qty = to_int(it.get("qty", it.get("quantity")))
            amount = to_float(it.get("subtotal", to_float(it.get("price")) * qty))
            row = items.setdefault(name, {"product_name": name, "qty": 0, "amount": 0.0})
            row["qty"] += qty
            row["amount"] += amount

    day_text = day.isoformat()
    day_expenses = [e for e in expenses if str(e.get("date") or "")[:10] == day_text]
    expenses_total = sum(to_float(e.get("amount")) for e in day_expenses)

    rec_total = 0.0
    rec_cash = 0.0
    for r in receivables:
        for p in r.get("payments", []) or []:
            if local_date(p.get("at")) != day:
                continue
            amount = to_float(p.get("amount"))
            rec_total += amount
            if str(p.get("method") or "cash").strip().lower() == "cash":
                rec_cash += amount

    cash_sales = by_method.get("cash", {}).get("amount", 0.0)
    delivery_cash = sum(
        to_float(o.get("total_amount"))
        for o in active
        if str(o.get("payment_method") or o.get("payment_type") or "cash").strip().lower() == "cash" and o.get("driver_id")
    )
    drawer_cash_sales = cash_sales - delivery_cash
    settlements_received = sum(
        to_float(x.get("received_amount", x.get("amount"))) for x in (settlements or []) if x.get("status") == "confirmed"
    )
    return {
        "date": day_text,
        "orders_count": len(active),
        "cancelled_count": len(cancelled),
        "total_sales": sum(to_float(o.get("total_amount")) for o in active),
        "by_method": sorted(by_method.values(), key=lambda r: -r["amount"]),
        "items_sold": sorted(items.values(), key=lambda r: (-r["qty"], r["product_name"]))[:30],
        "expenses_total": expenses_total,
        "expenses": [
            {"category": e.get("category"), "amount": to_float(e.get("amount")), "note": e.get("note")} for e in day_expenses
        ],
        "receivable_payments_total": rec_total,
        "receivable_payments_cash": rec_cash,
        "cash_sales": cash_sales,
        "drawer_cash_sales": drawer_cash_sales,
        "delivery_cash_sales": delivery_cash,
        "driver_settlements_received": settlements_received,
        "expected_cash": drawer_cash_sales + settlements_received + rec_cash - expenses_total,
    }
