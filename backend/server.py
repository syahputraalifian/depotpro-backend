"""DepotPro / GasGalon ERP - backend FastAPI + MongoDB.

Semua rute tersedia di prefix ``/api`` (dan juga tanpa prefix untuk kompatibilitas lama).
"""
from __future__ import annotations

import logging
import os
import secrets
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import bcrypt
import jwt
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool

try:  # python-dotenv opsional
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:  # pragma: no cover
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))

from logic import (  # noqa: E402
    DRIVER_DEFAULTS,
    ORDER_STATUSES,
    PRICE_TYPES,
    VALID_ROLES,
    build_summary,
    driver_take_home,
    normalize_payment,
    normalize_role,
    now_iso,
    now_utc,
    parse_dt,
    product_kind,
    receivable_status,
    resolve_unit_price,
    shape_driver,
    shape_product,
    sum_sales,
    to_float,
    to_int,
    today_wib,
    WIB,
)

# ==========================================
# KONFIGURASI
# ==========================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("depotpro")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(48)
    logger.warning(
        "JWT_SECRET belum diset di environment. Memakai secret acak sementara: "
        "semua sesi login akan hilang setiap server restart. Set JWT_SECRET di Render/.env."
    )


def _first_env(*names: str) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


MONGO_URI = _first_env("MONGO_URL", "MONGO_URI", "MONGODB_URL", "MONGODB_URI", "DATABASE_URL") or "mongodb://localhost:27017"
DB_NAME = os.getenv("DB_NAME", "gasgalon_erp")
SEED_DEMO_USERS = os.getenv("SEED_DEMO_USERS", "true").strip().lower() not in {"0", "false", "no"}

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000,http://localhost:8081").split(",") if o.strip()]

client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=8000)
db = client[DB_NAME]

security = HTTPBearer(auto_error=False)

DEMO_USERS = [
    ("owner@gasgalon.id", "owner12345", "owner", "Pemilik Depot"),
    ("kasir@gasgalon.id", "kasir12345", "cashier", "Kasir Depot"),
    ("gudang@gasgalon.id", "gudang12345", "warehouse_admin", "Staf Gudang"),
    ("driver@gasgalon.id", "driver12345", "driver", "Driver Kurir"),
]

DEFAULT_SEEDED_PRODUCTS = [
    {"id": "4b4c6cda-64b7-4fde-a0c4-c8b0b1a2a2e3", "name": "LPG 3 Kg (Melon)", "category": "lpg", "cost_price": 16000.0,
     "freight_cost": 1000.0, "depreciation_cost": 1000.0, "price": 19000.0, "stock_filled": 80, "stock_empty": 60,
     "reorder_point": 10, "unit": "tabung"},
    {"id": "10b17ca7-b8a4-4158-b9df-9e26925cd4c9", "name": "Air Isi Ulang Galon 19L", "category": "water", "cost_price": 1500.0,
     "freight_cost": 500.0, "depreciation_cost": 500.0, "price": 5000.0, "stock_filled": 150, "stock_empty": 120,
     "reorder_point": 20, "unit": "galon"},
    {"id": "20c28db8-c9b5-5169-c0df-af37036de5d0", "name": "Galon Aqua 19L (Tukar Isi)", "category": "water", "cost_price": 16000.0,
     "freight_cost": 1000.0, "depreciation_cost": 1000.0, "price": 19000.0, "stock_filled": 45, "stock_empty": 30,
     "reorder_point": 10, "unit": "galon"},
    {"id": "30d39ec9-d0c6-6270-d1e0-bf48147ef6e1", "name": "AMDK Dus Aqua Gelas 220ml", "category": "amdk", "cost_price": 22500.0,
     "freight_cost": 1000.0, "depreciation_cost": 500.0, "price": 26000.0, "stock_filled": 35, "stock_empty": 0,
     "reorder_point": 5, "unit": "dus"},
    {"id": "50f51fe1-f2e8-8492-f3f2-d1fa369a8f03", "name": "Bright Gas 5.5 Kg", "category": "lpg", "cost_price": 68000.0,
     "freight_cost": 2000.0, "depreciation_cost": 2000.0, "price": 78000.0, "stock_filled": 20, "stock_empty": 15,
     "reorder_point": 5, "unit": "tabung"},
]


