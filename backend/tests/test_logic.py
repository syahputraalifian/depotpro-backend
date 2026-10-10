"""Tes logika bisnis murni (tanpa Mongo / server). Jalankan: python -m unittest discover -s tests -v"""
import os
import sys
import unittest
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import logic as L  # noqa: E402


class RoleTests(unittest.TestCase):
    def test_alias(self):
        self.assertEqual(L.normalize_role("Kasir"), "cashier")
        self.assertEqual(L.normalize_role(" gudang "), "warehouse_admin")
        self.assertEqual(L.normalize_role("kurir"), "driver")
        self.assertIsNone(L.normalize_role("hacker"))
        self.assertIsNone(L.normalize_role(None))


class ProductTests(unittest.TestCase):
    def test_kind_detection(self):
        self.assertEqual(L.product_kind({"name": "LPG 3 Kg", "category": "lpg"}), "lpg")
        self.assertEqual(L.product_kind({"name": "Gas Elpiji 3kg Melon", "category": "LPG"}), "lpg")
        self.assertEqual(L.product_kind({"name": "Air Isi Ulang Galon 19L", "category": "Air Isi Ulang"}), "galon")
        self.assertEqual(L.product_kind({"name": "Galon Aqua", "category": "AMDK"}), "galon")
        self.assertEqual(L.product_kind({"name": "AMDK Dus Aqua Gelas 220ml", "category": "amdk"}), "other")

    def test_shape_maps_android_fields(self):
        lpg = L.shape_product({"_id": "x", "name": "LPG 3 Kg", "category": "lpg", "stock": 80, "stock_empty": 60, "price": 19000,
                               "cost_price": 16000, "freight_cost": 1000, "depreciation_cost": 1000, "reorder_point": 10})
        self.assertNotIn("_id", lpg)
        self.assertEqual(lpg["stock_filled"], 80)
        self.assertEqual(lpg["empty_lpg_stock"], 60)
        self.assertEqual(lpg["empty_gallon_stock"], 0)
        self.assertEqual(lpg["hpp"], 18000.0)
        self.assertFalse(lpg["low_stock"])
        gal = L.shape_product({"name": "Galon", "category": "water", "stock_filled": 5, "stock_empty": 7, "price": 5000, "reorder_point": 5})
        self.assertEqual(gal["empty_gallon_stock"], 7)
        self.assertTrue(gal["low_stock"])

    def test_negative_stock_clamped(self):
        self.assertEqual(L.shape_product({"name": "x", "stock_filled": -4, "price": 1})["stock_filled"], 0)

    def test_price_resolution(self):
        p = {"price": 19000, "price_pangkalan": 17500}
        self.assertEqual(L.resolve_unit_price(p), 19000)
        self.assertEqual(L.resolve_unit_price(p, "pangkalan"), 17500)
        self.assertEqual(L.resolve_unit_price(p, "warung"), 19000)  # tier tak ada -> harga eceran
        self.assertEqual(L.resolve_unit_price({"price_eceran": 5000}), 5000)
        with self.assertRaises(ValueError):
            L.resolve_unit_price({"price": 0})


class PaymentTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(L.normalize_payment("Cash"), "cash")
        self.assertEqual(L.normalize_payment(None), "cash")
        self.assertEqual(L.normalize_payment("QRIS"), "qris")
        self.assertEqual(L.normalize_payment("bitcoin"), "")

    def test_receivable_status(self):
        self.assertEqual(L.receivable_status(100, 0), "unpaid")
        self.assertEqual(L.receivable_status(100, 40), "partial")
        self.assertEqual(L.receivable_status(100, 100), "paid")
        self.assertEqual(L.receivable_status(0, 0), "unpaid")


class DriverTests(unittest.TestCase):
    def test_take_home(self):
        d = L.shape_driver({"name": "Budi", "gallons_delivered": 35, "lpg_delivered": 12})
        # 25000 + 35*750 + 12*500 + 10000
        self.assertEqual(d["take_home_pay"], 25000 + 26250 + 6000 + 10000)
        self.assertEqual(d["total_incentive"], 32250)

    def test_defaults_filled(self):
        d = L.shape_driver({"name": "Joko"})
        self.assertEqual(d["completed_deliveries"], 0)
        self.assertEqual(d["status"], "available")

    def test_deductions_never_negative_pay(self):
        d = L.shape_driver({"name": "A", "base_salary": 1000, "fuel_allowance": 0, "deductions": 99999})
        self.assertEqual(d["take_home_pay"], 0.0)


