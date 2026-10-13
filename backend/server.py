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
from datetime import date as ddate, datetime, time as dtime, timedelta, timezone
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
    build_daily_report,
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


from passlib.context import CryptContext
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        if bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8")):
            return True
    except Exception:
        pass
    try:
        if _pwd_context.verify(password, hashed):
            return True
    except Exception:
        pass
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
# AUTH
# ==========================================
_login_failures: Dict[str, List[float]] = {}
MAX_LOGIN_FAILURES = 8
LOGIN_WINDOW_SECONDS = 600


def _throttle_check(key: str) -> None:
    now = time.time()
    attempts = [t for t in _login_failures.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
    _login_failures[key] = attempts
    if len(attempts) >= MAX_LOGIN_FAILURES:
        raise http_error(429, "Terlalu banyak percobaan login gagal. Coba lagi beberapa menit lagi.")


def _throttle_fail(key: str) -> None:
    _login_failures.setdefault(key, []).append(time.time())


def create_access_token(email: str, password_version: int) -> str:
    payload = {
        "sub": email,
        "pv": password_version,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user.get("id") or str(user.get("_id", "")),
        "email": user.get("email") or user.get("username"),
        "name": user.get("name") or str(user.get("email", "")).split("@")[0],
        "role": normalize_role(user.get("role")),
        "base_salary": to_float(user.get("base_salary")),
        "incentive_rate": to_float(user.get("incentive_rate")),
        "active": user.get("active", True),
        "driver_id": user.get("driver_id"),
    }


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise http_error(401, "Sesi telah berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise http_error(401, "Token autentikasi tidak valid")

    sub = str(payload.get("sub") or "").strip().lower()
    user = await db.users.find_one({"$or": [{"email": sub}, {"username": sub}]})
    if not user or user.get("active", True) is False:
        raise http_error(401, "Akun tidak ditemukan atau dinonaktifkan")
    if to_int(payload.get("pv")) != to_int(user.get("password_version")):
        raise http_error(401, "Password telah diubah, silakan login kembali")
    role = normalize_role(user.get("role"))
    if role is None:
        raise http_error(403, "Role pengguna tidak valid")
    result = public_user(user)
    result["role"] = role
    return result


def require_roles(*allowed: str):
    allowed_set = {normalize_role(r) for r in allowed}
    if None in allowed_set:
        raise ValueError("Konfigurasi role endpoint tidak valid")

    async def checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user["role"] not in allowed_set:
            raise http_error(403, "Anda tidak memiliki izin untuk fitur ini")
        return user

    return checker


OWNER = "owner"
CASHIER = "cashier"
WAREHOUSE = "warehouse_admin"
DRIVER = "driver"
ANY_ROLE = (OWNER, CASHIER, WAREHOUSE, DRIVER)


# ==========================================
# MODEL INPUT
# ==========================================
class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class ProductIn(_Base):
    id: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    price_eceran: Optional[float] = Field(None, ge=0)
    price_warung: Optional[float] = Field(None, ge=0)
    price_pangkalan: Optional[float] = Field(None, ge=0)
    price_korporat: Optional[float] = Field(None, ge=0)
    cost_price: Optional[float] = Field(None, ge=0)
    freight_cost: Optional[float] = Field(None, ge=0)
    depreciation_cost: Optional[float] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)
    stock_filled: Optional[int] = Field(None, ge=0)
    stock_empty: Optional[int] = Field(None, ge=0)
    empty_gallon_stock: Optional[int] = Field(None, ge=0)
    empty_lpg_stock: Optional[int] = Field(None, ge=0)
    reorder_point: Optional[int] = Field(None, ge=0)
    track_empty: Optional[bool] = None  # False = produk ini tidak menambah stok wadah kosong saat terjual


class AdjustIn(_Base):
    stock_filled_delta: int = 0
    stock_empty_delta: int = 0
    total_sold_delta: int = 0


class ItemIn(_Base):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    qty: Optional[int] = None
    quantity: Optional[int] = None


class TransactionIn(_Base):
    id: Optional[str] = None
    idempotency_key: Optional[str] = None
    items: List[ItemIn] = []
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    payment_method: Optional[str] = None
    payment_type: Optional[str] = None
    price_type: Optional[str] = None
    status: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    note: Optional[str] = None
    due_date: Optional[str] = None


class StatusIn(_Base):
    status: str
    gallons_returned: int = Field(0, ge=0)
    lpg_returned: int = Field(0, ge=0)
    note: Optional[str] = None


class CustomerIn(_Loose):
    id: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    price_type: Optional[str] = None
    credit_limit: Optional[float] = Field(None, ge=0)


class DepositIn(_Base):
    amount: float
    reason: Optional[str] = None


class DriverIn(_Loose):
    id: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    base_salary: Optional[float] = Field(None, ge=0)
    gallon_commission_rate: Optional[float] = Field(None, ge=0)
    lpg_commission_rate: Optional[float] = Field(None, ge=0)
    fuel_allowance: Optional[float] = Field(None, ge=0)
    deductions: Optional[float] = Field(None, ge=0)


class ExpenseIn(_Base):
    id: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    date: Optional[str] = None
    note: Optional[str] = None


class ReceivableIn(_Base):
    id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_id: Optional[str] = None
    total_amount: Optional[float] = Field(None, gt=0)
    due_date: Optional[str] = None


class PayIn(_Base):
    amount: float = Field(..., gt=0)
    method: Optional[str] = None
    note: Optional[str] = None


class SettlementIn(_Base):
    amount: float = Field(..., ge=0)
    note: Optional[str] = None


class UserIn(_Base):
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    driver_id: Optional[str] = None  # hubungkan akun driver ke data driver ("" = lepas)


class ClosingIn(_Base):
    date: Optional[str] = None
    counted_cash: float = Field(..., ge=0)
    note: Optional[str] = None


# ==========================================
# APP
# ==========================================
async def _ensure_indexes() -> None:
    specs = [("users", "email", True), ("products", "id", True), ("transactions", "id", True), ("transactions", "created_at", False)]
    specs += [(name, "id", True) for name in ("customers", "drivers", "expenses", "receivables", "settlements")]
    specs += [("closings", "date", True)]
    for collection, field, unique in specs:
        try:
            if collection == "users":
                await db.users.create_index(field, unique=True, sparse=True)
            else:
                await db[collection].create_index(field, unique=unique)
        except Exception:
            logger.exception("Gagal membuat index %s.%s", collection, field)


async def seed_database() -> None:
    """Idempotent: hanya menambah data yang belum ada, tidak pernah menimpa password."""
    if SEED_DEMO_USERS:
        for email, password, role, name in DEMO_USERS:
            if await db.users.find_one({"email": email}, {"_id": 1}):
                continue
            hashed = await run_in_threadpool(hash_password, password)
            await db.users.insert_one({
                "id": new_id(), "email": email, "username": email, "name": name, "role": role,
                "hashed_password": hashed, "password_version": 0, "active": True, "created_at": now_iso(),
            })
            logger.info("User demo dibuat: %s", email)
    if await db.products.count_documents({}) == 0:
        for p in DEFAULT_SEEDED_PRODUCTS:
            await db.products.update_one({"id": p["id"]}, {"$set": {**p, "stock": p["stock_filled"], "total_sold": 0}}, upsert=True)
        logger.info("Produk awal dibuat")


async def _migrate_legacy() -> None:
    """Rapikan data dari versi lama. Tiap langkah berdiri sendiri: satu gagal tidak menghentikan yang lain."""
    steps = []

    # Dokumen lama yang hanya punya _id (tanpa field id): isi id dari _id supaya bisa diubah/dihapus dari aplikasi.
    for name in ("products", "customers", "drivers", "transactions", "expenses", "receivables", "settlements"):
        steps.append((f"id {name}", db[name].update_many({"id": {"$in": [None, ""]}}, [{"$set": {"id": {"$toString": "$_id"}}}])))
    steps += [
        ("stock_filled", db.products.update_many({"stock_filled": {"$in": [None]}}, [{"$set": {"stock_filled": {"$ifNull": ["$stock", 0]}}}])),
        ("stock_empty", db.products.update_many({"stock_empty": {"$in": [None]}}, {"$set": {"stock_empty": 0}})),
        ("total_sold", db.products.update_many({"total_sold": {"$in": [None]}}, {"$set": {"total_sold": 0}})),
    ]
    for label, coro in steps:
        try:
            await coro
        except Exception:
            logger.exception("Migrasi '%s' gagal", label)

    try:  # User lama tanpa id
        async for u in db.users.find({"id": {"$in": [None, ""]}}, {"_id": 1}):
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"id": new_id()}})
    except Exception:
        logger.exception("Migrasi 'users id' gagal")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Tiap tahap berdiri sendiri: kegagalan satu tahap tidak menggagalkan yang lain,
    # dan server tetap hidup agar /health bisa melaporkan masalahnya.
    for label, step in (("migrasi", _migrate_legacy), ("index", _ensure_indexes), ("seed", seed_database)):
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


