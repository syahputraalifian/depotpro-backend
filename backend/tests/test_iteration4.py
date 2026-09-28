"""Iteration 4 backend tests:
FIX 1+2: POST /api/products/{pid}/adjust supports 3 independent deltas
         (stock_filled_delta, total_sold_delta, stock_empty_delta) and
         CLAMPS any counter to 0 if it would otherwise go negative.
FIX 3:   POST /api/customers/{cid}/deposit accepts JSON body {amount, reason}.
         - amount > 0  -> top-up (any user)
         - amount < 0  -> owner-only (cashier / warehouse / driver = 403)
         - resulting balance < 0 -> 400
         - cash_entries: top-up = 'in/topup_deposit', reduction = 'out/koreksi_deposit'.
"""
import pytest
from tests.conftest import BASE_URL


# ==================== FIX 1+2: 3-counter stock adjust with clamp ====================
class TestStockAdjustThreeCounters:
    def _get(self, client, pid):
        prods = client.get(f"{BASE_URL}/api/products").json()
        return next(p for p in prods if p["id"] == pid)

    def _pick_lpg(self, client):
        prods = client.get(f"{BASE_URL}/api/products").json()
        return next(p for p in prods if p["category"] == "lpg")

    def test_adjust_accepts_all_three_deltas(self, warehouse_client):
        p = self._pick_lpg(warehouse_client)
        before = self._get(warehouse_client, p["id"])
        r = warehouse_client.post(
            f"{BASE_URL}/api/products/{p['id']}/adjust",
            json={"stock_filled_delta": 5, "total_sold_delta": 3, "stock_empty_delta": 2},
        )
        assert r.status_code == 200, r.text
        after = r.json()
        assert after["stock_filled"] == before["stock_filled"] + 5
        assert after["total_sold"] == before["total_sold"] + 3
        assert after["stock_empty"] == before["stock_empty"] + 2

        # persistence via subsequent GET
        after2 = self._get(warehouse_client, p["id"])
        assert after2["stock_filled"] == after["stock_filled"]
        assert after2["total_sold"] == after["total_sold"]
        assert after2["stock_empty"] == after["stock_empty"]

    def test_adjust_clamps_negative_counters_to_zero(self, warehouse_client):
        p = self._pick_lpg(warehouse_client)
        before = self._get(warehouse_client, p["id"])
        big = 10_000_000
        r = warehouse_client.post(
            f"{BASE_URL}/api/products/{p['id']}/adjust",
            json={
                "stock_filled_delta": -(before["stock_filled"] + big),
                "total_sold_delta": -(before["total_sold"] + big),
                "stock_empty_delta": -(before["stock_empty"] + big),
            },
        )
        assert r.status_code == 200, r.text
        after = r.json()
        assert after["stock_filled"] == 0
        assert after["total_sold"] == 0
        assert after["stock_empty"] == 0

    def test_adjust_forbidden_for_cashier(self, cashier_client):
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = cashier_client.post(
            f"{BASE_URL}/api/products/{pid}/adjust",
            json={"stock_filled_delta": 1, "total_sold_delta": 0, "stock_empty_delta": 0},
        )
        assert r.status_code == 403

    def test_adjust_owner_allowed(self, owner_client):
        prods = owner_client.get(f"{BASE_URL}/api/products").json()
        pid = prods[0]["id"]
        r = owner_client.post(
            f"{BASE_URL}/api/products/{pid}/adjust",
            json={"stock_filled_delta": 0, "total_sold_delta": 0, "stock_empty_delta": 0},
        )
        assert r.status_code == 200


