"""Uji asap semua endpoint yang dipakai aplikasi Android, dengan bentuk data persis seperti Android.

Pakai:  python3 smoke_test.py [BASE_URL]
Default BASE_URL: https://depotpro-backend.onrender.com
Hanya memakai pustaka standar. Semua data uji berawalan 'ZZ TEST' dan dihapus di akhir.
"""
import getpass
import json
import os
import sys
import time
import urllib.request
import urllib.error
import uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://depotpro-backend.onrender.com").rstrip("/")
API = BASE + "/api"
results = []
cleanup = []  # (method, path)

# Kredensial TIDAK disimpan di berkas. Beri lewat variabel lingkungan atau ketik saat diminta (tersembunyi):
#   OWNER_EMAIL, OWNER_PASSWORD, KASIR_EMAIL, KASIR_PASSWORD (kasir opsional; tanpa itu uji kasir dilewati)
OWNER_EMAIL = os.environ.get("OWNER_EMAIL") or "owner@gasgalon.id"
OWNER_PASSWORD = os.environ.get("OWNER_PASSWORD") or getpass.getpass(f"Password {OWNER_EMAIL}: ")
KASIR_EMAIL = os.environ.get("KASIR_EMAIL") or "kasir@gasgalon.id"
KASIR_PASSWORD = os.environ.get("KASIR_PASSWORD")


def _call_once(method, path, body=None, token=None):
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


def call(method, path, body=None, token=None):
    """GET diulang sampai 3x bila server sesaat tidak terjangkau (0/502/503/504). Tulis (POST/PUT/DELETE) tidak diulang."""
    attempts = 3 if method == "GET" else 1
    for i in range(attempts):
        status, data = _call_once(method, path, body, token)
        if status not in (0, 502, 503, 504) or i == attempts - 1:
            return status, data
        time.sleep(3)


def sweep(tok):
    """Hapus sisa data uji ('ZZ TEST') dari proses uji yang pernah terhenti, supaya tidak mengotori laporan asli."""
    st, orders = call("GET", "/orders", token=tok)
    if st == 200 and isinstance(orders, list):
        for o in orders:
            if str(o.get("customer_name", "")).startswith("ZZ TEST") and o.get("id"):
                s2, _ = call("DELETE", f"/orders/{o['id']}", token=tok)
                print(f"SWEEP /orders/{o['id']} -> {s2}")
    for path, field in (("/expenses", "category"), ("/receivables", "customer_name"), ("/customers", "name"),
                        ("/drivers", "name"), ("/products", "name")):
        st, rows = call("GET", path, token=tok)
        if st == 200 and isinstance(rows, list):
            for r in rows:
                if str(r.get(field, "")).startswith("ZZ TEST") and r.get("id"):
                    s2, _ = call("DELETE", f"{path}/{r['id']}", token=tok)
                    print(f"SWEEP {path}/{r['id']} -> {s2}")