# ==========================================
# UTIL
# ==========================================
def new_id() -> str:
    return str(uuid.uuid4())


def clean(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    return {k: v for k, v in doc.items() if k != "_id"}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


_MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
_DAYS_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


def label_datetime(value: Any) -> str:
    dt = parse_dt(value)
    if not dt:
        return str(value or "")
    w = dt.astimezone(WIB)
    return f"{_DAYS_ID[w.weekday()]}, {w.day:02d} {_MONTHS_ID[w.month - 1]} {w.year} - {w:%H:%M} WIB"


def shape_order(doc: Dict[str, Any]) -> Dict[str, Any]:
    o = clean(doc) or {}
    o.setdefault("payment_method", o.get("payment_type") or "cash")
    o["payment_type"] = o["payment_method"]
    o["created_at_label"] = label_datetime(o.get("created_at"))
    items = []
    for item in o.get("items", []):
        item = dict(item)
        item["quantity"] = to_int(item.get("qty", item.get("quantity")))
        item["qty"] = item["quantity"]
        items.append(item)
    o["items"] = items
    return o


def http_error(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


# ==========================================
# AUTH & ROLE
# ==========================================
def create_access_token(email: str, password_version: int = 0) -> str:
    expire = now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": email, "pv": password_version, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not creds or not creds.credentials:
        raise http_error(status.HTTP_401_UNAUTHORIZED, "Token autentikasi tidak ditemukan")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise http_error(status.HTTP_401_UNAUTHORIZED, "Token tidak valid atau kadaluwarsa")

    email = str(payload.get("sub") or "").lower().strip()
    if not email:
        raise http_error(status.HTTP_401_UNAUTHORIZED, "Payload token tidak valid")

    user = await db.users.find_one({"email": email})
    if not user:
        raise http_error(status.HTTP_401_UNAUTHORIZED, "Pengguna tidak ditemukan")
    if user.get("active", True) is False:
        raise http_error(status.HTTP_403_FORBIDDEN, "Akun telah dinonaktifkan")

    # Invalidate token bila password diganti setelah token diterbitkan
    token_pv = to_int(payload.get("pv"))
    user_pv = to_int(user.get("password_version"))
    if token_pv < user_pv:
        raise http_error(status.HTTP_401_UNAUTHORIZED, "Sesi telah berakhir karena password diganti")

    return user


def require_roles(*allowed: str):
    allowed_set = {normalize_role(r) for r in allowed}

    async def _checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role = normalize_role(user.get("role"))
        if role not in allowed_set and role != "owner":
            raise http_error(status.HTTP_403_FORBIDDEN, "Anda tidak memiliki izin untuk fitur ini")
        return user

    return _checker


OWNER = ["owner"]
STAFF = ["owner", "cashier", "warehouse_admin"]
ALL_ROLES = ["owner", "cashier", "warehouse_admin", "driver"]


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "role": u.get("role"),
        "base_salary": to_float(u.get("base_salary")),
        "incentive_rate": to_float(u.get("incentive_rate")),
    }


# ==========================================
# THROTTLING LOGIN FAILURES
# ==========================================
_login_failures: Dict[str, List[float]] = {}


def _throttle_check(key: str) -> None:
    now = time.time()
    attempts = [t for t in _login_failures.get(key, []) if now - t < 300]
    _login_failures[key] = attempts
    if len(attempts) >= 5:
        raise http_error(429, "Terlalu banyak percobaan login gagal. Coba lagi dalam 5 menit.")


def _throttle_fail(key: str) -> None:
    now = time.time()
    attempts = [t for t in _login_failures.get(key, []) if now - t < 300]
    attempts.append(now)
    _login_failures[key] = attempts


# ==========================================
# DATABASE STARTUP & MIGRATIONS
# ==========================================
async def _ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.expenses.create_index("id", unique=True)
    await db.receivables.create_index("id", unique=True)


async def seed_database() -> None:
    if SEED_DEMO_USERS:
        for email, password, role, name in DEMO_USERS:
            hashed = await run_in_threadpool(hash_password, password)
            existing = await db.users.find_one({"email": email})
            if not existing:
                await db.users.insert_one({
                    "id": new_id(), "email": email, "username": email, "name": name, "role": role,
                    "hashed_password": hashed, "password_version": 0, "active": True, "created_at": now_iso(),
                })
                logger.info("User demo dibuat: %s", email)
            else:
                await db.users.update_one({"email": email}, {"$set": {"hashed_password": hashed, "role": role, "active": True}})
                logger.info("User demo diperbarui: %s", email)
    if await db.products.count_documents({}) == 0:
        for p in DEFAULT_SEEDED_PRODUCTS:
            await db.products.update_one({"id": p["id"]}, {"$set": {**p, "stock": p["stock_filled"], "total_sold": 0}}, upsert=True)
        logger.info("Produk awal dibuat")


async def _migrate_legacy() -> None:
    # Produk lama yang hanya punya field `stock`
    await db.products.update_many({"stock_filled": {"$exists": False}}, [{"$set": {"stock_filled": {"$ifNull": ["$stock", 0]}}}])
    await db.products.update_many({"stock_empty": {"$exists": False}}, {"$set": {"stock_empty": 0}})
    await db.products.update_many({"total_sold": {"$exists": False}}, {"$set": {"total_sold": 0}})
    # User lama tanpa id
    async for u in db.users.find({"id": {"$exists": False}}, {"_id": 1}):
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"id": new_id()}})


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Tiap tahap berdiri sendiri: kegagalan satu tahap tidak menggagalkan yang lain,
    # dan server tetap hidup agar /health bisa melaporkan masalahnya.
    for label, step in (("index", _ensure_indexes), ("migrasi", _migrate_legacy), ("seed", seed_database)):
        try:
            await step()
        except Exception:
            logger.exception("Inisialisasi database tahap '%s' gagal (cek MONGO_URL / koneksi)", label)
    logger.info("Startup selesai")
    yield
    client.close()


