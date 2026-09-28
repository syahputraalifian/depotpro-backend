"""Iteration 3 backend tests: real-time stock/sold updates + Financial Report module."""
import pytest
from tests.conftest import BASE_URL


# ==================== FIX 1 + 2: total_sold + total_hpp on transaction ====================
class TestTransactionStockAndHpp:
    def test_transaction_increments_total_sold_and_stores_total_hpp(self, cashier_client):
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        # pick a non-refill product so we exercise stock_filled decrement path too
        p = next(x for x in prods if x["name"].startswith("Le Minerale"))
        before_sold = p.get("total_sold", 0)
        before_filled = p["stock_filled"]

        qty = 2
        items = [{"product_id": p["id"], "name": p["name"], "qty": qty,
                  "price": p["price_eceran"], "is_exchange": True,
                  "subtotal": p["price_eceran"] * qty}]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"items": items, "payment_method": "cash",
                                      "tier": "eceran",
                                      "amount_paid": p["price_eceran"] * qty})
        assert r.status_code == 200, r.text
        txn = r.json()
        # total_hpp populated (hpp * qty)
        expected_hpp = round(p.get("hpp", 0) * qty, 2)
        assert txn["total_hpp"] == expected_hpp, (
            f"total_hpp={txn['total_hpp']} != expected {expected_hpp}")
        assert txn["total_hpp"] > 0

        # product refresh: total_sold += qty, stock_filled -= qty
        prods2 = cashier_client.get(f"{BASE_URL}/api/products").json()
        p2 = next(x for x in prods2 if x["id"] == p["id"])
        assert p2["total_sold"] == before_sold + qty
        assert p2["stock_filled"] == before_filled - qty


# ==================== FEATURE 3: /finance/report ====================
class TestFinanceReport:
    def _assert_shape(self, r, expected_trend_len):
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("label", "income", "income_total", "hpp_total",
                    "expenses", "expenses_total", "net_profit",
                    "outstanding_total", "trend"):
            assert key in d, f"missing {key}"
        for k in ("cash", "transfer", "qris", "deposit", "piutang"):
            assert k in d["income"], f"missing income.{k}"
        assert isinstance(d["expenses"], list)
        assert isinstance(d["trend"], list)
        assert len(d["trend"]) == expected_trend_len, (
            f"trend len={len(d['trend'])} != {expected_trend_len}")
        # net_profit = income_total - hpp_total - expenses_total
        expected_net = round(d["income_total"] - d["hpp_total"] - d["expenses_total"], 2)
        assert abs(d["net_profit"] - expected_net) < 0.01
        return d

    def test_report_daily_owner(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/finance/report", params={"period": "daily"})
        self._assert_shape(r, 7)

    def test_report_monthly_owner(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/finance/report", params={"period": "monthly"})
        self._assert_shape(r, 12)

    def test_report_yearly_owner(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/finance/report", params={"period": "yearly"})
        self._assert_shape(r, 5)

    def test_report_cashier_allowed(self, cashier_client):
        r = cashier_client.get(f"{BASE_URL}/api/finance/report", params={"period": "monthly"})
        assert r.status_code == 200
        assert "trend" in r.json()

    def test_report_driver_forbidden(self, driver_client):
        r = driver_client.get(f"{BASE_URL}/api/finance/report", params={"period": "monthly"})
        assert r.status_code == 403


# ==================== FEATURE 3: /finance/expense ====================
class TestFinanceExpense:
    def test_owner_can_add_expense_and_it_appears_in_report(self, owner_client):
        # baseline
        r0 = owner_client.get(f"{BASE_URL}/api/finance/report", params={"period": "monthly"}).json()
        base_total = r0["expenses_total"]
        # bbm existing amount (if any)
        bbm_existing = next((e["amount"] for e in r0["expenses"] if e["category"] == "bbm"), 0)

        amount = 123456
        r = owner_client.post(f"{BASE_URL}/api/finance/expense",
                              json={"category": "bbm", "amount": amount,
                                    "description": "TEST_iter3 solar"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "bbm"
        assert d["amount"] == amount
        assert d["type"] == "out"
        assert "_id" not in d  # mongo _id excluded

        # report reflects the increase
        r1 = owner_client.get(f"{BASE_URL}/api/finance/report", params={"period": "monthly"}).json()
        assert round(r1["expenses_total"] - base_total, 2) == amount
        bbm_new = next((e["amount"] for e in r1["expenses"] if e["category"] == "bbm"), 0)
        assert round(bbm_new - bbm_existing, 2) == amount

    def test_cashier_forbidden_add_expense(self, cashier_client):
        r = cashier_client.post(f"{BASE_URL}/api/finance/expense",
                                json={"category": "listrik", "amount": 10000})
        assert r.status_code == 403

    def test_driver_forbidden_add_expense(self, driver_client):
        r = driver_client.post(f"{BASE_URL}/api/finance/expense",
                               json={"category": "listrik", "amount": 10000})
        assert r.status_code == 403

    def test_all_expense_categories_accepted(self, owner_client):
        cats = ["bbm", "gaji", "listrik", "maintenance_filter",
                "penyusutan", "sewa", "lainnya"]
        for c in cats:
            r = owner_client.post(f"{BASE_URL}/api/finance/expense",
                                  json={"category": c, "amount": 1000,
                                        "description": f"TEST_iter3 {c}"})
            assert r.status_code == 200, f"{c}: {r.text}"

    def test_pembelian_supplier_excluded_from_expenses(self, owner_client, warehouse_client):
        """Receiving a PO writes a pembelian_supplier cash-out that must NOT appear
        in the operational expenses list nor inflate expenses_total."""
        prods = warehouse_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("Le Minerale"))

        # Baseline
        r0 = owner_client.get(f"{BASE_URL}/api/finance/report",
                              params={"period": "monthly"}).json()
        base_total = r0["expenses_total"]

        # Create + receive PO
        po = warehouse_client.post(f"{BASE_URL}/api/purchase-orders",
                                   json={"product_id": p["id"], "qty": 3,
                                         "supplier": "TEST_iter3 supplier"}).json()
        rec = warehouse_client.post(f"{BASE_URL}/api/purchase-orders/{po['id']}/receive")
        assert rec.status_code == 200

        r1 = owner_client.get(f"{BASE_URL}/api/finance/report",
                              params={"period": "monthly"}).json()
        # No pembelian_supplier category in report
        assert not any(e["category"] == "pembelian_supplier" for e in r1["expenses"])
        # expenses_total unchanged by this receive
        assert abs(r1["expenses_total"] - base_total) < 0.01


# ==================== Regression: /finance/summary still works ====================
class TestFinanceSummaryStillWorks:
    def test_finance_summary_owner(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/finance/summary")
        assert r.status_code == 200
