"""Iteration 2 backend tests: pricing edit, PO/reorder, settings, piutang, drivers."""
import pytest
import requests
from tests.conftest import BASE_URL


# ==================== IMPROVEMENT 1: Product price management ====================
class TestPriceManagement:
    def test_owner_edit_prices_recomputes_hpp(self, owner_client):
        prods = owner_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("Le Minerale"))
        payload = {
            "name": p["name"], "category": p["category"],
            "is_returnable": p.get("is_returnable", True),
            "cost_price": 17000, "freight_cost": 1600, "depreciation_cost": 900,
            "price_eceran": 21000, "price_warung": 19500,
            "price_pangkalan": 18500, "price_korporat": 18000,
            "deposit_amount": p.get("deposit_amount", 0),
            "stock_filled": p["stock_filled"], "stock_empty": p["stock_empty"],
            "reorder_point": p.get("reorder_point", 10),
        }
        r = owner_client.put(f"{BASE_URL}/api/products/{p['id']}", json=payload)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["price_eceran"] == 21000
        assert u["price_warung"] == 19500
        assert u["price_pangkalan"] == 18500
        assert u["price_korporat"] == 18000
        # HPP = 17000 + 1600 + 900 = 19500
        assert u["hpp"] == 19500

        # Persistence via GET
        r2 = owner_client.get(f"{BASE_URL}/api/products").json()
        updated = next(x for x in r2 if x["id"] == p["id"])
        assert updated["hpp"] == 19500
        assert updated["price_eceran"] == 21000

    def test_warehouse_can_edit_price(self, warehouse_client):
        prods = warehouse_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("Air Isi Ulang"))
        payload = {**p, "price_eceran": 6500}
        payload = {k: payload[k] for k in [
            "name", "category", "is_returnable", "cost_price", "freight_cost",
            "depreciation_cost", "price_eceran", "price_warung", "price_pangkalan",
            "price_korporat", "deposit_amount", "stock_filled", "stock_empty",
            "reorder_point"]}
        r = warehouse_client.put(f"{BASE_URL}/api/products/{p['id']}", json=payload)
        assert r.status_code == 200
        assert r.json()["price_eceran"] == 6500

    def test_cashier_forbidden_edit_product(self, cashier_client):
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        p = prods[0]
        payload = {"name": p["name"], "category": p["category"], "price_eceran": 999}
        r = cashier_client.put(f"{BASE_URL}/api/products/{p['id']}", json=payload)
        assert r.status_code == 403

    def test_driver_forbidden_edit_product(self, driver_client):
        prods = driver_client.get(f"{BASE_URL}/api/products").json()
        p = prods[0]
        payload = {"name": p["name"], "category": p["category"], "price_eceran": 999}
        r = driver_client.put(f"{BASE_URL}/api/products/{p['id']}", json=payload)
        assert r.status_code == 403

    def test_cashier_forbidden_create_product(self, cashier_client):
        r = cashier_client.post(f"{BASE_URL}/api/products",
                                json={"name": "TEST_x", "category": "lpg"})
        assert r.status_code == 403


# ==================== IMPROVEMENT 2: Reorder + PO ====================
class TestPurchaseOrders:
    def test_low_stock_and_create_po_and_receive(self, warehouse_client, owner_client):
        # Force a product into low-stock by adjusting stock down
        prods = warehouse_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("LPG 12 Kg"))
        # bring stock_filled to below reorder_point (8)
        target = 5
        delta = target - p["stock_filled"]
        warehouse_client.post(f"{BASE_URL}/api/products/{p['id']}/adjust",
                              json={"stock_filled_delta": delta, "stock_empty_delta": 0,
                                    "note": "TEST_lowstock"})
        low = warehouse_client.get(f"{BASE_URL}/api/inventory/low-stock").json()
        assert any(x["id"] == p["id"] for x in low)

        # Create PO with auto qty
        r = warehouse_client.post(f"{BASE_URL}/api/purchase-orders",
                                  json={"product_id": p["id"], "qty": 0, "supplier": "PT Test"})
        assert r.status_code == 200, r.text
        po = r.json()
        assert po["status"] == "draft"
        assert po["qty"] > 0
        assert po["est_cost"] == round(po["qty"] * po["unit_cost"], 2)
        po_id = po["id"]

        # List POs
        lst = warehouse_client.get(f"{BASE_URL}/api/purchase-orders").json()
        assert any(x["id"] == po_id for x in lst)

        # Receive PO -> stock increases + cash out entry
        before = next(x for x in warehouse_client.get(f"{BASE_URL}/api/products").json()
                      if x["id"] == p["id"])["stock_filled"]
        r2 = warehouse_client.post(f"{BASE_URL}/api/purchase-orders/{po_id}/receive")
        assert r2.status_code == 200, r2.text
        after = next(x for x in warehouse_client.get(f"{BASE_URL}/api/products").json()
                     if x["id"] == p["id"])["stock_filled"]
        assert after == before + po["qty"]

        # Receive again -> 400
        r3 = warehouse_client.post(f"{BASE_URL}/api/purchase-orders/{po_id}/receive")
        assert r3.status_code == 400

    def test_cashier_forbidden_create_po(self, cashier_client):
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        r = cashier_client.post(f"{BASE_URL}/api/purchase-orders",
                                json={"product_id": prods[0]["id"], "qty": 5})
        assert r.status_code == 403