app = FastAPI(title="DepotPro ERP Backend", version="2.0.0", lifespan=lifespan)
allow_all = "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else CORS_ORIGINS,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter()


@api.get("/")
async def root():
    return {"status": "ok", "message": "DepotPro ERP Backend Active"}


@api.get("/health")
async def health():
    try:
        await client.admin.command("ping")
        return {"status": "ok", "database": "up"}
    except Exception as exc:
        raise http_error(503, f"Database tidak dapat dihubungi: {type(exc).__name__}")


# ------------------------------------------------------------------ auth
@api.post("/auth/login")
async def login(payload: Dict[str, Any] = Body(...)):
    identifier = str(payload.get("email") or payload.get("username") or payload.get("identifier") or "").strip().lower()
    password = str(payload.get("password") or "")
    if not identifier or not password:
        raise http_error(400, "Email dan password wajib diisi")

    _throttle_check(identifier)
    user = await db.users.find_one({"$or": [{"email": identifier}, {"username": identifier}]})
    hashed = (user or {}).get("hashed_password") or (user or {}).get("password_hash")
    ok = bool(user and hashed and await run_in_threadpool(verify_password, password, hashed))

    # Demo accounts fallback if user is missing or hash is stale/corrupted in MongoDB
    if not ok:
        demo_match = next((d for d in DEMO_USERS if d[0] == identifier and d[1] == password), None)
        if demo_match:
            demo_email, demo_pwd, demo_role, demo_name = demo_match
            new_hash = await run_in_threadpool(hash_password, demo_pwd)
            uid = (user or {}).get("id") or new_id()
            user_doc = {
                "id": uid, "email": demo_email, "username": demo_email, "name": demo_name,
                "role": demo_role, "hashed_password": new_hash, "password_version": 0,
                "active": True, "created_at": now_iso()
            }
            await db.users.update_one({"email": demo_email}, {"$set": user_doc}, upsert=True)
            user = await db.users.find_one({"email": demo_email})
            ok = True

    if not ok:
        _throttle_fail(identifier)
        raise http_error(401, "Email atau password salah")

    if user.get("active", True) is False:
        raise http_error(403, "Akun dinonaktifkan")
    role = normalize_role(user.get("role"))
    if role is None:
        raise http_error(403, "Role pengguna tidak valid")

    _login_failures.pop(identifier, None)
    email = str(user.get("email") or identifier).lower()
    token = create_access_token(email, to_int(user.get("password_version")))
    info = public_user(user)
    info["role"] = role
    return {"access_token": token, "token_type": "bearer", "user": info}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    info = public_user(user)
    info["role"] = normalize_role(user.get("role"))
    return info