@api.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "ok", "message": "DepotPro ERP Backend Active"}


@api.api_route("/health", methods=["GET", "HEAD"])
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

    # Fallback update demo user hash jika SEED_DEMO_USERS aktif dan password demo cocok
    if not ok and SEED_DEMO_USERS:
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
async def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(payload: Dict[str, Any] = Body(...), user: Dict[str, Any] = Depends(get_current_user)):
    old_password = str(payload.get("old_password") or "")
    new_password = str(payload.get("new_password") or "")
    if len(new_password) < 6:
        raise http_error(400, "Password baru minimal 6 karakter")
    doc = await db.users.find_one({"$or": [{"email": user["email"]}, {"username": user["email"]}]})
    hashed = (doc or {}).get("hashed_password") or (doc or {}).get("password_hash") or ""
    if not await run_in_threadpool(verify_password, old_password, hashed):
        raise http_error(400, "Password lama salah")
    version = to_int(doc.get("password_version")) + 1
    new_hash = await run_in_threadpool(hash_password, new_password)
    await db.users.update_one({"_id": doc["_id"]}, {"$set": {"hashed_password": new_hash, "password_version": version}, "$unset": {"password_hash": ""}})
    return {
        "access_token": create_access_token(str(doc.get("email") or user["email"]).lower(), version),
        "token_type": "bearer",
        "user": user,
    }


# ----------------------------------------------------------- manajemen user
async def _check_driver_exists(driver_id: Optional[str]) -> None:
    if driver_id and not await db.drivers.find_one({"id": driver_id}, {"_id": 1}):
        raise http_error(400, "Data driver yang dipilih tidak ditemukan")


async def _link_driver(email: str, driver_id: Optional[str]) -> None:
    """Satu akun driver <-> satu data driver (dipakai untuk membatasi tugas & data yang terlihat)."""
    await db.drivers.update_many({"user_email": email}, {"$unset": {"user_email": ""}})
    if driver_id:
        await db.drivers.update_one({"id": driver_id}, {"$set": {"user_email": email}})


async def linked_driver_id(user: Dict[str, Any]) -> Optional[str]:
    doc = await db.users.find_one({"$or": [{"email": user["email"]}, {"username": user["email"]}]}, {"driver_id": 1})
    if doc and doc.get("driver_id"):
        return doc["driver_id"]
    d = await db.drivers.find_one({"user_email": user["email"]}, {"id": 1})
    return d.get("id") if d else None


@api.get("/users")
async def list_users(_: Dict[str, Any] = Depends(require_roles(OWNER))):
    return [public_user(u) | {"active": u.get("active", True)} async for u in db.users.find({}).sort("email", 1)]


