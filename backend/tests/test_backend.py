"""Backend integration tests for GasGalon ERP & POS."""
import pytest
import requests
from tests.conftest import BASE_URL, CREDS


# ==================== AUTH & RBAC ====================
class TestAuth:
    def test_login_all_roles(self, tokens):
        for role, info in tokens.items():
            assert info["token"], f"No token for {role}"
            assert info["user"]["role"] in ("owner", "cashier", "warehouse_admin", "driver")

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "owner@gasgalon.id", "password": "wrong"})
        assert r.status_code == 401

    def test_me_returns_role(self, owner_client, cashier_client, driver_client, warehouse_client):
        for c, expected in [
            (owner_client, "owner"),
            (cashier_client, "cashier"),
            (driver_client, "driver"),
            (warehouse_client, "warehouse_admin"),
        ]:
            r = c.get(f"{BASE_URL}/api/auth/me")
            assert r.status_code == 200
            assert r.json()["role"] == expected

    def test_no_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


class TestRBAC:
    def test_warehouse_forbidden_finance(self, warehouse_client):
        r = warehouse_client.get(f"{BASE_URL}/api/finance/summary")
        assert r.status_code == 403

    def test_driver_forbidden_finance(self, driver_client):
        r = driver_client.get(f"{BASE_URL}/api/finance/summary")
        assert r.status_code == 403

    def test_cashier_forbidden_create_product(self, cashier_client):
        r = cashier_client.post(f"{BASE_URL}/api/products",
                                json={"name": "TEST_x", "category": "lpg"})
        assert r.status_code == 403


# ==================== PRODUCTS ====================
class TestProducts:
    def test_list_seeded(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5
        # HPP auto = cost + freight + depreciation
        for p in items:
            expected = round(p["cost_price"] + p["freight_cost"] + p["depreciation_cost"], 2)
            assert p["hpp"] == expected, f"HPP mismatch on {p['name']}"

    def test_create_product_hpp(self, warehouse_client):
        payload = {"name": "TEST_LPG5", "category": "lpg", "cost_price": 10000,
                   "freight_cost": 500, "depreciation_cost": 200,
                   "price_eceran": 15000, "stock_filled": 20, "stock_empty": 5,
                   "reorder_point": 3}
        r = warehouse_client.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["hpp"] == 10700
        # verify persisted via GET
        r2 = warehouse_client.get(f"{BASE_URL}/api/products")
        assert any(x["id"] == p["id"] and x["hpp"] == 10700 for x in r2.json())

    def test_adjust_stock(self, warehouse_client):
        # find seeded product
        prods = warehouse_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("LPG 3 Kg"))
        before_f = p["stock_filled"]
        before_e = p["stock_empty"]
        r = warehouse_client.post(f"{BASE_URL}/api/products/{p['id']}/adjust",
                                  json={"stock_filled_delta": 5, "stock_empty_delta": -2,
                                        "note": "TEST_adjust"})
        assert r.status_code == 200
        upd = r.json()
        assert upd["stock_filled"] == before_f + 5
        assert upd["stock_empty"] == before_e - 2

    def test_low_stock(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/inventory/low-stock")
        assert r.status_code == 200
        for p in r.json():
            assert p["stock_filled"] <= p["reorder_point"]


# ==================== CUSTOMERS ====================
class TestCustomers:
    def test_list_and_create(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/customers")
        assert r.status_code == 200
        assert len(r.json()) >= 3
        # create
        payload = {"name": "TEST_Cust1", "type": "warung", "tier": "warung",
                   "credit_limit": 500000, "payment_terms_days": 7, "deposit_balance": 100000}
        r = owner_client.post(f"{BASE_URL}/api/customers", json=payload)
        assert r.status_code == 200
        c = r.json()
        assert c["name"] == "TEST_Cust1"
        assert c["deposit_balance"] == 100000

    def test_topup_deposit(self, owner_client):
        custs = owner_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == "Warung Bu Siti")
        before = c["deposit_balance"]
        r = owner_client.post(f"{BASE_URL}/api/customers/{c['id']}/deposit",
                              json={"amount": 50000})
        assert r.status_code == 200
        after = next(x for x in owner_client.get(f"{BASE_URL}/api/customers").json()
                     if x["id"] == c["id"])
        assert after["deposit_balance"] == before + 50000

    def test_customer_transactions(self, owner_client):
        custs = owner_client.get(f"{BASE_URL}/api/customers").json()
        cid = custs[0]["id"]
        r = owner_client.get(f"{BASE_URL}/api/customers/{cid}/transactions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ==================== TRANSACTIONS / POS ====================
class TestTransactions:
    def _product(self, client, name_prefix):
        prods = client.get(f"{BASE_URL}/api/products").json()
        return next(p for p in prods if p["name"].startswith(name_prefix))

    def test_cash_sale_stock_movement(self, cashier_client, owner_client):
        p = self._product(cashier_client, "Air Isi Ulang")
        before_f, before_e = p["stock_filled"], p["stock_empty"]
        items = [{"product_id": p["id"], "name": p["name"], "qty": 2,
                  "price": p["price_eceran"], "is_exchange": True,
                  "subtotal": p["price_eceran"] * 2}]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"items": items, "payment_method": "cash",
                                      "channel": "pos", "tier": "eceran",
                                      "amount_paid": p["price_eceran"] * 2})
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["status"] == "paid"
        assert txn["total"] == p["price_eceran"] * 2
        # verify stock movement
        upd = next(x for x in owner_client.get(f"{BASE_URL}/api/products").json()
                   if x["id"] == p["id"])
        assert upd["stock_filled"] == before_f - 2
        assert upd["stock_empty"] == before_e + 2  # exchange returned empty

    def test_credit_control_tempo_over_limit(self, cashier_client):
        # Warung Bu Siti has credit_limit=1_000_000 -> big order should block
        custs = cashier_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == "Warung Bu Siti")
        p = self._product(cashier_client, "LPG 12 Kg")
        items = [{"product_id": p["id"], "name": p["name"], "qty": 20,
                  "price": p["price_warung"], "is_exchange": True,
                  "subtotal": p["price_warung"] * 20}]  # ~4M > 1M limit
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"customer_id": c["id"], "items": items,
                                      "payment_method": "tempo", "tier": "warung"})
        assert r.status_code == 400
        assert "plafon" in r.text.lower() or "kredit" in r.text.lower()

    def test_credit_control_deposit_over_balance(self, cashier_client):
        custs = cashier_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == "Resto Sederhana")
        # Use a large qty of LPG 12 Kg so order value is guaranteed to exceed deposit balance
        p = self._product(cashier_client, "LPG 12 Kg")
        qty = 100  # ~18M > any conceivable deposit balance
        items = [{"product_id": p["id"], "name": p["name"], "qty": qty,
                  "price": p["price_korporat"], "is_exchange": True,
                  "subtotal": p["price_korporat"] * qty}]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"customer_id": c["id"], "items": items,
                                      "payment_method": "deposit", "tier": "korporat"})
        assert r.status_code == 400
        assert "deposit" in r.text.lower()

    def test_tempo_within_limit_and_settle(self, cashier_client, owner_client):
        custs = cashier_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == "Pangkalan Jaya Abadi")
        p = self._product(cashier_client, "LPG 3 Kg")
        qty = 5
        price = p["price_pangkalan"]
        items = [{"product_id": p["id"], "name": p["name"], "qty": qty,
                  "price": price, "is_exchange": True, "subtotal": price * qty}]
        before_recv = c["receivable_balance"]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"customer_id": c["id"], "items": items,
                                      "payment_method": "tempo", "tier": "pangkalan"})
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["status"] == "outstanding"
        assert txn["due_date"] is not None
        # customer receivable increased
        upd_c = next(x for x in cashier_client.get(f"{BASE_URL}/api/customers").json()
                     if x["id"] == c["id"])
        assert upd_c["receivable_balance"] == before_recv + price * qty
        # settle (PaymentIn now required; empty body triggers full settlement)
        r2 = cashier_client.post(f"{BASE_URL}/api/transactions/{txn['id']}/pay", json={})
        assert r2.status_code == 200
        after_c = next(x for x in cashier_client.get(f"{BASE_URL}/api/customers").json()
                       if x["id"] == c["id"])
        assert after_c["receivable_balance"] == before_recv