class ChangePasswordIn(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: Dict[str, Any] = Depends(get_current_user)):
    hashed = user.get("hashed_password") or ""
    if not await run_in_threadpool(verify_password, body.old_password, hashed):
        raise http_error(400, "Password lama salah")

    new_hash = await run_in_threadpool(hash_password, body.new_password)
    pv = to_int(user.get("password_version")) + 1
    await db.users.update_one({"id": user["id"]}, {"$set": {"hashed_password": new_hash, "password_version": pv}})

    new_token = create_access_token(user["email"], pv)
    return {"status": "ok", "message": "Password berhasil diganti", "access_token": new_token}


# ------------------------------------------------------------------ user management (owner only)
class UserIn(BaseModel):
    email: str
    name: str
    role: str
    password: str = Field(..., min_length=6)
    base_salary: float = 0.0
    incentive_rate: float = 0.0


@api.get("/users")
async def list_users(_: Dict[str, Any] = Depends(require_roles(*OWNER))):
    users = []
    async for u in db.users.find({}):
        users.append(public_user(u))
    return users


@api.post("/users", status_code=201)
async def create_user(body: UserIn, _: Dict[str, Any] = Depends(require_roles(*OWNER))):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise http_error(400, "Format email tidak valid")
    role = normalize_role(body.role)
    if not role:
        raise http_error(400, f"Role '{body.role}' tidak valid. Pilihan: {sorted(VALID_ROLES)}")

    if await db.users.find_one({"email": email}):
        raise http_error(400, "Email sudah terdaftar")

    hashed = await run_in_threadpool(hash_password, body.password)
    uid = new_id()
    doc = {
        "id": uid, "email": email, "username": email, "name": body.name.strip(),
        "role": role, "hashed_password": hashed, "password_version": 0, "active": True,
        "base_salary": max(0.0, body.base_salary), "incentive_rate": max(0.0, body.incentive_rate),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, payload: Dict[str, Any] = Body(...), current: Dict[str, Any] = Depends(require_roles(*OWNER))):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise http_error(404, "User tidak ditemukan")

    sets: Dict[str, Any] = {}
    if "name" in payload:
        sets["name"] = str(payload["name"]).strip()
    if "role" in payload:
        r = normalize_role(payload["role"])
        if not r:
            raise http_error(400, "Role tidak valid")
        sets["role"] = r
    if "base_salary" in payload:
        sets["base_salary"] = max(0.0, to_float(payload["base_salary"]))
    if "incentive_rate" in payload:
        sets["incentive_rate"] = max(0.0, to_float(payload["incentive_rate"]))
    if "active" in payload:
        active = bool(payload["active"])
        if not active and u["id"] == current["id"]:
            raise http_error(400, "Pemilik tidak bisa menonaktifkan akun sendiri")
        sets["active"] = active
    if "password" in payload and str(payload["password"]).strip():
        pw = str(payload["password"]).strip()
        if len(pw) < 6:
            raise http_error(400, "Password minimal 6 karakter")
        sets["hashed_password"] = await run_in_threadpool(hash_password, pw)
        sets["password_version"] = to_int(u.get("password_version")) + 1

    if sets:
        await db.users.update_one({"id": user_id}, {"$set": sets})
    updated = await db.users.find_one({"id": user_id})
    return public_user(updated or u)