@api.post("/users", status_code=201)
async def create_user(body: UserIn, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    email = (body.email or "").strip().lower()
    role = normalize_role(body.role)
    if not email or "@" not in email:
        raise http_error(400, "Email tidak valid")
    if role is None:
        raise http_error(400, f"Role harus salah satu dari: {', '.join(sorted(VALID_ROLES))}")
    if len(body.password or "") < 6:
        raise http_error(400, "Password minimal 6 karakter")
    driver_id = (body.driver_id or None) if role == DRIVER else None
    await _check_driver_exists(driver_id)
    hashed = await run_in_threadpool(hash_password, body.password or "")
    doc = {"id": new_id(), "driver_id": driver_id, "email": email, "username": email, "name": (body.name or email.split("@")[0]).strip(), "role": role,
           "hashed_password": hashed, "password_version": 0, "active": True, "created_at": now_iso()}
    try:
        await db.users.insert_one(dict(doc))
    except DuplicateKeyError:
        raise http_error(409, "Email sudah terdaftar")
    await _link_driver(email, driver_id)
    return public_user(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserIn, me: Dict[str, Any] = Depends(require_roles(OWNER))):
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise http_error(404, "User tidak ditemukan")
    changes: Dict[str, Any] = {}
    if body.name:
        changes["name"] = body.name.strip()
    if body.role:
        role = normalize_role(body.role)
        if role is None:
            raise http_error(400, "Role tidak valid")
        if doc.get("id") == me["id"] and role != OWNER:
            raise http_error(400, "Owner tidak dapat menurunkan role dirinya sendiri")
        changes["role"] = role
    if body.active is not None:
        if doc.get("id") == me["id"] and body.active is False:
            raise http_error(400, "Anda tidak dapat menonaktifkan akun sendiri")
        changes["active"] = body.active
    if body.password:
        if len(body.password) < 6:
            raise http_error(400, "Password minimal 6 karakter")
        changes["hashed_password"] = await run_in_threadpool(hash_password, body.password)
        changes["password_version"] = to_int(doc.get("password_version")) + 1
    final_role = changes.get("role") or normalize_role(doc.get("role"))
    relink = False
    if final_role != DRIVER:
        if doc.get("driver_id"):
            changes["driver_id"] = None
            relink = True
    elif "driver_id" in body.model_fields_set:
        wanted = body.driver_id or None
        await _check_driver_exists(wanted)
        changes["driver_id"] = wanted
        relink = True
    if changes:
        await db.users.update_one({"id": user_id}, {"$set": changes})
    if relink:
        await _link_driver(str(doc.get("email") or "").lower(), changes.get("driver_id"))
    return public_user({**doc, **changes})


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, me: Dict[str, Any] = Depends(require_roles(OWNER))):
    if user_id == me["id"]:
        raise http_error(400, "Anda tidak dapat menghapus akun sendiri")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise http_error(404, "User tidak ditemukan")
    return {"success": True}


# --------------------------------------------------------------- produk
def _product_changes(existing: Dict[str, Any], body: ProductIn) -> Dict[str, Any]:
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    data.pop("id", None)
    eg = data.pop("empty_gallon_stock", None)
    el = data.pop("empty_lpg_stock", None)
    merged = {**existing, **data}
    kind = product_kind(merged)

    if "stock" in data and "stock_filled" not in data:
        data["stock_filled"] = data["stock"]
    if "stock_empty" not in data:
        if kind == "lpg" and el is not None:
            data["stock_empty"] = el
        elif kind != "lpg" and eg is not None:
            data["stock_empty"] = eg
    if "price" in data and "price_eceran" not in data:
        data["price_eceran"] = data["price"]
    elif "price_eceran" in data and "price" not in data:
        data["price"] = data["price_eceran"]
    if "stock_filled" in data:
        data["stock"] = data["stock_filled"]

    merged = {**existing, **data}
    data["hpp"] = round(to_float(merged.get("cost_price")) + to_float(merged.get("freight_cost")) + to_float(merged.get("depreciation_cost")), 2)
    return data


@api.get("/products")
async def list_products(_: Dict[str, Any] = Depends(get_current_user)):
    return [shape_product(d) async for d in db.products.find({}, {"_id": 0}).sort("name", 1)]


@api.post("/products")
async def create_or_update_product(body: ProductIn, _: Dict[str, Any] = Depends(require_roles(OWNER, WAREHOUSE))):
    existing = await db.products.find_one({"id": body.id}, {"_id": 0}) if body.id else None
    if existing:
        changes = _product_changes(existing, body)
        await db.products.update_one({"id": body.id}, {"$set": changes})
        return shape_product({**existing, **changes})
    if not (body.name or "").strip():
        raise http_error(400, "Nama produk wajib diisi")
    base = {"id": body.id or new_id(), "name": body.name.strip(), "stock_filled": 0, "stock_empty": 0, "total_sold": 0,
            "reorder_point": 0, "created_at": now_iso()}
    changes = _product_changes(base, body)
    doc = {**base, **changes, "name": body.name.strip()}
    if not to_float(doc.get("price")) > 0:
        raise http_error(400, "Harga jual wajib diisi dan lebih dari 0")
    try:
        await db.products.insert_one(dict(doc))
    except DuplicateKeyError:
        raise http_error(409, "ID produk sudah ada")
    return shape_product(doc)


@api.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, _: Dict[str, Any] = Depends(require_roles(OWNER, WAREHOUSE))):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise http_error(404, "Produk tidak ditemukan")
    changes = _product_changes(existing, body)
    if "name" in changes and not str(changes["name"]).strip():
        raise http_error(400, "Nama produk tidak boleh kosong")
    if changes:
        await db.products.update_one({"id": product_id}, {"$set": changes})
    return shape_product({**existing, **changes})


@api.post("/products/{product_id}/adjust")
async def adjust_product_stock(product_id: str, body: AdjustIn, _: Dict[str, Any] = Depends(require_roles(OWNER, WAREHOUSE))):
    """Ubah stok dengan selisih (delta) secara ATOMIK, aman bila ada penjualan bersamaan dari perangkat lain."""
    if not await db.products.find_one({"id": product_id}, {"_id": 1}):
        raise http_error(404, "Produk tidak ditemukan")
    filled = {"$max": [0, {"$add": [{"$ifNull": ["$stock_filled", {"$ifNull": ["$stock", 0]}]}, body.stock_filled_delta]}]}
    await db.products.update_one(
        {"id": product_id},
        [{"$set": {
            "stock_filled": filled,
            "stock": filled,
            "stock_empty": {"$max": [0, {"$add": [{"$ifNull": ["$stock_empty", 0]}, body.stock_empty_delta]}]},
            "total_sold": {"$max": [0, {"$add": [{"$ifNull": ["$total_sold", 0]}, body.total_sold_delta]}]},
        }}],
    )
    fresh = await db.products.find_one({"id": product_id}, {"_id": 0})
    return shape_product(fresh)


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise http_error(404, "Data produk tidak ditemukan")
    return {"success": True, "status": "success", "message": "Data produk berhasil dihapus"}