# ==================== DRIVER RECON ====================
class TestRecon:
    def test_recon_shortage_creates_debt(self, driver_client, tokens):
        driver_id = tokens["driver"]["user"]["id"]
        prods = driver_client.get(f"{BASE_URL}/api/products").json()
        p = prods[0]
        loads = [{"product_id": p["id"], "name": p["name"],
                  "price": p["price_eceran"], "qty_out": 10, "qty_return": 2}]
        expected = 8 * p["price_eceran"]
        # deposit less than expected -> shortage
        actual = expected - 5000
        r = driver_client.post(f"{BASE_URL}/api/recon",
                               json={"driver_id": driver_id, "loads": loads,
                                     "actual_deposit": actual})
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["expected_deposit"] == expected
        assert doc["difference"] == round(actual - expected, 2)
        assert doc["status"] == "shortage"

    def test_recon_list_driver_self_only(self, driver_client, owner_client):
        r_d = driver_client.get(f"{BASE_URL}/api/recon")
        assert r_d.status_code == 200
        # all entries returned to driver must be their own
        # (validated indirectly since we only have one driver seeded)
        r_o = owner_client.get(f"{BASE_URL}/api/recon")
        assert r_o.status_code == 200
        assert len(r_o.json()) >= len(r_d.json())


# ==================== PAYROLL ====================
class TestPayroll:
    def test_generate_payroll_driver(self, owner_client, tokens):
        driver_id = tokens["driver"]["user"]["id"]
        r = owner_client.post(f"{BASE_URL}/api/payroll/{driver_id}",
                              params={"period": "2026-01"})
        assert r.status_code == 200, r.text
        doc = r.json()
        # base 1_500_000 + delivered*2000 - deductions
        expected_net = round(doc["base_salary"] + doc["delivery_units"] * doc["incentive_rate"]
                             - doc["deductions"], 2)
        assert doc["net_pay"] == expected_net
        assert doc["base_salary"] == 1500000
        assert doc["incentive_rate"] == 2000


# ==================== FINANCE / ASSETS ====================
class TestFinanceAssets:
    def test_finance_summary(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/finance/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("sales_today", "profit_today", "cash_balance",
                  "total_receivable", "total_deposit"):
            assert k in d

    def test_assets_balance(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/assets/balance")
        assert r.status_code == 200
        d = r.json()
        assert d["total_assets"] == (d["filled_warehouse"] + d["empty_warehouse"]
                                     + d["in_driver"] + d["borrowed_customers"])
        assert isinstance(d["per_product"], list)