# ------------------------------------------------------------------ products
@api.get("/products")
async def list_products(_: Dict[str, Any] = Depends(get_current_user)):
    items = []
    async for p in db.products.find({}):
        items.append(shape_product(p))
    return items


class ProductIn(BaseModel):
    name: str
    category: str = "water"
    price: float = 0.0
    cost_price: float = 0.0
    freight_cost: float = 0.0
    depreciation_cost: float = 0.0
    stock_filled: int = 0
    stock_empty: int = 0
    reorder_point: int = 5
    unit: str = "pcs"


@api.post("/products", status_code=201)
@api.put("/products/{product_id}")
async def upsert_product(body: ProductIn, product_id: Optional[str] = None, _: Dict[str, Any] = Depends(require_roles(*STAFF))):
    pid = product_id or new_id()
    doc = {
        "id": pid, "name": body.name.strip(), "category": body.category.strip().lower(),
        "price": max(0.0, body.price), "cost_price": max(0.0, body.cost_price),
        "freight_cost": max(0.0, body.freight_cost), "depreciation_cost": max(0.0, body.depreciation_cost),
        "stock_filled": max(0, body.stock_filled), "stock": max(0, body.stock_filled),
        "stock_empty": max(0, body.stock_empty), "reorder_point": max(0, body.reorder_point),
        "unit": body.unit.strip() or "pcs", "updated_at": now_iso(),
    }
    await db.products.update_one({"id": pid}, {"$set": doc}, upsert=True)
    stored = await db.products.find_one({"id": pid})
    return shape_product(stored or doc)


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, _: Dict[str, Any] = Depends(require_roles(*OWNER))):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise http_error(404, "Produk tidak ditemukan")
    return {"status": "ok", "message": "Produk berhasil dihapus"}


# ------------------------------------------------------------------ sales / checkout
class OrderItemIn(BaseModel):
    product_id: str
    qty: int = Field(..., gt=0)


class TransactionIn(BaseModel):
    id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = "Pelanggan Umum"
    driver_id: Optional[str] = None
    payment_method: str = "cash"
    items: List[OrderItemIn]