@api.get("/inventory/low-stock")
async def low_stock(_: Dict[str, Any] = Depends(require_roles(OWNER, WAREHOUSE, CASHIER))):
    return [p for p in [shape_product(d) async for d in db.products.find({}, {"_id": 0})] if p["low_stock"]]


# ------------------------------------------------------------ transaksi
async def _restore_stock(deducted: List[Dict[str, Any]]) -> None:
    for item in deducted:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock_filled": item["qty"], "stock": item["qty"], "total_sold": -item["qty"]}},
        )


async def _find_product(ref: str) -> Optional[Dict[str, Any]]:
    product = await db.products.find_one({"id": ref}, {"_id": 0})
    if product:
        return product
    return await db.products.find_one({"name": ref}, {"_id": 0})


async def create_sale(body: TransactionIn, user: Dict[str, Any]) -> Dict[str, Any]:
    tx_id = str(body.id or body.idempotency_key or new_id()).strip()
    existing = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if existing:
        return shape_order(existing)  # idempotent

    method = normalize_payment(body.payment_method or body.payment_type)
    if not method:
        raise http_error(400, "Metode pembayaran tidak valid (cash, transfer, qris, tempo, deposit)")
    price_type = (body.price_type or "").strip().lower() or None
    if price_type and price_type not in PRICE_TYPES:
        raise http_error(400, "Tipe harga tidak valid")

    merged: Dict[str, int] = {}
    for item in body.items:
        ref = (item.product_id or item.product_name or "").strip()
        qty = to_int(item.qty if item.qty is not None else item.quantity)
        if not ref or qty <= 0:
            continue
        merged[ref] = merged.get(ref, 0) + qty
    if not merged:
        raise http_error(400, "Transaksi harus memiliki setidaknya 1 item yang valid")

    customer: Optional[Dict[str, Any]] = None
    if body.customer_id:
        customer = await db.customers.find_one({"id": body.customer_id}, {"_id": 0})
        if not customer:
            raise http_error(400, "Pelanggan tidak ditemukan")
        price_type = price_type or customer.get("price_type")
    customer_name = (body.customer_name or (customer or {}).get("name") or "").strip() or "Pelanggan Umum"

    validated: List[Dict[str, Any]] = []
    total = 0.0
    total_hpp = 0.0
    for ref, qty in merged.items():
        product = await _find_product(ref)
        if not product:
            raise http_error(400, f"Produk '{ref}' tidak ditemukan di server")
        shaped = shape_product(product)
        if shaped["stock_filled"] < qty:
            raise http_error(400, f"Stok tidak mencukupi untuk {shaped['name']}. Sisa: {shaped['stock_filled']}, diminta: {qty}")
        try:
            unit_price = resolve_unit_price(product, price_type)
        except ValueError:
            raise http_error(409, f"Harga produk '{shaped['name']}' belum dikonfigurasi")
        subtotal = unit_price * qty
        total += subtotal
        total_hpp += shaped["hpp"] * qty
        validated.append({"product_id": product["id"], "product_name": shaped["name"], "qty": qty, "quantity": qty,
                          "price": unit_price, "hpp": shaped["hpp"], "subtotal": subtotal, "kind": shaped["kind"],
                          "tracks_empty": product.get("track_empty") is not False})

    if method == "tempo" and not (body.customer_id or body.customer_name):
        raise http_error(400, "Pembayaran tempo membutuhkan data pelanggan")
    if method == "deposit":
        if not customer:
            raise http_error(400, "Pembayaran deposit membutuhkan pelanggan terdaftar")
        if to_float(customer.get("deposit")) < total:
            raise http_error(400, "Saldo deposit pelanggan tidak mencukupi")

    # Kurangi stok secara atomik, rollback bila gagal
    deducted: List[Dict[str, Any]] = []
    for item in validated:
        res = await db.products.update_one(
            {"id": item["product_id"], "stock_filled": {"$gte": item["qty"]}},
            {"$inc": {"stock_filled": -item["qty"], "stock": -item["qty"], "total_sold": item["qty"]}},
        )
        if res.modified_count == 0:
            await _restore_stock(deducted)
            raise http_error(409, f"Stok {item['product_name']} berubah/tidak mencukupi. Transaksi dibatalkan.")
        deducted.append(item)

    if method == "deposit":
        res = await db.customers.update_one({"id": customer["id"], "deposit": {"$gte": total}}, {"$inc": {"deposit": -total}})
        if res.modified_count == 0:
            await _restore_stock(deducted)
            raise http_error(400, "Saldo deposit pelanggan tidak mencukupi")

    order_status = (body.status or "").strip().lower()
    if order_status not in ORDER_STATUSES or order_status == "cancelled":
        order_status = "assigned" if (body.driver_id or body.driver_name) else "completed"

    doc = {
        "id": tx_id, "items": validated, "total_amount": round(total, 2), "total_hpp": round(total_hpp, 2),
        "payment_method": method, "payment_type": method, "price_type": price_type,
        "customer_id": body.customer_id, "customer_name": customer_name,
        "status": order_status, "driver_id": body.driver_id, "driver_name": body.driver_name, "note": body.note,
        "created_at": now_iso(), "created_by": user["email"], "created_by_name": user["name"],
    }
    # Penjualan langsung (tukar di tempat): wadah kosong dari pelanggan langsung bertambah.
    # Untuk pengiriman, wadah kosong dicatat saat status 'delivered' (sesuai jumlah yang dikembalikan).
    empties = [{"product_id": i["product_id"], "qty": i["qty"]} for i in validated if i.get("tracks_empty")] \
        if order_status == "completed" else []
    doc["empties_credited"] = empties
    try:
        await db.transactions.insert_one(dict(doc))
    except Exception:
        await _restore_stock(deducted)
        if method == "deposit":
            await db.customers.update_one({"id": customer["id"]}, {"$inc": {"deposit": total}})
        raise http_error(409, "Transaksi ganda terdeteksi")

    for e in empties:
        await db.products.update_one({"id": e["product_id"]}, {"$inc": {"stock_empty": e["qty"]}})

    if method == "tempo":
        due = body.due_date or (today_wib() + timedelta(days=7)).isoformat()
        await db.receivables.insert_one({
            "id": new_id(), "transaction_id": tx_id, "customer_id": body.customer_id, "customer_name": customer_name,
            "total_amount": round(total, 2), "paid_amount": 0.0, "status": "unpaid", "due_date": due,
            "payments": [], "created_at": now_iso(),
        })
    return shape_order(doc)