def check(name, got, expect, body=None):
    if isinstance(expect, tuple) and isinstance(got, tuple):
        ok = got == expect
    else:
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
    st, body = call("POST", "/auth/login", {"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    if not check("login owner", st, 200, body):
        print("Login gagal, uji dihentikan."); return
    tok = body["access_token"]
    sweep(tok)

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
    check("wadah kosong +2 setelah penjualan langsung", stock_of(tok, pid).get("empty_gallon_stock"), 2)
    st, b = call("POST", "/orders", order, tok)
    check("POST /orders ulang (idempoten)", st, 200, b)
    check("stok tetap 8", stock_of(tok, pid).get("stock"), 8)
    check("wadah kosong tetap 2 (idempoten)", stock_of(tok, pid).get("empty_gallon_stock"), 2)
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
        check("galon kosong bertambah 1 saat pengiriman selesai (2 -> 3)", stock_of(tok, pid).get("empty_gallon_stock"), 3)
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

    # ---- pembatalan mengembalikan stok & wadah kosong penjualan langsung
    st, b = call("DELETE", f"/orders/{oid}", token=tok)
    check("DELETE /orders (batal penjualan langsung)", st, 200, b)
    pnow = stock_of(tok, pid)
    check("stok kembali setelah batal (8 + 2 = 10, minus 1 pengiriman = 9)", pnow.get("stock"), 9)
    check("wadah kosong kembali (3 - 2 = 1)", pnow.get("empty_gallon_stock"), 1)

    # ---- sinkron multi-perangkat: edit basi + penjualan serentak
    st, sp = call("POST", "/products", {"name": "ZZ TEST Sinkron", "category": "Air Isi Ulang", "price": 4000.0,
                                        "cost_price": 1000.0, "stock": 10, "unit": "galon"}, tok)
    if st in (200, 201):
        sid = sp["id"]; cleanup.append(("DELETE", f"/products/{sid}"))
        so = str(uuid.uuid4())
        call("POST", "/orders", {"id": so, "customer_name": "ZZ TEST", "items": [{"product_id": sid, "product_name": "x", "quantity": 3, "price": 4000.0}],
                                 "total_amount": 12000.0, "payment_type": "cash", "status": "completed"}, tok)
        cleanup.append(("DELETE", f"/orders/{so}"))
        # Perangkat B membuka edit saat stok 10, mengubah jadi 12 (+2) setelah A menjual 3 -> harus 9, bukan 12
        st, b = call("POST", f"/products/{sid}/adjust", {"stock_filled_delta": 2, "stock_empty_delta": 0}, tok)
        check("adjust stok memakai selisih (7 + 2)", (st, (b or {}).get("stock") if isinstance(b, dict) else None), (200, 9), b)
        st, b = call("PUT", f"/products/{sid}", {"name": "ZZ TEST Sinkron 2", "category": "Air Isi Ulang", "price": 4500.0,
                                                  "cost_price": 1000.0, "unit": "galon"}, tok)
        check("PUT info tanpa stok tidak mengubah stok", (st, stock_of(tok, sid).get("stock")), (200, 9), b)
        # 5 perangkat membeli serentak, stok hanya 3
        call("POST", f"/products/{sid}/adjust", {"stock_filled_delta": -6}, tok)
        check("stok disetel 3 untuk uji serentak", stock_of(tok, sid).get("stock"), 3)
        import threading
        out = []
        def buy():
            oid_ = str(uuid.uuid4())
            s_, b_ = call("POST", "/orders", {"id": oid_, "customer_name": "ZZ TEST", "items": [{"product_id": sid, "product_name": "x", "quantity": 1, "price": 4500.0}],
                                              "total_amount": 4500.0, "payment_type": "cash", "status": "completed"}, tok)
            out.append((s_, oid_))
        th = [threading.Thread(target=buy) for _ in range(5)]
        [x.start() for x in th]; [x.join() for x in th]
        for s_, oid_ in out:
            if s_ == 200:
                cleanup.append(("DELETE", f"/orders/{oid_}"))
        ok_n = sum(1 for s_, _ in out if s_ == 200)
        check("5 pembeli serentak, stok 3: tepat 3 berhasil", ok_n, 3)
        check("stok akhir 0, tidak negatif", stock_of(tok, sid).get("stock"), 0)

    # ---- laporan harian & tutup kasir
    st, b = call("GET", "/reports/daily", token=tok)
    check("GET /reports/daily", (st, "expected_cash" in b if isinstance(b, dict) else False), (200, True), b)
    st, b = call("POST", "/closings", {"date": "2000-01-01", "counted_cash": 1000.0, "note": "ZZ TEST"}, tok)
    check("POST /closings", st, 200, b)
    check("selisih tutup kasir dihitung", (b or {}).get("difference") if isinstance(b, dict) else None, 1000.0)
    cleanup.append(("DELETE", "/closings/2000-01-01"))
    st, b = call("GET", "/closings", token=tok)
    check("GET /closings", st, 200, b)

    # ---- akun driver terhubung ke data driver
    # Bersihkan sisa akun uji dari proses uji yang pernah terhenti, lalu pakai email unik tiap kali jalan.
    st, ulist = call("GET", "/users", token=tok)
    if st == 200 and isinstance(ulist, list):
        for u in ulist:
            if str(u.get("email", "")).startswith("zz-test-") and u.get("id"):
                call("DELETE", f"/users/{u['id']}", token=tok)
    test_email = f"zz-test-driver-{uuid.uuid4().hex[:8]}@gasgalon.id"
    st, b = call("POST", "/drivers", {"name": "ZZ TEST Driver Akun", "phone": "0", "status": "available"}, tok)
    d2 = (b.get("data") or {}).get("id") if isinstance(b, dict) else None
    st2, ub = call("POST", "/users", {"email": test_email, "name": "ZZ TEST Driver", "password": "ZzTest123",
                                      "role": "driver", "driver_id": d2}, tok)
    check("POST /users (driver terhubung)", (st2, (ub or {}).get("driver_id") == d2 if isinstance(ub, dict) else False), (201, True), ub)
    if d2:
        cleanup.append(("DELETE", f"/drivers/{d2}"))
    if st2 == 201:
        cleanup.append(("DELETE", f"/users/{ub['id']}"))
        st, lb = call("POST", "/auth/login", {"email": test_email, "password": "ZzTest123"})
        if st == 200:
            dt = lb["access_token"]
            mine = str(uuid.uuid4()); other = str(uuid.uuid4())
            call("POST", "/orders", {"id": mine, "customer_name": "ZZ TEST", "items": [{"product_id": pid, "product_name": "x", "quantity": 1, "price": 5500.0}],
                                     "total_amount": 5500.0, "payment_type": "cash", "status": "assigned", "driver_id": d2, "driver_name": "x"}, tok)
            call("POST", "/orders", {"id": other, "customer_name": "ZZ TEST", "items": [{"product_id": pid, "product_name": "x", "quantity": 1, "price": 5500.0}],
                                     "total_amount": 5500.0, "payment_type": "cash", "status": "completed"}, tok)
            cleanup.append(("DELETE", f"/orders/{mine}")); cleanup.append(("DELETE", f"/orders/{other}"))
            st, lst2 = call("GET", "/orders", token=dt)
            ids = [o.get("id") for o in lst2] if isinstance(lst2, list) else []
            check("driver hanya melihat order miliknya", (st, ids), (200, [mine]), lst2)
            st, drs2 = call("GET", "/drivers", token=dt)
            check("driver hanya melihat data driver sendiri", (st, len(drs2) if isinstance(drs2, list) else None), (200, 1), drs2)
            st, b = call("PATCH", f"/orders/{mine}/status", {"status": "on_delivery"}, dt)
            check("driver ubah status order miliknya", st, 200, b)
            st, b = call("PATCH", f"/orders/{mine}/status", {"status": "delivered", "gallons_returned": 0, "lpg_returned": 0}, dt)
            check("driver tandai order selesai", st, 200, b)
            st, out = call("GET", "/settlements/outstanding", token=dt)
            check("uang belum disetor driver = 5500", (st, out[0]["amount"] if isinstance(out, list) and out else None), (200, 5500.0), out)
            st, sb = call("POST", "/settlements/driver", {"note": "ZZ TEST"}, dt)
            check("driver setor uang", (st, sb.get("amount") if isinstance(sb, dict) else None), (201, 5500.0), sb)
            if st == 201:
                cleanup.append(("DELETE", f"/settlements/{sb['id']}"))
                st, out2 = call("GET", "/settlements/outstanding", token=dt)
                check("setelah setor, belum disetor kosong", (st, out2), (200, []), out2)
                st, b = call("POST", "/settlements/driver", {}, dt)
                check("setor ulang ditolak (400)", st, 400, b)
                st, b = call("PATCH", f"/settlements/{sb['id']}/confirm", {"received_amount": 1.0}, dt)
                check("driver tidak boleh konfirmasi setoran (403)", st, 403, b)
                st, b = call("PATCH", f"/settlements/{sb['id']}/confirm", {"received_amount": 5500.0}, tok)
                check("owner konfirmasi setoran", (st, b.get("status") if isinstance(b, dict) else None), (200, "confirmed"), b)
            st, b = call("PATCH", f"/orders/{other}/status", {"status": "delivered"}, dt)
            check("driver ditolak ubah order orang lain (403)", st, 403, b)
        else:
            check("login akun driver uji", st, 200, lb)

    # ---- wadah kosong bertambah walau kategori produk AMDK (kasus 'Aqua') + edit gaji driver
    if d2:
        st, ap = call("POST", "/products", {"name": "ZZ TEST Aqua AMDK", "category": "AMDK", "price": 3000.0,
                                            "cost_price": 1000.0, "stock": 5, "unit": "pcs"}, tok)
        if st in (200, 201):
            aid = ap["id"]; cleanup.append(("DELETE", f"/products/{aid}"))
            ao = str(uuid.uuid4())
            call("POST", "/orders", {"id": ao, "customer_name": "ZZ TEST", "items": [{"product_id": aid, "product_name": "x", "quantity": 2, "price": 3000.0}],
                                     "total_amount": 6000.0, "payment_type": "cash", "status": "assigned", "driver_id": d2, "driver_name": "x"}, tok)
            cleanup.append(("DELETE", f"/orders/{ao}"))
            st, b = call("PATCH", f"/orders/{ao}/status", {"status": "delivered", "gallons_returned": 2, "lpg_returned": 0}, tok)
            check("pengiriman selesai (produk AMDK)", st, 200, b)
            check("wadah kosong produk AMDK bertambah 2", stock_of(tok, aid).get("empty_gallon_stock"), 2)
        st, b = call("PUT", f"/drivers/{d2}", {"id": d2, "name": "ZZ TEST Driver Akun", "base_salary": 30000.0, "gallon_commission_rate": 1000.0,
                                               "lpg_commission_rate": 700.0, "fuel_allowance": 5000.0, "deductions": 2000.0}, tok)
        check("PUT gaji driver", st, 200, b)
        st, drs3 = call("GET", "/drivers", token=tok)
        row = next((x for x in drs3 if x.get("id") == d2), {}) if isinstance(drs3, list) else {}
        check("gaji tersimpan (30000, potongan 2000)", (row.get("base_salary"), row.get("deductions")), (30000.0, 2000.0), row)
        calc = (row.get("base_salary", 0) + row.get("total_incentive", 0) + row.get("fuel_allowance", 0) - row.get("deductions", 0))
        check("take-home pay dihitung ulang", row.get("take_home_pay"), calc, row)

    # ---- hak akses
    if KASIR_PASSWORD:
        st, kb = call("POST", "/auth/login", {"email": KASIR_EMAIL, "password": KASIR_PASSWORD})
        if st == 200:
            kt = kb["access_token"]
            st, b = call("GET", "/expenses", token=kt)
            check("kasir dilarang /expenses (403)", st, 403, b)
            st, b = call("POST", "/products", {"name": "ZZ TEST x", "price": 1.0}, kt)
            check("kasir dilarang tambah produk (403)", st, 403, b)
        else:
            check("login kasir", st, 200, kb)
    else:
        print("SKIP uji hak akses kasir (set KASIR_PASSWORD untuk mengujinya)")
    st, b = call("GET", "/orders")
    check("tanpa token ditolak (401)", st, 401, b)


try:
    main()
finally:
    print("\n--- bersih-bersih data uji ---")
    for method, path in reversed(cleanup):
        # login ulang tidak perlu: token disimpan di closure lewat panggilan baru
        pass
    st, b = call("POST", "/auth/login", {"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    if st == 200:
        t = b["access_token"]
        for method, path in reversed(cleanup):
            s2, _ = call(method, path, token=t)
            print(f"{method} {path} -> {s2}")
        sweep(t)
    fails = [r for r in results if not r[0]]
    print(f"\nRINGKASAN: {len(results) - len(fails)} lulus, {len(fails)} gagal dari {len(results)} cek")
    for _, name, got, body in fails:
        print(f"  GAGAL: {name} (status {got}) {str(body)[:200]}")