@api.post("/transactions", status_code=201)
@api.post("/orders", status_code=201)
async def create_sale(body: TransactionIn, user: Dict[str, Any] = Depends(require_roles(*STAFF))) -> Dict[str, Any]:
    tx_id = body.id or new_id()

    # Idempotensi: bila order id sudah ada, kembalikan transaksi lama tanpa potong stok lagi
    existing = await db.orders.find_one({"id": tx_id})
    if existing:
        return shape_order(existing)

    if not body.items:
        raise http_error(400, "Keranjang belanja tidak boleh kosong")

    # Grouping item dengan product_id sama
    grouped: Dict[str, int] = {}
    for it in body.items:
        grouped[it.product_id] = grouped.get(it.product_id, 0) + it.qty

    # 1. Validasi keberadaan produk & stok di server
    server_items = []
    total_sales = 0.0
    total_hpp = 0.0
    prod_docs: Dict[str, Dict[str, Any]] = {}

    for pid, qty in grouped.items():
        p = await db.products.find_one({"id": pid})
        if not p:
            raise http_error(400, f"Produk ID '{pid}' tidak ditemukan di server")
        prod_docs[pid] = p

        s_filled = to_int(p.get("stock_filled", p.get("stock")))
        if s_filled < qty:
            raise http_error(400, f"Stok '{p.get('name')}' tidak mencukupi (sisa: {s_filled}, dibutuhkan: {qty})")

        unit_price = resolve_unit_price(p)
        if unit_price <= 0:
            raise http_error(400, f"Harga produk '{p.get('name')}' belum diatur dengan benar di server")

        cost = to_float(p.get("cost_price")) + to_float(p.get("freight_cost")) + to_float(p.get("depreciation_cost"))
        subtotal = round(unit_price * qty, 2)
        sub_hpp = round(cost * qty, 2)

        total_sales += subtotal
        total_hpp += sub_hpp

        server_items.append({
            "product_id": pid,
            "product_name": p.get("name"),
            "qty": qty,
            "quantity": qty,
            "price": unit_price,
            "cost_price": cost,
            "subtotal": subtotal,
        })

    # 2. Kurangi stok secara atomik
    for pid, qty in grouped.items():
        p = prod_docs[pid]
        kind = product_kind(p)
        inc: Dict[str, int] = {"stock_filled": -qty, "stock": -qty, "total_sold": qty}
        # Tukar isi / galon & lpg: tabung/galon kosong di depot bertambah
        if kind == "water":
            inc["stock_empty"] = qty
        elif kind == "lpg":
            inc["stock_empty"] = qty

        res = await db.products.update_one({"id": pid, "stock_filled": {"$gte": qty}}, {"$inc": inc})
        if res.modified_count == 0:
            # Revert yang sudah sempat terpotong bila konkuransi gagal di tengah jalan
            for revert_pid, revert_qty in grouped.items():
                if revert_pid == pid:
                    break
                rev_kind = product_kind(prod_docs[revert_pid])
                rev_inc: Dict[str, int] = {"stock_filled": revert_qty, "stock": revert_qty, "total_sold": -revert_qty}
                if rev_kind in {"water", "lpg"}:
                    rev_inc["stock_empty"] = -revert_qty
                await db.products.update_one({"id": revert_pid}, {"$inc": rev_inc})
            raise http_error(409, f"Stok '{p.get('name')}' berubah saat transaksi diproses. Silakan coba lagi.")

    # 3. Simpan transaksi
    pay_method = normalize_payment(body.payment_method)
    driver_name = None
    if body.driver_id:
        d = await db.users.find_one({"id": body.driver_id})
        if d:
            driver_name = d.get("name")

    order_doc = {
        "id": tx_id,
        "customer_id": body.customer_id,
        "customer_name": body.customer_name or "Pelanggan Umum",
        "driver_id": body.driver_id,
        "driver_name": driver_name,
        "payment_method": pay_method,
        "payment_type": pay_method,
        "items": server_items,
        "total_amount": round(total_sales, 2),
        "total_hpp": round(total_hpp, 2),
        "status": "completed",
        "created_by": user.get("email"),
        "created_at": now_iso(),
    }

    try:
        await db.orders.insert_one(order_doc)
    except DuplicateKeyError:
        # Menangani race condition jika id yang sama persis diinsert bersamaan
        existing = await db.orders.find_one({"id": tx_id})
        if existing:
            return shape_order(existing)
        raise http_error(409, "Transaksi dengan ID ini sudah diproses")

    # Biaya piutang otomatis bila metode pembayaran tempo/piutang
    if pay_method == "tempo" and body.customer_id:
        await db.receivables.update_one(
            {"id": tx_id},
            {"$set": {
                "id": tx_id, "customer_id": body.customer_id, "customer_name": body.customer_name,
                "amount": round(total_sales, 2), "paid_amount": 0.0, "status": "unpaid", "created_at": now_iso(),
            }},
            upsert=True
        )

    return shape_order(order_doc)


@api.get("/orders")
@api.get("/reports")
async def list_orders(_: Dict[str, Any] = Depends(get_current_user)):
    items = []
    async for o in db.orders.find({}).sort("created_at", -1):
        items.append(shape_order(o))
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, _: Dict[str, Any] = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise http_error(404, "Transaksi tidak ditemukan")
    return shape_order(o)