def order(day_iso, total, status="completed", hpp=None, kind="galon", qty=1):
    return {"created_at": day_iso, "total_amount": total, "status": status, "total_hpp": hpp,
            "items": [{"kind": kind, "qty": qty, "hpp": 100}]}


class ReportTests(unittest.TestCase):
    def test_wib_day_boundary(self):
        # 2026-10-09 18:30 UTC == 2026-10-10 01:30 WIB -> hari ini (10 Okt) menurut WIB
        o = order("2026-10-09T18:30:00+00:00", 1000)
        self.assertEqual(L.local_date(o["created_at"]), date(2026, 10, 10))
        self.assertEqual(L.sum_sales([o], day=date(2026, 10, 10)), 1000)
        self.assertEqual(L.sum_sales([o], day=date(2026, 10, 9)), 0)

    def test_summary_excludes_cancelled_and_non_operating(self):
        today = date(2026, 10, 10)
        orders = [
            order("2026-10-10T03:00:00+00:00", 50000, hpp=30000),
            order("2026-10-10T04:00:00+00:00", 99999, status="cancelled", hpp=1),
            order("2026-10-01T04:00:00+00:00", 20000, hpp=10000, kind="lpg", qty=2),
        ]
        expenses = [{"category": "Bensin", "amount": 5000}, {"category": "pembelian_supplier", "amount": 77777},
                    {"category": "koreksi_deposit", "amount": 1}]
        recs = [{"total_amount": 100, "paid_amount": 40, "status": "partial"}, {"total_amount": 500, "paid_amount": 0, "status": "cancelled"}]
        prods = [{"name": "LPG", "category": "lpg", "stock_filled": 1, "stock_empty": 3, "reorder_point": 5, "price": 1},
                 {"name": "Galon", "category": "water", "stock_filled": 50, "stock_empty": 9, "reorder_point": 5, "price": 1}]
        s = L.build_summary(orders, expenses, recs, prods, today)
        self.assertEqual(s["total_sales"], 70000)
        self.assertEqual(s["today_sales"], 50000)
        self.assertEqual(s["month_sales"], 70000)
        self.assertEqual(s["total_orders"], 2)
        self.assertEqual(s["total_hpp"], 40000)
        self.assertEqual(s["total_expenses"], 5000)
        self.assertEqual(s["total_receivables"], 60)
        self.assertEqual(s["net_profit"], 70000 - 40000 - 5000)
        self.assertEqual(s["gallons_sold"], 1)
        self.assertEqual(s["lpg_sold"], 2)
        self.assertEqual(s["empty_lpg"], 3)
        self.assertEqual(s["empty_gallons"], 9)
        self.assertEqual(s["low_stock_count"], 1)
        self.assertEqual(len(s["daily_sales"]), 7)
        self.assertEqual(s["daily_sales"][-1]["amount"], 50000)
        self.assertEqual(s["daily_sales"][-1]["date"], "2026-10-10")

    def test_net_profit_can_be_negative(self):
        s = L.build_summary([order("2026-10-10T03:00:00+00:00", 100, hpp=50)], [{"category": "x", "amount": 1000}], [], [], date(2026, 10, 10))
        self.assertLess(s["net_profit"], 0)

    def test_day_labels(self):
        days = L.daily_sales([], 7, date(2026, 10, 10))  # Sabtu
        self.assertEqual(days[-1]["day"], "Sab")
        self.assertEqual(days[0]["day"], "Min")


class TimeTests(unittest.TestCase):
    def test_parse(self):
        self.assertIsNone(L.parse_dt("bukan tanggal"))
        self.assertEqual(L.parse_dt("2026-10-10T00:00:00").tzinfo, timezone.utc)
        self.assertIsNotNone(L.parse_dt("2026-10-10T00:00:00Z"))


if __name__ == "__main__":
    unittest.main()