@api.post("/transactions")
async def post_transaction(body: TransactionIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    order = await create_sale(body, user)
    return {"status": "success", "data": order}


@api.post("/orders")
async def post_order(body: TransactionIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    return await create_sale(body, user)


@api.get("/orders")
async def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    include_cancelled: bool = False,
    limit: int = Query(500, ge=1, le=2000),
    user: Dict[str, Any] = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if user["role"] == DRIVER:  # driver hanya melihat tugasnya sendiri
        own = await linked_driver_id(user)
        if not own:
            return []
        query["driver_id"] = own
    if status_filter:
        query["status"] = status_filter
    elif not include_cancelled:
        query["status"] = {"$ne": "cancelled"}
    return [shape_order(d) async for d in db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)]


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.transactions.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise http_error(404, "Order tidak ditemukan")
    if user["role"] == DRIVER and doc.get("driver_id") != await linked_driver_id(user):
        raise http_error(403, "Order ini bukan tugas Anda")
    return shape_order(doc)


async def _credit_empties(order: Dict[str, Any], gallons: int, lpg: int) -> None:
    """Tambahkan wadah kosong yang dikembalikan pelanggan ke produk yang sesuai."""
    for kind, qty in (("galon", gallons), ("lpg", lpg)):
        if qty <= 0:
            continue
        target_id = next((i["product_id"] for i in order.get("items", []) if i.get("kind") == kind), None)
        if target_id is None:
            async for p in db.products.find({}, {"_id": 0}):
                if product_kind(p) == kind:
                    target_id = p["id"]
                    break
        if target_id:
            await db.products.update_one({"id": target_id}, {"$inc": {"stock_empty": qty}})


@api.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: StatusIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER, DRIVER))):
    new_status = body.status.strip().lower()
    if new_status not in ORDER_STATUSES or new_status == "cancelled":
        raise http_error(400, "Status tidak valid. Untuk membatalkan gunakan DELETE /orders/{id}")
    order = await db.transactions.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise http_error(404, "Order tidak ditemukan")
    if user["role"] == DRIVER:
        own = await linked_driver_id(user)
        if not own:
            raise http_error(403, "Akun driver belum dihubungkan ke data driver. Hubungi pemilik.")
        if order.get("driver_id") != own:
            raise http_error(403, "Order ini bukan tugas Anda")
    if order.get("status") == "cancelled":
        raise http_error(400, "Order sudah dibatalkan")
    if order.get("status") == "delivered" and new_status == "delivered":
        return shape_order(order)  # idempotent: jangan hitung ganda

    changes: Dict[str, Any] = {"status": new_status, "status_updated_at": now_iso(), "status_updated_by": user["email"]}
    if body.note:
        changes["delivery_note"] = body.note
    await db.transactions.update_one({"id": order_id}, {"$set": changes})
    order.update(changes)

    driver_id = order.get("driver_id")
    if new_status == "on_delivery" and driver_id:
        await db.drivers.update_one({"id": driver_id}, {"$set": {"status": "delivering"}})
    if new_status == "delivered":
        await _credit_empties(order, body.gallons_returned, body.lpg_returned)
        if driver_id:
            galon_qty = sum(to_int(i.get("qty")) for i in order.get("items", []) if i.get("kind") == "galon")
            lpg_qty = sum(to_int(i.get("qty")) for i in order.get("items", []) if i.get("kind") == "lpg")
            await db.drivers.update_one(
                {"id": driver_id},
                {"$inc": {"completed_deliveries": 1, "gallons_delivered": galon_qty, "lpg_delivered": lpg_qty},
                 "$set": {"status": "available"}},
            )
    return shape_order(order)


@api.delete("/orders/{order_id}")
async def cancel_order(order_id: str, user: Dict[str, Any] = Depends(require_roles(OWNER))):
    order = await db.transactions.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise http_error(404, "Data transaksi tidak ditemukan")
    if order.get("status") == "cancelled":
        return {"success": True, "status": "success", "message": "Transaksi sudah dalam status dibatalkan"}

    claimed = await db.transactions.update_one(
        {"id": order_id, "status": {"$ne": "cancelled"}},
        {"$set": {"status": "cancelled", "cancelled_at": now_iso(), "cancelled_by": user["email"]}},
    )
    if claimed.modified_count == 0:
        return {"success": True, "status": "success", "message": "Transaksi sudah dalam status dibatalkan"}

    await _restore_stock([{"product_id": i["product_id"], "qty": to_int(i.get("qty"))} for i in order.get("items", []) if i.get("product_id")])
    for e in order.get("empties_credited", []) or []:
        qty = to_int(e.get("qty"))
        if e.get("product_id") and qty > 0:
            await db.products.update_one(
                {"id": e["product_id"]},
                [{"$set": {"stock_empty": {"$max": [0, {"$subtract": [{"$ifNull": ["$stock_empty", 0]}, qty]}]}}}],
            )
    if order.get("payment_method") == "deposit" and order.get("customer_id"):
        await db.customers.update_one({"id": order["customer_id"]}, {"$inc": {"deposit": to_float(order.get("total_amount"))}})
    await db.receivables.update_many({"transaction_id": order_id}, {"$set": {"status": "cancelled"}})
    return {"success": True, "status": "success", "message": "Transaksi dibatalkan dan stok dikembalikan"}