# ==================== IMPROVEMENT 3: Settings / receipt option ====================
class TestSettings:
    def test_get_default_settings(self, owner_client):
        r = owner_client.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["default_receipt_option"] in ("print", "whatsapp", "skip")

    def test_owner_can_update_settings(self, owner_client):
        for opt in ("print", "whatsapp", "skip"):
            r = owner_client.put(f"{BASE_URL}/api/settings",
                                 json={"default_receipt_option": opt})
            assert r.status_code == 200
            assert r.json()["default_receipt_option"] == opt
            # verify persistence
            g = owner_client.get(f"{BASE_URL}/api/settings").json()
            assert g["default_receipt_option"] == opt

    def test_cashier_forbidden_update_settings(self, cashier_client):
        r = cashier_client.put(f"{BASE_URL}/api/settings",
                               json={"default_receipt_option": "print"})
        assert r.status_code == 403


# ==================== IMPROVEMENT 4: Piutang / partial payment / ledger ====================
class TestPiutang:
    def _create_tempo_sale(self, cashier_client, cust_name, qty):
        custs = cashier_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == cust_name)
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("LPG 3 Kg"))
        price = p["price_pangkalan"]
        items = [{"product_id": p["id"], "name": p["name"], "qty": qty,
                  "price": price, "is_exchange": True, "subtotal": price * qty}]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"customer_id": c["id"], "items": items,
                                      "payment_method": "tempo", "tier": "pangkalan"})
        assert r.status_code == 200, r.text
        return c, r.json()

    def test_partial_payment_and_ledger(self, cashier_client, owner_client):
        c, txn = self._create_tempo_sale(cashier_client, "Pangkalan Jaya Abadi", 3)
        total = txn["total"]
        # Partial payment
        pay1 = round(total / 3, 2)
        r = cashier_client.post(f"{BASE_URL}/api/transactions/{txn['id']}/pay",
                                json={"amount": pay1, "method": "cash", "note": "cicilan 1"})
        assert r.status_code == 200
        d = r.json()
        assert d["fully_paid"] is False
        assert d["paid"] == pay1
        assert d["remaining"] == round(total - pay1, 2)

        # Second payment (fully)
        r2 = cashier_client.post(f"{BASE_URL}/api/transactions/{txn['id']}/pay",
                                 json={"amount": total, "method": "transfer", "note": "pelunasan"})
        assert r2.status_code == 200
        assert r2.json()["fully_paid"] is True

        # Third attempt should fail (already paid)
        r3 = cashier_client.post(f"{BASE_URL}/api/transactions/{txn['id']}/pay",
                                 json={"amount": 1000, "method": "cash"})
        assert r3.status_code == 400

        # Receivable ledger should have charge + 2 payments at minimum
        hist = owner_client.get(f"{BASE_URL}/api/customers/{c['id']}/receivable-history").json()
        related = [h for h in hist if h.get("transaction_id") == txn["id"]]
        types = [h["type"] for h in related]
        assert "charge" in types
        assert types.count("payment") >= 2
        # balance_after must be present
        for h in related:
            assert "balance_after" in h

    def test_owner_adjust_receivable(self, owner_client):
        custs = owner_client.get(f"{BASE_URL}/api/customers").json()
        c = next(x for x in custs if x["name"] == "Warung Bu Siti")
        before = c["receivable_balance"]
        r = owner_client.post(f"{BASE_URL}/api/customers/{c['id']}/adjust-receivable",
                              json={"amount": 25000, "reason": "TEST_koreksi"})
        assert r.status_code == 200
        after = next(x for x in owner_client.get(f"{BASE_URL}/api/customers").json()
                     if x["id"] == c["id"])["receivable_balance"]
        assert after == before + 25000
        # revert
        owner_client.post(f"{BASE_URL}/api/customers/{c['id']}/adjust-receivable",
                         json={"amount": -25000, "reason": "TEST_revert"})
        # Ledger contains adjustment entries
        hist = owner_client.get(f"{BASE_URL}/api/customers/{c['id']}/receivable-history").json()
        adjustments = [h for h in hist if h["type"] == "adjustment"]
        assert len(adjustments) >= 2

    def test_cashier_forbidden_adjust_receivable(self, cashier_client):
        custs = cashier_client.get(f"{BASE_URL}/api/customers").json()
        r = cashier_client.post(f"{BASE_URL}/api/customers/{custs[0]['id']}/adjust-receivable",
                                json={"amount": 1000, "reason": "test"})
        assert r.status_code == 403