# ==================== FIX 3: deposit adjust (top-up + reduce with role guard) ====================
class TestDepositAdjust:
    def _pick_customer_with_balance(self, client, min_bal=100_000):
        custs = client.get(f"{BASE_URL}/api/customers").json()
        return next(c for c in custs if c.get("deposit_balance", 0) >= min_bal)

    def _get_customer(self, client, cid):
        custs = client.get(f"{BASE_URL}/api/customers").json()
        return next(c for c in custs if c["id"] == cid)

    def test_topup_positive_amount_owner(self, owner_client):
        c = self._pick_customer_with_balance(owner_client, 0)
        before = c["deposit_balance"]
        r = owner_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": 50_000},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["deposit_balance"] == before + 50_000
        after = self._get_customer(owner_client, c["id"])
        assert after["deposit_balance"] == before + 50_000

    def test_topup_positive_amount_cashier_allowed(self, cashier_client):
        c = self._pick_customer_with_balance(cashier_client, 0)
        before = c["deposit_balance"]
        r = cashier_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": 25_000},
        )
        assert r.status_code == 200, r.text
        after = self._get_customer(cashier_client, c["id"])
        assert after["deposit_balance"] == before + 25_000

    def test_reduce_deposit_owner_ok(self, owner_client):
        c = self._pick_customer_with_balance(owner_client, 100_000)
        before = c["deposit_balance"]
        r = owner_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": -30_000, "reason": "TEST_iter4 pengembalian tunai"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["deposit_balance"] == before - 30_000
        # persisted
        after = self._get_customer(owner_client, c["id"])
        assert after["deposit_balance"] == before - 30_000

    def test_reduce_deposit_cashier_forbidden(self, cashier_client):
        c = self._pick_customer_with_balance(cashier_client, 100_000)
        r = cashier_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": -10_000, "reason": "TEST_iter4"},
        )
        assert r.status_code == 403

    def test_reduce_deposit_driver_forbidden(self, driver_client):
        custs = driver_client.get(f"{BASE_URL}/api/customers").json()
        c = next(c for c in custs if c.get("deposit_balance", 0) >= 100_000)
        r = driver_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": -10_000, "reason": "TEST_iter4"},
        )
        assert r.status_code == 403

    def test_reduce_below_zero_rejected(self, owner_client):
        c = self._pick_customer_with_balance(owner_client, 0)
        # Attempt to reduce more than current balance
        r = owner_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": -(c["deposit_balance"] + 1_000_000), "reason": "TEST_iter4 overflow"},
        )
        assert r.status_code == 400
        # balance unchanged
        after = self._get_customer(owner_client, c["id"])
        assert after["deposit_balance"] == c["deposit_balance"]

    def test_reduce_logs_koreksi_deposit_cash_out(self, owner_client):
        c = self._pick_customer_with_balance(owner_client, 100_000)
        r = owner_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": -5_000, "reason": "TEST_iter4 audit koreksi"},
        )
        assert r.status_code == 200, r.text
        cashflow = owner_client.get(f"{BASE_URL}/api/finance/cashflow").json()
        # find an out/koreksi_deposit entry for this customer
        assert any(
            e.get("type") == "out"
            and e.get("category") == "koreksi_deposit"
            and c["name"] in (e.get("description") or "")
            for e in cashflow
        ), "koreksi_deposit cash-out entry not found in cashflow"

    def test_topup_logs_topup_deposit_cash_in(self, owner_client):
        c = self._pick_customer_with_balance(owner_client, 0)
        r = owner_client.post(
            f"{BASE_URL}/api/customers/{c['id']}/deposit",
            json={"amount": 15_000},
        )
        assert r.status_code == 200, r.text
        cashflow = owner_client.get(f"{BASE_URL}/api/finance/cashflow").json()
        assert any(
            e.get("type") == "in"
            and e.get("category") == "topup_deposit"
            and c["name"] in (e.get("description") or "")
            for e in cashflow
        )


# ==================== Regression: login for all 4 seeded roles ====================
class TestLoginAllRoles:
    def test_all_roles_have_tokens(self, tokens):
        for role in ("owner", "cashier", "warehouse", "driver"):
            assert tokens[role]["token"], f"missing token for {role}"
            assert tokens[role]["user"]["role"] in (
                "owner", "cashier", "warehouse_admin", "driver"
            )