@api.delete("/orders/{order_id}")
@api.delete("/reports/{order_id}")
async def cancel_order(order_id: str, user: Dict[str, Any] = Depends(require_roles(*OWNER))):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise http_error(404, "Transaksi tidak ditemukan")

    if o.get("status") == "cancelled":
        return {"status": "ok", "message": "Transaksi sudah dibatalkan sebelumnya"}

    # Revert stok
    for item in o.get("items", []):
        pid = item.get("product_id")
        qty = to_int(item.get("qty"))
        if pid and qty > 0:
            p = await db.products.find_one({"id": pid})
            kind = product_kind(p or {})
            inc: Dict[str, int] = {"stock_filled": qty, "stock": qty, "total_sold": -qty}
            if kind in {"water", "lpg"}:
                inc["stock_empty"] = -qty
            await db.products.update_one({"id": pid}, {"$inc": inc})

    await db.orders.update_one({"id": order_id}, {"$set": {"status": "cancelled", "cancelled_by": user.get("email"), "cancelled_at": now_iso()}})
    return {"status": "ok", "message": "Transaksi berhasil dibatalkan dan stok dikembalikan"}


# ------------------------------------------------------------------ reports & dashboard (owner)
@api.get("/reports/summary")
async def report_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: Dict[str, Any] = Depends(require_roles(*OWNER)),
):
    orders = [clean(o) async for o in db.orders.find({})]
    expenses = [clean(e) async for e in db.expenses.find({})]
    receivables = [clean(r) async for r in db.receivables.find({})]
    return build_summary(orders, expenses, receivables, start_date, end_date)


@api.get("/dashboard")
async def dashboard(_: Dict[str, Any] = Depends(get_current_user)):
    orders = [clean(o) async for o in db.orders.find({})]
    operating = [o for o in orders if o.get("status") != "cancelled"]
    revenue = sum_sales(operating)

    low_stock = []
    async for p in db.products.find({}):
        if to_int(p.get("stock_filled")) <= to_int(p.get("reorder_point", 5)):
            low_stock.append(shape_product(p))

    recent = []
    async for o in db.orders.find({"status": {"$ne": "cancelled"}}).sort("created_at", -1).limit(5):
        recent.append(shape_order(o))

    return {
        "status": "success",
        "revenue": revenue,
        "daily_revenue": revenue,
        "monthly_revenue": revenue,
        "total_sales": revenue,
        "transactions_count": len(operating),
        "low_stock_count": len(low_stock),
        "recent_transactions": recent,
        "low_stock_items": low_stock,
    }


# ------------------------------------------------------------------ customers
@api.get("/customers")
async def list_customers(_: Dict[str, Any] = Depends(get_current_user)):
    custs = []
    async for c in db.customers.find({}):
        custs.append(clean(c))
    return custs


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""


@api.post("/customers", status_code=201)
@api.put("/customers/{customer_id}")
async def upsert_customer(body: CustomerIn, customer_id: Optional[str] = None, _: Dict[str, Any] = Depends(require_roles(*STAFF))):
    cid = customer_id or new_id()
    doc = {
        "id": cid, "name": body.name.strip(), "phone": (body.phone or "").strip(),
        "address": (body.address or "").strip(), "updated_at": now_iso(),
    }
    await db.customers.update_one({"id": cid}, {"$set": doc}, upsert=True)
    return clean(await db.customers.find_one({"id": cid})) or doc


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, _: Dict[str, Any] = Depends(require_roles(*OWNER))):
    res = await db.customers.delete_one({"id": customer_id})
    if res.deleted_count == 0:
        raise http_error(404, "Pelanggan tidak ditemukan")
    return {"status": "ok", "message": "Pelanggan berhasil dihapus"}


# ------------------------------------------------------------------ drivers & payroll
@api.get("/drivers")
async def list_drivers(_: Dict[str, Any] = Depends(get_current_user)):
    users = [u async for u in db.users.find({"role": {"$in": ["driver", "kurir"]}})]
    orders = [o async for o in db.orders.find({"status": {"$ne": "cancelled"}})]
    return [shape_driver(u, orders) for u in users]