# ==================== IMPROVEMENT 5: Multi-driver management ====================
class TestDrivers:
    def test_owner_create_edit_disable_driver(self, owner_client):
        import uuid
        unique = uuid.uuid4().hex[:8]
        # Create
        payload = {"email": f"TEST_driver_{unique}@gasgalon.id", "password": "driver22345",
                   "name": "TEST Driver Dua", "role": "driver",
                   "base_salary": 1500000, "incentive_rate": 2000,
                   "phone": "081200000002", "vehicle_type": "Motor",
                   "plate_number": "B 1234 XYZ"}
        r = owner_client.post(f"{BASE_URL}/api/users", json=payload)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["role"] == "driver"
        assert u["vehicle_type"] == "Motor"
        assert u["plate_number"] == "B 1234 XYZ"
        assert u["phone"] == "081200000002"
        drv_id = u["id"]

        # Should appear in /users/drivers
        drivers = owner_client.get(f"{BASE_URL}/api/users/drivers").json()
        assert any(d["id"] == drv_id for d in drivers)

        # Edit
        r2 = owner_client.put(f"{BASE_URL}/api/users/{drv_id}",
                              json={"name": "TEST Driver Dua Edited",
                                    "plate_number": "B 9999 ZZZ",
                                    "vehicle_type": "Mobil"})
        assert r2.status_code == 200
        assert r2.json()["plate_number"] == "B 9999 ZZZ"
        assert r2.json()["vehicle_type"] == "Mobil"

        # Delete (soft) -> excluded from /users/drivers
        r3 = owner_client.delete(f"{BASE_URL}/api/users/{drv_id}")
        assert r3.status_code == 200
        drivers2 = owner_client.get(f"{BASE_URL}/api/users/drivers").json()
        assert not any(d["id"] == drv_id for d in drivers2)

    def test_owner_cannot_delete_self(self, owner_client, tokens):
        owner_id = tokens["owner"]["user"]["id"]
        r = owner_client.delete(f"{BASE_URL}/api/users/{owner_id}")
        assert r.status_code == 400

    def test_non_owner_forbidden_user_ops(self, cashier_client):
        r = cashier_client.post(f"{BASE_URL}/api/users",
                                json={"email": "x@x.id", "password": "12345",
                                      "name": "x", "role": "driver"})
        assert r.status_code == 403
        r2 = cashier_client.get(f"{BASE_URL}/api/users")
        assert r2.status_code == 403

    def test_txn_stores_driver_when_provided(self, cashier_client, owner_client, tokens):
        driver_id = tokens["driver"]["user"]["id"]
        prods = cashier_client.get(f"{BASE_URL}/api/products").json()
        p = next(x for x in prods if x["name"].startswith("Air Isi Ulang"))
        items = [{"product_id": p["id"], "name": p["name"], "qty": 1,
                  "price": p["price_eceran"], "is_exchange": True,
                  "subtotal": p["price_eceran"]}]
        r = cashier_client.post(f"{BASE_URL}/api/transactions",
                                json={"items": items, "payment_method": "cash",
                                      "channel": "delivery", "tier": "eceran",
                                      "amount_paid": p["price_eceran"],
                                      "driver_id": driver_id})
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["driver_id"] == driver_id
        assert txn["driver_name"] is not None
        assert txn["channel"] == "delivery"
