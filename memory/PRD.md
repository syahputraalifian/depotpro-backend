# PRD — GasGalon ERP & POS

## Problem Statement
Sistem aplikasi manajemen bisnis terpadu (ERP & POS) untuk usaha Agen LPG, Air Mineral (Galon/Kemasan Brand), dan Air Isi Ulang (Depot). Multi-channel (POS toko, antar rumahan, distribusi B2B pangkalan dengan harga bertingkat), siklus tabung/galon kosong (deposit, tukar, pinjam, retur), depot air isi ulang, dan logistik kurir dengan rekonsiliasi harian.

## Architecture
- **Frontend**: Expo React Native (expo-router file-based, 4-role tab navigation), @tanstack/react-query available, theme tokens in src/theme.ts (Emerald professional palette).
- **Backend**: FastAPI + MongoDB (motor), JWT auth (passlib bcrypt), all routes under `/api`.
- **Auth**: 4 roles — owner, cashier, warehouse_admin, driver. Server-enforced RBAC via `require_roles`.
- Data model uses uuid string IDs (no ObjectId serialization issues).

## User Personas
- **Pemilik (owner)**: full access, dashboard KPI, finance, payroll.
- **Kasir (cashier)**: POS, pelanggan, transaksi.
- **Admin Gudang (warehouse_admin)**: stok & aset produk, pembelian supplier.
- **Driver/Kurir**: rekonsiliasi setoran harian.

## Core Requirements (static)
- Multi-tier B2B pricing (eceran, warung, pangkalan, korporat).
- Dual inventory: stock_filled (Isi) vs stock_empty (Kosong wadah/aset) + reorder point warning.
- Payment methods: cash, transfer, qris, tempo, deposit.
- Digital receipt via WhatsApp share.
- Calculation logic: HPP, B2B Credit Control, Driver Reconciliation, Payroll, Asset Balance (Neraca Wadah).

## Implemented (2026-09-27)
- JWT login + 4 roles with role-based tab visibility. Seeded users, 5 products, 3 customers.
- **POS/Kasir**: category chips, product stepper, tukar-tabung toggle, customer selector, tier pricing, payment methods, checkout + WhatsApp receipt.
- **Stok**: segmented categories, dual Isi/Kosong stats, low-stock banner, add product (auto HPP), stock adjust.
- **Pelanggan/CRM**: list, add, deposit top-up, receivable settle, transaction history.
- **Driver Reconciliation**: qty out/return per product, auto expected-deposit & difference, shortage → driver debt.
- **Dashboard**: KPI (sales/profit/receivable/cash), Neraca Aset Wadah, low stock, recent transactions.
- **Finance**: cash entries (in/out), summary (P&L today, cash balance, receivable, payable, deposit), cashflow, receivables list.
- **Backend calc modules**: HPP auto, B2B credit control (deposit + tempo + >7 day outstanding), driver recon, payroll, asset balance — all verified (23/23 backend tests pass).

## Backlog (prioritized)
- **P1**: Payroll UI screen (backend ready), supplier purchase & utang UI, absensi/attendance, PDF receipt (currently WhatsApp text).
- **P1**: Depot daily production log (air baku m3, filter maintenance, produksi vs terjual) UI + endpoints.
- **P2**: Borrowed-container (pinjam/sewa) full lifecycle + retur tabung rusak/bocor tracking.
- **P2**: Monthly P&L / cashflow charts, operational expense categories (BBM, gaji, filter, penyusutan armada), simple balance sheet report.
- **P2**: Offline mode for POS/driver, QRIS integration, thermal Bluetooth printing (needs native build).

## Implemented (2026-09-28) — Iteration 2 (5 improvement areas)
- **Price/Catalog management**: owner/warehouse edit all tier prices + HPP via Stok "Edit Harga" (PUT /products), recomputes HPP; cashier/driver read-only (403). Real-time sync to POS/Driver on focus.
- **Reorder automation & Purchase Orders**: auto stock decrement on sale; red "Perlu Reorder"/"STOK KRITIS" banners; one-click "Buat PO" on Stok + Dashboard; PO drafts sheet with badge + "Terima Stok" (adds stock, logs cash-out). Endpoints /purchase-orders (+ /receive).
- **Flexible receipt options**: after checkout modal with 3 choices (Cetak via expo-print, Kirim WA, Tanpa Struk). Owner "Opsi Struk Bawaan" in /settings (print/whatsapp/skip) via /settings API.
- **Piutang management**: partial/installment payments (amount+method+note) via /transactions/{id}/pay; owner "Koreksi Piutang" adjustment with reason; "Mutasi Piutang" ledger tab (charge/payment/adjustment + balance_after). New receivable_ledger collection.
- **Multi-driver/fleet**: /manage-users screen (owner) add/edit/soft-delete drivers with phone/vehicle_type/plate_number; POS "Antar" channel with courier picker; transaction stores driver_id/driver_name; recon report per driver.
- Verified: 40/40 backend tests pass, frontend flows functional.

## Next Tasks
- Add depot production module (bahan baku & filter) — explicitly in original spec.
- Add supplier purchase + accounts payable UI (backend /purchases + /payables exist).
- Add payroll generation screen for owner (backend ready).
- Per-courier daily cash reconciliation report view (data already keyed by driver_id).