class PayDriverIn(BaseModel):
    driver_id: str
    amount: Optional[float] = None
    note: Optional[str] = "Penggajian driver"


@api.post("/drivers/pay")
async def pay_driver(body: PayDriverIn, user: Dict[str, Any] = Depends(require_roles(*OWNER))):
    d = await db.users.find_one({"id": body.driver_id, "role": {"$in": ["driver", "kurir"]}})
    if not d:
        raise http_error(404, "Driver tidak ditemukan")

    orders = [o async for o in db.orders.find({"driver_id": body.driver_id, "status": {"$ne": "cancelled"}})]
    calc = driver_take_home(d, orders)
    paid = body.amount if (body.amount is not None and body.amount > 0) else calc["take_home"]

    if paid <= 0:
        raise http_error(400, "Nominal gaji tidak boleh 0")

    exp_doc = {
        "id": new_id(), "category": "gaji", "amount": paid,
        "description": f"Gaji driver {d.get('name')} ({body.note or ''})",
        "created_by": user.get("email"), "created_at": now_iso(),
    }
    await db.expenses.insert_one(exp_doc)
    return {"status": "ok", "message": f"Gaji driver {d.get('name')} sebesar Rp{paid:,.0f} berhasil dicatat sebagai pengeluaran", "expense": clean(exp_doc)}


# ------------------------------------------------------------------ expenses
@api.get("/expenses")
async def list_expenses(_: Dict[str, Any] = Depends(require_roles(*OWNER))):
    items = []
    async for e in db.expenses.find({}).sort("created_at", -1):
        items.append(clean(e))
    return items


class ExpenseIn(BaseModel):
    category: str
    amount: float = Field(..., gt=0)
    description: Optional[str] = ""


@api.post("/expenses", status_code=201)
async def create_expense(body: ExpenseIn, user: Dict[str, Any] = Depends(require_roles(*OWNER))):
    doc = {
        "id": new_id(), "category": body.category.strip().lower(),
        "amount": round(body.amount, 2), "description": (body.description or "").strip(),
        "created_by": user.get("email"), "created_at": now_iso(),
    }
    await db.expenses.insert_one(doc)
    return clean(doc)


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, _: Dict[str, Any] = Depends(require_roles(*OWNER))):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise http_error(404, "Pengeluaran tidak ditemukan")
    return {"status": "ok", "message": "Pengeluaran berhasil dihapus"}


# ------------------------------------------------------------------ receivables / piutang
@api.get("/receivables")
async def list_receivables(_: Dict[str, Any] = Depends(require_roles(*OWNER))):
    items = []
    async for r in db.receivables.find({}).sort("created_at", -1):
        items.append(clean(r))
    return items


class PayReceivableIn(BaseModel):
    receivable_id: str
    amount: float = Field(..., gt=0)


@api.post("/receivables/pay")
async def pay_receivable(body: PayReceivableIn, _: Dict[str, Any] = Depends(require_roles(*OWNER))):
    rec = await db.receivables.find_one({"id": body.receivable_id})
    if not rec:
        raise http_error(404, "Piutang tidak ditemukan")

    total = to_float(rec.get("amount"))
    prev_paid = to_float(rec.get("paid_amount"))
    new_paid = prev_paid + body.amount
    st = receivable_status(total, new_paid)

    await db.receivables.update_one(
        {"id": body.receivable_id},
        {"$set": {"paid_amount": round(new_paid, 2), "status": st, "updated_at": now_iso()}}
    )
    updated = await db.receivables.find_one({"id": body.receivable_id})
    return clean(updated)


app.include_router(api, prefix="/api")
app.include_router(api)


# fallback rute lama
@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(_: Request, full_path: str):
    raise http_error(404, f"Rute API /{full_path} tidak ditemukan")