# --------------------------------------------------------------- laporan
async def _load_report_data():
    orders = [d async for d in db.transactions.find({}, {"_id": 0})]
    expenses = [d async for d in db.expenses.find({}, {"_id": 0})]
    receivables = [d async for d in db.receivables.find({}, {"_id": 0})]
    products = [d async for d in db.products.find({}, {"_id": 0})]
    return orders, expenses, receivables, products


@api.get("/reports/summary")
async def reports_summary(_: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    return build_summary(*await _load_report_data())


@api.get("/reports")
async def get_reports(_: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    orders = [shape_order(d) async for d in db.transactions.find({}, {"_id": 0}).sort("created_at", -1)]
    today = today_wib()
    return {
        "status": "success",
        "daily": sum_sales(orders, day=today),
        "monthly": sum_sales(orders, month=(today.year, today.month)),
        "total_transactions": len([o for o in orders if o.get("status") != "cancelled"]),
        "data": orders,
    }


@api.delete("/reports/{order_id}")
async def delete_report(order_id: str, user: Dict[str, Any] = Depends(require_roles(OWNER))):
    return await cancel_order(order_id, user)


@api.get("/dashboard")
async def dashboard(_: Dict[str, Any] = Depends(get_current_user)):
    orders, expenses, receivables, products = await _load_report_data()
    summary = build_summary(orders, expenses, receivables, products)
    recent = [shape_order(o) for o in sorted(orders, key=lambda o: o.get("created_at", ""), reverse=True) if o.get("status") != "cancelled"][:5]
    low = [p for p in (shape_product(p) for p in products) if p["low_stock"]]
    return {
        "status": "success",
        "revenue": summary["total_sales"],
        "daily_revenue": summary["today_sales"],
        "monthly_revenue": summary["month_sales"],
        "total_sales": summary["total_sales"],
        "transactions_count": summary["total_orders"],
        "low_stock_count": len(low),
        "recent_transactions": recent,
        "low_stock_items": low,
        "net_profit": summary["net_profit"],
        "total_receivables": summary["total_receivables"],
        "daily_sales": summary["daily_sales"],
    }


@api.get("/finance/summary")
async def finance_summary(_: Dict[str, Any] = Depends(require_roles(OWNER))):
    s = build_summary(*await _load_report_data())
    return {"status": "success", "revenue_total": s["total_sales"], "expenses_total": s["total_expenses"],
            "net_profit": s["net_profit"], "total_transactions": s["total_orders"], "receivables": s["total_receivables"]}


# -------------------------------------------------- laporan harian & tutup kasir
def _parse_day(value: Optional[str]) -> ddate:
    if not value:
        return today_wib()
    try:
        return ddate.fromisoformat(value.strip())
    except ValueError:
        raise http_error(400, "Format tanggal harus YYYY-MM-DD")


def _day_range_utc(day: ddate) -> tuple:
    start = datetime.combine(day, dtime.min, tzinfo=WIB).astimezone(timezone.utc)
    end = datetime.combine(day + timedelta(days=1), dtime.min, tzinfo=WIB).astimezone(timezone.utc)
    return start.isoformat(), end.isoformat()


async def _daily_report(day: ddate) -> Dict[str, Any]:
    start, end = _day_range_utc(day)
    orders = [d async for d in db.transactions.find({"created_at": {"$gte": start, "$lt": end}}, {"_id": 0})]
    expenses = [d async for d in db.expenses.find({"date": day.isoformat()}, {"_id": 0})]
    receivables = [d async for d in db.receivables.find({"payments.at": {"$gte": start, "$lt": end}}, {"_id": 0})]
    return build_daily_report(orders, expenses, receivables, day)


@api.get("/reports/daily")
async def reports_daily(date_str: Optional[str] = Query(None, alias="date"), _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    day = _parse_day(date_str)
    report = await _daily_report(day)
    report["closing"] = await db.closings.find_one({"date": day.isoformat()}, {"_id": 0})
    return report


@api.post("/closings")
async def save_closing(body: ClosingIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    day = _parse_day(body.date)
    report = await _daily_report(day)
    expected = to_float(report["expected_cash"])
    doc = {
        "date": day.isoformat(), "expected_cash": expected, "counted_cash": body.counted_cash,
        "difference": round(body.counted_cash - expected, 2), "orders_count": report["orders_count"],
        "total_sales": report["total_sales"], "note": (body.note or "").strip(),
        "closed_by": user["email"], "closed_by_name": user["name"], "closed_at": now_iso(),
    }
    await db.closings.update_one({"date": doc["date"]}, {"$set": doc, "$setOnInsert": {"id": new_id()}}, upsert=True)
    return await db.closings.find_one({"date": doc["date"]}, {"_id": 0})


@api.delete("/closings/{day}")
async def delete_closing(day: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    d = _parse_day(day)
    res = await db.closings.delete_one({"date": d.isoformat()})
    if res.deleted_count == 0:
        raise http_error(404, "Data tutup kasir tidak ditemukan")
    return {"success": True}


@api.get("/closings")
async def list_closings(limit: int = Query(60, ge=1, le=366), _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    return [d async for d in db.closings.find({}, {"_id": 0}).sort("date", -1).limit(limit)]


# ------------------------------------------------------------ pelanggan
@api.get("/customers")
async def list_customers(_: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER, DRIVER))):
    customers = []
    async for d in db.customers.find({}, {"_id": 0}).sort("name", 1):
        d.setdefault("deposit", 0.0)
        customers.append(d)
    return customers


def _customer_changes(body: CustomerIn) -> Dict[str, Any]:
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    data.pop("id", None)
    if "price_type" in data and data["price_type"] not in PRICE_TYPES:
        raise http_error(400, "Tipe harga tidak valid")
    for key in ("name", "phone", "address"):
        if key in data:
            data[key] = str(data[key]).strip()
    data.pop("deposit", None)  # saldo hanya lewat endpoint /deposit
    return data


@api.post("/customers", status_code=200)
async def save_customer(body: CustomerIn, _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    changes = _customer_changes(body)
    existing = await db.customers.find_one({"id": body.id}, {"_id": 0}) if body.id else None
    if existing:
        changes["updated_at"] = now_iso()
        await db.customers.update_one({"id": body.id}, {"$set": changes})
        return {"success": True, "data": {**existing, **changes}}
    if not changes.get("name"):
        raise http_error(400, "Nama pelanggan wajib diisi")
    doc = {"id": body.id or new_id(), "deposit": 0.0, **changes, "created_at": now_iso(), "updated_at": now_iso()}
    await db.customers.insert_one(dict(doc))
    return {"success": True, "data": doc}


@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerIn, _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise http_error(404, "Data pelanggan tidak ditemukan")
    changes = _customer_changes(body)
    if "name" in changes and not changes["name"]:
        raise http_error(400, "Nama pelanggan tidak boleh kosong")
    changes["updated_at"] = now_iso()
    await db.customers.update_one({"id": customer_id}, {"$set": changes})
    return {"success": True, "data": {**existing, **changes}}


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.customers.delete_one({"id": customer_id})
    if res.deleted_count == 0:
        raise http_error(404, "Data pelanggan tidak ditemukan")
    return {"success": True, "message": "Data pelanggan berhasil dihapus"}


@api.post("/customers/{customer_id}/deposit")
async def adjust_deposit(customer_id: str, body: DepositIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    if body.amount == 0:
        raise http_error(400, "Jumlah tidak boleh nol")
    if body.amount < 0 and user["role"] != OWNER:
        raise http_error(403, "Hanya owner yang boleh mengurangi deposit")
    query: Dict[str, Any] = {"id": customer_id}
    if body.amount < 0:
        query["deposit"] = {"$gte": -body.amount}
    res = await db.customers.update_one(query, {"$inc": {"deposit": body.amount}})
    if res.matched_count == 0:
        exists = await db.customers.find_one({"id": customer_id}, {"_id": 1})
        raise http_error(404 if not exists else 400, "Data pelanggan tidak ditemukan" if not exists else "Saldo deposit tidak mencukupi")
    await db.deposit_ledger.insert_one({"id": new_id(), "customer_id": customer_id, "amount": body.amount, "reason": body.reason,
                                        "by": user["email"], "created_at": now_iso()})
    return clean(await db.customers.find_one({"id": customer_id}))


# --------------------------------------------------------------- driver
def _driver_changes(body: DriverIn) -> Dict[str, Any]:
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    data.pop("id", None)
    for key in ("name", "phone"):
        if key in data:
            data[key] = str(data[key]).strip()
    for key in ("completed_deliveries", "gallons_delivered", "lpg_delivered", "take_home_pay", "total_incentive",
                "gallon_incentive", "lpg_incentive"):
        data.pop(key, None)  # dihitung/diubah server saja
    return data


@api.get("/drivers")
async def list_drivers(user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER, DRIVER))):
    query: Dict[str, Any] = {}
    if user["role"] == DRIVER:  # jangan bocorkan gaji driver lain
        own = await linked_driver_id(user)
        if not own:
            return []
        query["id"] = own
    return [shape_driver(d) async for d in db.drivers.find(query, {"_id": 0}).sort("name", 1)]


@api.post("/drivers")
async def save_driver(body: DriverIn, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    changes = _driver_changes(body)
    existing = await db.drivers.find_one({"id": body.id}, {"_id": 0}) if body.id else None
    if existing:
        changes["updated_at"] = now_iso()
        await db.drivers.update_one({"id": body.id}, {"$set": changes})
        return {"success": True, "data": shape_driver({**existing, **changes})}
    if not changes.get("name"):
        raise http_error(400, "Nama driver wajib diisi")
    doc = {"id": body.id or new_id(), **DRIVER_DEFAULTS, **changes, "created_at": now_iso(), "updated_at": now_iso()}
    await db.drivers.insert_one(dict(doc))
    return {"success": True, "data": shape_driver(doc)}


@api.put("/drivers/{driver_id}")
async def update_driver(driver_id: str, body: DriverIn, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    existing = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not existing:
        raise http_error(404, "Data driver tidak ditemukan")
    changes = _driver_changes(body)
    if "name" in changes and not changes["name"]:
        raise http_error(400, "Nama driver tidak boleh kosong")
    changes["updated_at"] = now_iso()
    await db.drivers.update_one({"id": driver_id}, {"$set": changes})
    return {"success": True, "data": shape_driver({**existing, **changes})}


@api.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.drivers.delete_one({"id": driver_id})
    if res.deleted_count == 0:
        raise http_error(404, "Data driver tidak ditemukan")
    return {"success": True, "message": "Data driver berhasil dihapus"}


@api.post("/drivers/{driver_id}/pay")
async def pay_driver(driver_id: str, user: Dict[str, Any] = Depends(require_roles(OWNER))):
    """Bayar gaji + insentif driver: dicatat sebagai beban 'Gaji Driver' lalu hitungan periode direset."""
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise http_error(404, "Data driver tidak ditemukan")
    shaped = shape_driver(driver)
    amount = driver_take_home(shaped)["take_home_pay"]
    # klaim atomik agar tidak terbayar dua kali bila tombol ditekan berulang
    guard: Dict[str, Any] = {"id": driver_id}
    for field in ("completed_deliveries", "gallons_delivered", "lpg_delivered"):
        guard[field] = driver[field] if field in driver else {"$exists": False}
    claimed = await db.drivers.update_one(
        guard,
        {"$set": {"completed_deliveries": 0, "gallons_delivered": 0, "lpg_delivered": 0, "deductions": 0.0, "last_paid_at": now_iso()}},
    )
    if claimed.matched_count == 0:
        raise http_error(409, "Data driver baru saja berubah, muat ulang lalu coba lagi")
    if amount > 0:
        await db.expenses.insert_one({"id": new_id(), "category": "Gaji Driver", "amount": amount, "date": today_wib().isoformat(),
                                      "note": f"Gaji & insentif {shaped.get('name', '')}", "created_by": user["email"], "created_at": now_iso()})
    return {"success": True, "paid": amount}


# ------------------------------------------------------------ pengeluaran
@api.get("/expenses")
async def list_expenses(_: Dict[str, Any] = Depends(require_roles(OWNER))):
    return [d async for d in db.expenses.find({}, {"_id": 0}).sort([("date", -1), ("created_at", -1)])]


@api.post("/expenses", status_code=201)
async def create_expense(body: ExpenseIn, user: Dict[str, Any] = Depends(require_roles(OWNER))):
    if not (body.category or "").strip():
        raise http_error(400, "Kategori pengeluaran wajib diisi")
    if body.amount is None:
        raise http_error(400, "Jumlah pengeluaran wajib diisi dan lebih dari 0")
    doc = {"id": new_id(), "category": body.category.strip(), "amount": body.amount, "date": body.date or today_wib().isoformat(),
           "note": (body.note or "").strip(), "created_by": user["email"], "created_at": now_iso()}
    await db.expenses.insert_one(dict(doc))
    return doc


@api.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, body: ExpenseIn, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    existing = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not existing:
        raise http_error(404, "Data pengeluaran tidak ditemukan")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    changes.pop("id", None)
    if "category" in changes:
        changes["category"] = changes["category"].strip()
        if not changes["category"]:
            raise http_error(400, "Kategori tidak boleh kosong")
    changes["updated_at"] = now_iso()
    await db.expenses.update_one({"id": expense_id}, {"$set": changes})
    return {**existing, **changes}


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise http_error(404, "Data pengeluaran tidak ditemukan")
    return {"success": True}


# --------------------------------------------------------------- piutang
def _shape_receivable(doc: Dict[str, Any]) -> Dict[str, Any]:
    r = clean(doc) or {}
    total = to_float(r.get("total_amount"))
    paid = to_float(r.get("paid_amount"))
    if r.get("status") != "cancelled":
        r["status"] = receivable_status(total, paid)
    r["outstanding"] = max(0.0, total - paid)
    return r


@api.get("/receivables")
async def list_receivables(_: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    items = [_shape_receivable(d) async for d in db.receivables.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).sort("created_at", -1)]
    return items


@api.post("/receivables", status_code=201)
async def create_receivable(body: ReceivableIn, _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    if not (body.customer_name or "").strip():
        raise http_error(400, "Nama pelanggan wajib diisi")
    if body.total_amount is None:
        raise http_error(400, "Jumlah piutang wajib diisi dan lebih dari 0")
    doc = {"id": new_id(), "transaction_id": None, "customer_id": body.customer_id, "customer_name": body.customer_name.strip(),
           "total_amount": body.total_amount, "paid_amount": 0.0, "status": "unpaid",
           "due_date": body.due_date or (today_wib() + timedelta(days=7)).isoformat(), "payments": [], "created_at": now_iso()}
    await db.receivables.insert_one(dict(doc))
    return _shape_receivable(doc)


@api.put("/receivables/{rec_id}")
async def update_receivable(rec_id: str, body: ReceivableIn, _: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    existing = await db.receivables.find_one({"id": rec_id}, {"_id": 0})
    if not existing:
        raise http_error(404, "Data piutang tidak ditemukan")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    changes.pop("id", None)
    if "total_amount" in changes and changes["total_amount"] < to_float(existing.get("paid_amount")):
        raise http_error(400, "Total piutang tidak boleh lebih kecil dari yang sudah dibayar")
    await db.receivables.update_one({"id": rec_id}, {"$set": changes})
    return _shape_receivable({**existing, **changes})


@api.post("/receivables/{rec_id}/pay")
async def pay_receivable(rec_id: str, body: PayIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER))):
    for _attempt in range(3):  # optimistic locking
        rec = await db.receivables.find_one({"id": rec_id, "status": {"$ne": "cancelled"}}, {"_id": 0})
        if not rec:
            raise http_error(404, "Data piutang tidak ditemukan")
        total = to_float(rec.get("total_amount"))
        paid = to_float(rec.get("paid_amount"))
        outstanding = total - paid
        if body.amount > outstanding + 1e-6:
            raise http_error(400, f"Jumlah melebihi sisa piutang (Rp {outstanding:,.0f})".replace(",", "."))
        new_paid = paid + body.amount
        payment = {"amount": body.amount, "method": body.method or "cash", "note": body.note, "by": user["email"], "at": now_iso()}
        res = await db.receivables.update_one(
            {"id": rec_id, "paid_amount": rec.get("paid_amount", 0.0)},
            {"$set": {"paid_amount": new_paid, "status": receivable_status(total, new_paid)}, "$push": {"payments": payment}},
        )
        if res.modified_count:
            rec.update({"paid_amount": new_paid})
            return _shape_receivable(rec)
    raise http_error(409, "Data piutang sedang berubah, coba lagi")


@api.delete("/receivables/{rec_id}")
async def delete_receivable(rec_id: str, _: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.receivables.delete_one({"id": rec_id})
    if res.deleted_count == 0:
        raise http_error(404, "Data piutang tidak ditemukan")
    return {"success": True}


# --------------------------------------------------------------- setoran
@api.get("/settlements")
async def list_settlements(user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER, DRIVER))):
    query = {} if user["role"] == OWNER else {"user_email": user["email"]}
    return [d async for d in db.settlements.find(query, {"_id": 0}).sort("created_at", -1).limit(500)]


@api.post("/settlements", status_code=201)
async def create_settlement(body: SettlementIn, user: Dict[str, Any] = Depends(require_roles(OWNER, CASHIER, DRIVER))):
    doc = {"id": new_id(), "user_email": user["email"], "user_name": user["name"], "role": user["role"], "amount": body.amount,
           "note": body.note, "status": "pending", "created_at": now_iso()}
    await db.settlements.insert_one(dict(doc))
    return doc


@api.patch("/settlements/{settlement_id}/confirm")
async def confirm_settlement(settlement_id: str, user: Dict[str, Any] = Depends(require_roles(OWNER))):
    res = await db.settlements.update_one({"id": settlement_id}, {"$set": {"status": "confirmed", "confirmed_by": user["email"], "confirmed_at": now_iso()}})
    if res.matched_count == 0:
        raise http_error(404, "Data setoran tidak ditemukan")
    return clean(await db.settlements.find_one({"id": settlement_id}))


# Semua rute tersedia di /api dan (untuk kompatibilitas lama) tanpa prefix.
app.include_router(api, prefix="/api")
app.include_router(api, include_in_schema=False)
