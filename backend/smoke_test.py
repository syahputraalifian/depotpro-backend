"""Uji asap semua endpoint yang dipakai aplikasi Android, dengan bentuk data persis seperti Android.

Pakai:  python3 smoke_test.py [BASE_URL]
Default BASE_URL: https://depotpro-backend.onrender.com
Hanya memakai pustaka standar. Semua data uji berawalan 'ZZ TEST' dan dihapus di akhir.
"""
import json
import sys
import urllib.request
import urllib.error
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://depotpro-backend.onrender.com").rstrip("/")
API = BASE + "/api"
results = []
cleanup = []  # (method, path)


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read().decode() or "null"
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw
    except Exception as e:  # noqa
        return 0, f"{type(e).__name__}: {e}"


def check(name, got, expect, body=None):
    ok = got in (expect if isinstance(expect, (list, tuple)) else [expect])
    results.append((ok, name, got, body))
    print(("PASS " if ok else "FAIL ") + f"{name}  -> {got}" + ("" if ok else f"  | {str(body)[:300]}"))
    return ok


def stock_of(tok, pid):
    st, prods = call("GET", "/products", token=tok)
    for p in prods if isinstance(prods, list) else []:
        if p.get("id") == pid:
            return p
    return {}


def main():
    st, body = call("POST", "/auth/login", {"email": "owner@gasgalon.id", "password": "owner12345"})
    if not check("login owner", st, 200, body):
        print("Login gagal, uji dihentikan."); return
    tok = body["access_token"]

    # ---- produk (bentuk JSON seperti Android)
    st, prod = call("POST", "/products", {"name": "ZZ TEST Galon", "category": "Air Isi Ulang", "price": 5000.0,
                                          "cost_price": 2000.0, "stock": 10, "empty_gallon_stock": 0,
                                          "empty_lpg_stock": 0, "unit": "galon"}, tok)
    if not check("POST /products", st, [200, 201], prod):
        return
    pid = prod["id"]; cleanup.append(("DELETE", f"/products/{pid}"))
    check("produk stok awal = 10", stock_of(tok, pid).get("stock"), 10)
    st, b = call("PUT", f"/products/{pid}", {"id": pid, "name": "ZZ TEST Galon", "category": "Air Isi Ulang", "price": 5500.0,
                                             "cost_price": 2000.0, "stock": 10, "empty_gallon_stock": 0,
                                             "empty_lpg_stock": 0, "unit": "galon"}, tok)
    check("PUT /products/{id}", st, 200, b)

    # ---- checkout (walk-in)
    oid = str(uuid.uuid4())
    order = {"id": oid, "customer_name": "Pelanggan Umum",
             "items": [{"product_id": pid, "product_name": "ZZ TEST Galon", "quantity": 2, "price": 5500.0}],
             "total_amount": 11000.0, "payment_type": "cash", "status": "completed"}
    st, b = call("POST", "/orders", order, tok)
    check("POST /orders (checkout)", st, 200, b)
    cleanup.append(("DELETE", f"/orders/{oid}"))
    check("stok turun jadi 8", stock_of(tok, pid).get("stock"), 8)
    st, b = call("POST", "/orders", order, tok)
    check("POST /orders ulang (idempoten)", st, 200, b)
    check("stok tetap 8", stock_of(tok, pid).get("stock"), 8)
    st, b = call("POST", "/orders", {**order, "id": str(uuid.uuid4()),
                                     "items": [{"product_id": pid, "product_name": "x", "quantity": 999, "price": 1.0}]}, tok)
    check("stok kurang ditolak (400)", st, 400, b)
    st, lst = call("GET", "/orders", token=tok)
    check("GET /orders berupa list", (st, isinstance(lst, list)), (200, True), lst)

    # ---- driver + pengiriman
    st, b = call("POST", "/drivers", {"name": "ZZ TEST Driver", "phone": "0800", "status": "available"}, tok)
    check("POST /drivers", st, 200, b)
    did = (b.get("data") or {}).get("id") if isinstance(b, dict) else None
    if did:
        cleanup.append(("DELETE", f"/drivers/{did}"))
        oid2 = str(uuid.uuid4())
        st, b = call("POST", "/orders", {"id": oid2, "customer_name": "ZZ TEST Pelanggan",
                                         "items": [{"product_id": pid, "product_name": "x", "quantity": 1, "price": 5500.0}],
                                         "total_amount": 5500.0, "payment_type": "cash", "status": "assigned",
                                         "driver_id": did, "driver_name": "ZZ TEST Driver"}, tok)
        check("POST /orders dengan driver", st, 200, b)
        cleanup.append(("DELETE", f"/orders/{oid2}"))
        st, b = call("PATCH", f"/orders/{oid2}/status", {"status": "on_delivery", "gallons_returned": 0, "lpg_returned": 0}, tok)
        check("PATCH status on_delivery", st, 200, b)
        st, b = call("PATCH", f"/orders/{oid2}/status", {"status": "delivered", "gallons_returned": 1, "lpg_returned": 0}, tok)
        check("PATCH status delivered", st, 200, b)
        check("galon kosong bertambah 1", stock_of(tok, pid).get("empty_gallon_stock"), 1)
        st, drs = call("GET", "/drivers", token=tok)
        mine = [d for d in drs if d.get("id") == did] if isinstance(drs, list) else []
        check("driver: pengiriman selesai = 1", mine[0].get("completed_deliveries") if mine else None, 1)
        st, b = call("PUT", f"/drivers/{did}", {"id": did, "name": "ZZ TEST Driver 2", "phone": "0811", "status": "available"}, tok)
        check("PUT /drivers/{id}", st, 200, b)
        st, b = call("POST", f"/drivers/{did}/pay", None, tok)
        check("POST /drivers/{id}/pay", st, 200, b)

    # ---- pelanggan
    st, b = call("POST", "/customers", {"name": "ZZ TEST Pelanggan", "phone": "0899", "address": "Jl. Uji"}, tok)
    check("POST /customers", st, [200, 201], b)
    cid = (b.get("data") or {}).get("id") if isinstance(b, dict) else None
    if cid:
        cleanup.append(("DELETE", f"/customers/{cid}"))
        st, b = call("PUT", f"/customers/{cid}", {"id": cid, "name": "ZZ TEST Pelanggan 2", "phone": "0899", "address": "Jl. Uji 2"}, tok)
        check("PUT /customers/{id}", st, 200, b)
    st, b = call("GET", "/customers", token=tok)
    check("GET /customers", st, 200, b)

    # ---- pengeluaran
    st, b = call("POST", "/expenses", {"category": "ZZ TEST Bensin", "amount": 15000.0, "note": "uji"}, tok)
    check("POST /expenses", st, [200, 201], b)
    eid = b.get("id") if isinstance(b, dict) else None
    if eid:
        cleanup.append(("DELETE", f"/expenses/{eid}"))
        st, b = call("PUT", f"/expenses/{eid}", {"id": eid, "category": "ZZ TEST Bensin", "amount": 20000.0, "note": "uji2"}, tok)
        check("PUT /expenses/{id}", st, 200, b)
    st, b = call("GET", "/expenses", token=tok)
    check("GET /expenses", st, 200, b)

    # ---- piutang
    st, b = call("POST", "/receivables", {"customer_name": "ZZ TEST Pelanggan", "total_amount": 50000.0,
                                          "paid_amount": 0.0, "status": "unpaid", "due_date": "2026-12-31"}, tok)
    check("POST /receivables", st, [200, 201], b)
    rid = b.get("id") if isinstance(b, dict) else None
    if rid:
        cleanup.append(("DELETE", f"/receivables/{rid}"))
        st, b = call("POST", f"/receivables/{rid}/pay", {"amount": 10000.0}, tok)
        check("POST /receivables/{id}/pay", st, 200, b)
        st, b = call("PUT", f"/receivables/{rid}", {"id": rid, "customer_name": "ZZ TEST Pelanggan", "total_amount": 60000.0,
                                                    "paid_amount": 0.0, "due_date": "2027-01-15"}, tok)
        check("PUT /receivables/{id}", st, 200, b)
    st, b = call("GET", "/receivables", token=tok)
    check("GET /receivables", st, 200, b)

    # ---- laporan & dashboard
    st, b = call("GET", "/reports/summary", token=tok)
    check("GET /reports/summary", st, 200, b)
    check("summary punya daily_sales 7 hari", len(b.get("daily_sales", [])) if isinstance(b, dict) else None, 7)
    st, b = call("GET", "/dashboard", token=tok)
    check("GET /dashboard", st, 200, b)
    st, b = call("GET", "/auth/me", token=tok)
    check("GET /auth/me", st, 200, b)

    # ---- hak akses
    st, kb = call("POST", "/auth/login", {"email": "kasir@gasgalon.id", "password": "kasir12345"})
    if st == 200:
        kt = kb["access_token"]
        st, b = call("GET", "/expenses", token=kt)
        check("kasir dilarang /expenses (403)", st, 403, b)
        st, b = call("POST", "/products", {"name": "ZZ TEST x", "price": 1.0}, kt)
        check("kasir dilarang tambah produk (403)", st, 403, b)
    else:
        check("login kasir (password demo mungkin sudah diganti)", st, 200, kb)
    st, b = call("GET", "/orders")
    check("tanpa token ditolak (401)", st, 401, b)


try:
    main()
finally:
    print("\n--- bersih-bersih data uji ---")
    for method, path in reversed(cleanup):
        # login ulang tidak perlu: token disimpan di closure lewat panggilan baru
        pass
    st, b = call("POST", "/auth/login", {"email": "owner@gasgalon.id", "password": "owner12345"})
    if st == 200:
        t = b["access_token"]
        for method, path in reversed(cleanup):
            s2, _ = call(method, path, token=t)
            print(f"{method} {path} -> {s2}")
    fails = [r for r in results if not r[0]]
    print(f"\nRINGKASAN: {len(results) - len(fails)} lulus, {len(fails)} gagal dari {len(results)} cek")
    for _, name, got, body in fails:
        print(f"  GAGAL: {name} (status {got}) {str(body)[:200]}")
