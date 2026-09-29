from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import OAuth2PasswordBearer
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from enum import Enum
import uuid
import jwt
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_MINUTES = int(os.environ.get('ACCESS_TOKEN_MINUTES', 1440))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="GasGalon ERP & POS")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def now_utc():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


# ============================ ENUMS ============================
class Role(str, Enum):
    owner = "owner"
    cashier = "cashier"
    warehouse_admin = "warehouse_admin"
    driver = "driver"


TIERS = ["eceran", "warung", "pangkalan", "korporat"]


# ============================ MODELS ============================
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=5)
    name: str
    role: Role = Role.cashier
    base_salary: float = 0
    incentive_rate: float = 0  # per delivered unit
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    plate_number: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    password: Optional[str] = None
    base_salary: Optional[float] = None
    incentive_rate: Optional[float] = None
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    plate_number: Optional[str] = None
    disabled: Optional[bool] = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Role
    disabled: bool = False
    base_salary: float = 0
    incentive_rate: float = 0
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    plate_number: Optional[str] = None


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: Literal["lpg", "galon_brand", "refill"]
    sku: Optional[str] = None
    is_returnable: bool = True  # has a container asset (tabung/galon)
    cost_price: float = 0        # harga beli isi
    freight_cost: float = 0      # ongkir/armada per unit
    depreciation_cost: float = 0 # penyusutan aset tabung/galon per unit
    hpp: float = 0               # auto-calculated
    price_eceran: float = 0
    price_warung: float = 0
    price_pangkalan: float = 0
    price_korporat: float = 0
    deposit_amount: float = 0    # deposit wadah kosong
    stock_filled: int = 0        # isi di gudang
    stock_empty: int = 0         # kosong di gudang
    reorder_point: int = 10
    total_sold: int = 0          # akumulasi unit terjual
    is_active: bool = True        # soft-delete flag
    created_at: datetime = Field(default_factory=now_utc)


class ProductCreate(BaseModel):
    name: str
    category: Literal["lpg", "galon_brand", "refill"]
    sku: Optional[str] = None
    is_returnable: bool = True
    cost_price: float = 0
    freight_cost: float = 0
    depreciation_cost: float = 0
    price_eceran: float = 0
    price_warung: float = 0
    price_pangkalan: float = 0
    price_korporat: float = 0
    deposit_amount: float = 0
    stock_filled: int = 0
    stock_empty: int = 0
    reorder_point: int = 10


class StockAdjust(BaseModel):
    stock_filled_delta: int = 0
    stock_empty_delta: int = 0
    total_sold_delta: int = 0
    note: Optional[str] = None


class Customer(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    type: Literal["rumahan", "warung", "pangkalan", "korporat"] = "rumahan"
    tier: Literal["eceran", "warung", "pangkalan", "korporat"] = "eceran"
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: float = 0
    payment_terms_days: int = 7
    deposit_balance: float = 0     # saldo deposit
    receivable_balance: float = 0  # piutang berjalan
    borrowed_containers: int = 0   # tabung/galon dipinjam
    created_at: datetime = Field(default_factory=now_utc)


class CustomerCreate(BaseModel):
    name: str
    type: Literal["rumahan", "warung", "pangkalan", "korporat"] = "rumahan"
    tier: Literal["eceran", "warung", "pangkalan", "korporat"] = "eceran"
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: float = 0
    payment_terms_days: int = 7
    deposit_balance: float = 0


class CartItem(BaseModel):
    product_id: str
    name: str
    qty: int
    price: float
    is_exchange: bool = True  # tukar tabung/galon kosong (returnable)
    subtotal: float


class TransactionCreate(BaseModel):
    customer_id: Optional[str] = None
    items: List[CartItem]
    payment_method: Literal["cash", "transfer", "qris", "tempo", "deposit"]
    channel: Literal["pos", "delivery", "b2b"] = "pos"
    tier: Literal["eceran", "warung", "pangkalan", "korporat"] = "eceran"
    amount_paid: float = 0
    driver_id: Optional[str] = None


class Transaction(BaseModel):
    id: str = Field(default_factory=new_id)
    invoice_no: str
    customer_id: Optional[str] = None
    customer_name: str = "Umum"
    cashier_id: str
    cashier_name: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    items: List[CartItem]
    total: float
    payment_method: str
    channel: str
    tier: str
    status: Literal["paid", "outstanding"] = "paid"
    amount_paid: float = 0
    total_hpp: float = 0
    due_date: Optional[datetime] = None
    containers_out: int = 0
    containers_in: int = 0
    created_at: datetime = Field(default_factory=now_utc)


class DriverLoad(BaseModel):
    product_id: str
    name: str
    price: float
    qty_out: int
    qty_return: int = 0


class ReconCreate(BaseModel):
    driver_id: str
    loads: List[DriverLoad]
    actual_deposit: float
    date: Optional[str] = None


class CashEntryCreate(BaseModel):
    type: Literal["in", "out"]
    category: str
    amount: float
    description: Optional[str] = None


class SupplierPurchase(BaseModel):
    product_id: str
    qty: int
    unit_cost: float
    supplier: str
    paid: bool = True  # if False -> utang supplier


class PaymentIn(BaseModel):
    amount: float = 0  # 0 or >= total means full settlement
    method: Literal["cash", "transfer", "qris"] = "cash"
    note: Optional[str] = None


class ReceivableAdjust(BaseModel):
    amount: float  # +/- delta on receivable balance
    reason: str


class DepositAdjust(BaseModel):
    amount: float  # positive = top-up, negative = koreksi/pengurangan
    reason: Optional[str] = None


class POCreate(BaseModel):
    product_id: str
    qty: int
    supplier: Optional[str] = None


class SettingsIn(BaseModel):
    default_receipt_option: Literal["print", "whatsapp", "skip"] = "whatsapp"


class ExpenseCreate(BaseModel):
    category: Literal["bbm", "gaji", "listrik", "maintenance_filter", "penyusutan", "sewa", "lainnya"]
    amount: float
    description: Optional[str] = None


# ============================ HELPERS ============================
def public_user(doc) -> dict:
    return {
        "id": doc["id"], "email": doc["email"], "name": doc["name"],
        "role": doc["role"], "disabled": doc.get("disabled", False),
        "base_salary": doc.get("base_salary", 0),
        "incentive_rate": doc.get("incentive_rate", 0),
        "phone": doc.get("phone"), "vehicle_type": doc.get("vehicle_type"),
        "plate_number": doc.get("plate_number"),
    }


async def log_receivable(customer_id: str, txn_id: Optional[str], type_: str,
                         amount: float, method: str, note: str):
    """Append to receivable ledger. Read balance AFTER customer update."""
    cust = await db.customers.find_one({"id": customer_id})
    bal = cust.get("receivable_balance", 0) if cust else 0
    await db.receivable_ledger.insert_one({
        "id": new_id(), "customer_id": customer_id, "transaction_id": txn_id,
        "type": type_, "amount": amount, "balance_after": bal,
        "method": method, "note": note, "created_at": now_utc(),
    })


def make_token(user) -> str:
    payload = {
        "sub": user["id"], "role": user["role"], "iat": now_utc(),
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES), "jti": new_id(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(token: str = Depends(oauth2_scheme)) -> dict:
    cred_err = HTTPException(status_code=401, detail="Sesi tidak valid atau kedaluwarsa",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload["sub"]
    except Exception:
        raise cred_err
    user = await db.users.find_one({"id": uid})
    if not user or user.get("disabled", False):
        raise cred_err
    return user


def require_roles(*allowed: Role):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in {r.value for r in allowed}:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran ini")
        return user
    return dep


def price_for_tier(product: dict, tier: str) -> float:
    return float(product.get(f"price_{tier}", product.get("price_eceran", 0)))


# ============================ CALCULATION MODULE ============================
def calc_hpp(cost_price: float, freight_cost: float, depreciation_cost: float) -> float:
    """HPP = biaya beli + biaya armada/ongkir + penyusutan aset."""
    return round(cost_price + freight_cost + depreciation_cost, 2)


async def check_b2b_credit(customer: Optional[dict], payment_method: str, order_value: float):
    """B2B Credit Control algorithm. Raises HTTPException if blocked."""
    if payment_method == "deposit":
        if not customer:
            raise HTTPException(400, "Metode Deposit butuh pelanggan terdaftar")
        if order_value > customer.get("deposit_balance", 0):
            raise HTTPException(400,
                f"Transaksi dikunci: Nilai order (Rp{order_value:,.0f}) melebihi sisa saldo deposit (Rp{customer.get('deposit_balance',0):,.0f})")
    if payment_method == "tempo":
        if not customer:
            raise HTTPException(400, "Metode Tempo butuh pelanggan terdaftar")
        running = customer.get("receivable_balance", 0)
        plafon = customer.get("credit_limit", 0)
        if running + order_value > plafon:
            raise HTTPException(400,
                f"Transaksi dikunci: Piutang berjalan + order (Rp{running + order_value:,.0f}) melebihi plafon kredit (Rp{plafon:,.0f})")
        # cek nota outstanding > 7 hari
        seven_days_ago = now_utc() - timedelta(days=7)
        overdue = await db.transactions.find_one({
            "customer_id": customer["id"], "status": "outstanding",
            "due_date": {"$lt": seven_days_ago},
        })
        if overdue:
            raise HTTPException(400,
                "Transaksi dikunci: Terdapat nota outstanding lebih dari 7 hari yang belum lunas")


# ============================ AUTH ROUTES ============================
@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not pwd_context.verify(data.password, user["hashed_password"]):
        raise HTTPException(401, "Email atau password salah")
    if user.get("disabled"):
        raise HTTPException(401, "Akun dinonaktifkan")
    return {"access_token": make_token(user), "token_type": "bearer", "user": public_user(user)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api.get("/users", response_model=List[UserOut])
async def list_users(user: dict = Depends(require_roles(Role.owner))):
    users = await db.users.find().to_list(500)
    return [public_user(u) for u in users]


@api.get("/users/drivers", response_model=List[UserOut])
async def list_drivers(user: dict = Depends(current_user)):
    users = await db.users.find({"role": "driver", "disabled": {"$ne": True}}).to_list(500)
    return [public_user(u) for u in users]


@api.post("/users", response_model=UserOut)
async def create_user(data: UserCreate, user: dict = Depends(require_roles(Role.owner))):
    if await db.users.find_one({"email": data.email.lower().strip()}):
        raise HTTPException(409, "Email sudah terdaftar")
    doc = {
        "id": new_id(), "email": data.email.lower().strip(), "name": data.name,
        "role": data.role.value, "disabled": False,
        "base_salary": data.base_salary, "incentive_rate": data.incentive_rate,
        "phone": data.phone, "vehicle_type": data.vehicle_type, "plate_number": data.plate_number,
        "hashed_password": pwd_context.hash(data.password), "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


@api.put("/users/{uid}", response_model=UserOut)
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(require_roles(Role.owner))):
    existing = await db.users.find_one({"id": uid})
    if not existing:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    upd = {k: v for k, v in data.model_dump().items() if v is not None and k != "password"}
    if data.role is not None:
        upd["role"] = data.role.value
    if data.password:
        upd["hashed_password"] = pwd_context.hash(data.password)
    await db.users.update_one({"id": uid}, {"$set": upd})
    return public_user({**existing, **upd})


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles(Role.owner))):
    existing = await db.users.find_one({"id": uid})
    if not existing:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    if uid == user["id"]:
        raise HTTPException(400, "Tidak bisa menonaktifkan akun sendiri")
    # soft delete
    await db.users.update_one({"id": uid}, {"$set": {"disabled": True}})
    return {"ok": True}


# ============================ PRODUCTS / INVENTORY ============================
@api.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None, user: dict = Depends(current_user)):
    q = {"category": category} if category else {}
    q["is_active"] = {"$ne": False}
    items = await db.products.find(q).sort("name", 1).to_list(1000)
    return [Product(**i) for i in items]


@api.post("/products", response_model=Product)
async def create_product(data: ProductCreate, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    p = Product(**data.model_dump())
    p.hpp = calc_hpp(p.cost_price, p.freight_cost, p.depreciation_cost)
    await db.products.insert_one(p.model_dump())
    return p


@api.put("/products/{pid}", response_model=Product)
async def update_product(pid: str, data: ProductCreate, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    existing = await db.products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Produk tidak ditemukan")
    upd = data.model_dump()
    upd["hpp"] = calc_hpp(upd["cost_price"], upd["freight_cost"], upd["depreciation_cost"])
    await db.products.update_one({"id": pid}, {"$set": upd})
    merged = {**existing, **upd}
    return Product(**merged)


@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    existing = await db.products.find_one({"id": pid})
    if not existing:
        raise HTTPException(404, "Produk tidak ditemukan")
    # if referenced by any transaction (relation constraint) -> soft delete
    used = await db.transactions.find_one({"items.product_id": pid})
    if used:
        await db.products.update_one({"id": pid}, {"$set": {"is_active": False}})
        return {"ok": True, "mode": "soft", "message": "Produk dinonaktifkan (punya riwayat transaksi)"}
    await db.products.delete_one({"id": pid})
    return {"ok": True, "mode": "hard", "message": "Produk dihapus permanen"}


@api.post("/products/{pid}/adjust", response_model=Product)
async def adjust_stock(pid: str, data: StockAdjust, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    await db.products.update_one({"id": pid}, {"$inc": {
        "stock_filled": data.stock_filled_delta,
        "stock_empty": data.stock_empty_delta,
        "total_sold": data.total_sold_delta}})
    # clamp negatives to 0 so counters never go below zero
    p = await db.products.find_one({"id": pid})
    clamp = {}
    for f in ("stock_filled", "stock_empty", "total_sold"):
        if p.get(f, 0) < 0:
            clamp[f] = 0
    if clamp:
        await db.products.update_one({"id": pid}, {"$set": clamp})
        p = await db.products.find_one({"id": pid})
    return Product(**p)


@api.post("/purchases")
async def supplier_purchase(data: SupplierPurchase, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    p = await db.products.find_one({"id": data.product_id})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    await db.products.update_one({"id": data.product_id}, {"$inc": {"stock_filled": data.qty}})
    total = data.qty * data.unit_cost
    entry = {"id": new_id(), "type": "out", "category": "pembelian_supplier",
             "amount": total, "description": f"Beli {data.qty}x {p['name']} dari {data.supplier}",
             "paid": data.paid, "created_at": now_utc()}
    await db.cash_entries.insert_one(entry)
    if not data.paid:
        await db.payables.insert_one({"id": new_id(), "supplier": data.supplier,
            "amount": total, "description": entry["description"], "status": "outstanding",
            "created_at": now_utc()})
    return {"ok": True, "total": total}


@api.get("/inventory/low-stock", response_model=List[Product])
async def low_stock(user: dict = Depends(current_user)):
    items = await db.products.find({"is_active": {"$ne": False}}).to_list(1000)
    low = [Product(**i) for i in items if i.get("stock_filled", 0) <= i.get("reorder_point", 0)]
    return low


# ============================ PURCHASE ORDERS (Reorder) ============================
@api.post("/purchase-orders")
async def create_po(data: POCreate, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    p = await db.products.find_one({"id": data.product_id})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    qty = data.qty if data.qty > 0 else max(p.get("reorder_point", 10) * 2 - p.get("stock_filled", 0), 1)
    doc = {"id": new_id(), "product_id": data.product_id, "product_name": p["name"],
           "qty": qty, "supplier": data.supplier or "", "unit_cost": p.get("cost_price", 0),
           "est_cost": round(qty * p.get("cost_price", 0), 2), "status": "draft",
           "created_at": now_utc()}
    await db.purchase_orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/purchase-orders")
async def list_po(user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    items = await db.purchase_orders.find().sort("created_at", -1).to_list(200)
    for i in items:
        i.pop("_id", None)
    return items


@api.post("/purchase-orders/{poid}/receive")
async def receive_po(poid: str, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    po = await db.purchase_orders.find_one({"id": poid})
    if not po:
        raise HTTPException(404, "PO tidak ditemukan")
    if po["status"] == "received":
        raise HTTPException(400, "PO sudah diterima")
    await db.products.update_one({"id": po["product_id"]}, {"$inc": {"stock_filled": po["qty"]}})
    await db.purchase_orders.update_one({"id": poid}, {"$set": {"status": "received", "received_at": now_utc()}})
    await db.cash_entries.insert_one({"id": new_id(), "type": "out", "category": "pembelian_supplier",
        "amount": po["est_cost"], "description": f"Terima PO {po['qty']}x {po['product_name']}",
        "created_at": now_utc()})
    return {"ok": True}


@api.delete("/purchase-orders/{poid}")
async def delete_po(poid: str, user: dict = Depends(require_roles(Role.owner, Role.warehouse_admin))):
    await db.purchase_orders.delete_one({"id": poid, "status": "draft"})
    return {"ok": True}


# ============================ SETTINGS ============================
@api.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    s = await db.settings.find_one({"id": "app"})
    return {"default_receipt_option": (s or {}).get("default_receipt_option", "whatsapp")}


@api.put("/settings")
async def update_settings(data: SettingsIn, user: dict = Depends(require_roles(Role.owner))):
    await db.settings.update_one({"id": "app"},
        {"$set": {"default_receipt_option": data.default_receipt_option}}, upsert=True)
    return {"ok": True, "default_receipt_option": data.default_receipt_option}


# ============================ CUSTOMERS / CRM ============================
@api.get("/customers", response_model=List[Customer])
async def list_customers(user: dict = Depends(current_user)):
    items = await db.customers.find().sort("name", 1).to_list(1000)
    return [Customer(**i) for i in items]


@api.post("/customers", response_model=Customer)
async def create_customer(data: CustomerCreate, user: dict = Depends(current_user)):
    c = Customer(**data.model_dump())
    await db.customers.insert_one(c.model_dump())
    return c


@api.put("/customers/{cid}", response_model=Customer)
async def update_customer(cid: str, data: CustomerCreate, user: dict = Depends(current_user)):
    existing = await db.customers.find_one({"id": cid})
    if not existing:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    await db.customers.update_one({"id": cid}, {"$set": data.model_dump()})
    return Customer(**{**existing, **data.model_dump()})


@api.post("/customers/{cid}/deposit")
async def topup_deposit(cid: str, data: DepositAdjust, user: dict = Depends(current_user)):
    c = await db.customers.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    # reducing deposit is a correction reserved for owner
    if data.amount < 0 and user["role"] != "owner":
        raise HTTPException(403, "Hanya Pemilik yang boleh mengurangi deposit")
    new_balance = c.get("deposit_balance", 0) + data.amount
    if new_balance < 0:
        raise HTTPException(400, "Saldo deposit tidak boleh negatif")
    await db.customers.update_one({"id": cid}, {"$inc": {"deposit_balance": data.amount}})
    if data.amount >= 0:
        await db.cash_entries.insert_one({"id": new_id(), "type": "in", "category": "topup_deposit",
            "amount": data.amount, "description": f"Top-up deposit {c['name']}", "created_at": now_utc()})
    else:
        await db.cash_entries.insert_one({"id": new_id(), "type": "out", "category": "koreksi_deposit",
            "amount": abs(data.amount),
            "description": f"Koreksi deposit {c['name']}: {data.reason or 'penyesuaian'}",
            "created_at": now_utc()})
    return {"ok": True, "deposit_balance": new_balance}


@api.get("/customers/{cid}/transactions", response_model=List[Transaction])
async def customer_transactions(cid: str, user: dict = Depends(current_user)):
    items = await db.transactions.find({"customer_id": cid}).sort("created_at", -1).to_list(500)
    return [Transaction(**i) for i in items]


@api.post("/customers/{cid}/adjust-receivable")
async def adjust_receivable(cid: str, data: ReceivableAdjust, user: dict = Depends(require_roles(Role.owner))):
    c = await db.customers.find_one({"id": cid})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    await db.customers.update_one({"id": cid}, {"$inc": {"receivable_balance": data.amount}})
    await log_receivable(cid, None, "adjustment", data.amount, "adjustment", data.reason)
    return {"ok": True}


@api.get("/customers/{cid}/receivable-history")
async def receivable_history(cid: str, user: dict = Depends(current_user)):
    items = await db.receivable_ledger.find({"customer_id": cid}).sort("created_at", -1).to_list(500)
    for i in items:
        i.pop("_id", None)
    return items


# ============================ POS / TRANSACTIONS ============================
async def gen_invoice_no() -> str:
    count = await db.transactions.count_documents({})
    return f"INV-{datetime.now().strftime('%y%m%d')}-{count + 1:04d}"


@api.post("/transactions", response_model=Transaction)
async def create_transaction(data: TransactionCreate, user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    if not data.items:
        raise HTTPException(400, "Keranjang kosong")
    total = round(sum(i.subtotal for i in data.items), 2)

    customer = None
    cust_name = "Umum"
    if data.customer_id:
        customer = await db.customers.find_one({"id": data.customer_id})
        if customer:
            cust_name = customer["name"]

    # B2B Credit Control
    await check_b2b_credit(customer, data.payment_method, total)

    containers_out = sum(i.qty for i in data.items if i.is_exchange)
    invoice = await gen_invoice_no()
    is_outstanding = data.payment_method == "tempo"
    due_date = None
    if is_outstanding and customer:
        due_date = now_utc() + timedelta(days=customer.get("payment_terms_days", 7))

    driver_name = None
    if data.driver_id:
        drv = await db.users.find_one({"id": data.driver_id})
        driver_name = drv["name"] if drv else None

    # snapshot HPP of goods sold (for period P&L)
    prod_map = {}
    for it in data.items:
        if it.product_id not in prod_map:
            prod_map[it.product_id] = await db.products.find_one({"id": it.product_id})
    total_hpp = round(sum((prod_map.get(it.product_id) or {}).get("hpp", 0) * it.qty for it in data.items), 2)

    txn = Transaction(
        invoice_no=invoice, customer_id=data.customer_id, customer_name=cust_name,
        cashier_id=user["id"], cashier_name=user["name"],
        driver_id=data.driver_id, driver_name=driver_name,
        items=data.items, total=total, total_hpp=total_hpp,
        payment_method=data.payment_method, channel=data.channel, tier=data.tier,
        status="outstanding" if is_outstanding else "paid",
        amount_paid=0 if is_outstanding else (data.amount_paid or total),
        due_date=due_date, containers_out=containers_out, containers_in=0,
    )
    await db.transactions.insert_one(txn.model_dump())

    # stock movements: reduce filled, increase empty (returned exchange), track sold
    for it in data.items:
        inc = {"stock_filled": -it.qty, "total_sold": it.qty}
        if it.is_exchange:
            inc["stock_empty"] = it.qty
        await db.products.update_one({"id": it.product_id}, {"$inc": inc})

    # payment side-effects
    if data.payment_method == "deposit" and customer:
        await db.customers.update_one({"id": customer["id"]}, {"$inc": {"deposit_balance": -total}})
    elif data.payment_method == "tempo" and customer:
        await db.customers.update_one({"id": customer["id"]}, {"$inc": {"receivable_balance": total}})
        await log_receivable(customer["id"], txn.id, "charge", total, "tempo",
                             f"Piutang dari nota {invoice}")
    else:
        await db.cash_entries.insert_one({"id": new_id(), "type": "in", "category": "penjualan",
            "amount": total, "description": f"Penjualan {invoice}", "related_id": txn.id,
            "created_at": now_utc()})

    return txn


@api.get("/transactions", response_model=List[Transaction])
async def list_transactions(limit: int = 100, user: dict = Depends(current_user)):
    items = await db.transactions.find().sort("created_at", -1).to_list(limit)
    return [Transaction(**i) for i in items]


@api.post("/transactions/{tid}/pay")
async def settle_transaction(tid: str, data: PaymentIn, user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    t = await db.transactions.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    if t["status"] != "outstanding":
        raise HTTPException(400, "Transaksi sudah lunas")
    remaining = round(t["total"] - t.get("amount_paid", 0), 2)
    pay = round(min(data.amount, remaining), 2) if data.amount and data.amount > 0 else remaining
    if pay <= 0:
        raise HTTPException(400, "Nominal pembayaran tidak valid")
    new_paid = round(t.get("amount_paid", 0) + pay, 2)
    fully = new_paid >= t["total"] - 0.001
    await db.transactions.update_one({"id": tid}, {"$set": {
        "amount_paid": new_paid, "status": "paid" if fully else "outstanding"}})
    if t.get("customer_id"):
        await db.customers.update_one({"id": t["customer_id"]}, {"$inc": {"receivable_balance": -pay}})
        note = data.note or (f"Pelunasan {t['invoice_no']}" if fully else f"Cicilan {t['invoice_no']}")
        await log_receivable(t["customer_id"], tid, "payment", -pay, data.method, note)
    await db.cash_entries.insert_one({"id": new_id(), "type": "in", "category": "pelunasan_piutang",
        "amount": pay, "description": f"Pembayaran piutang {t['invoice_no']}", "created_at": now_utc()})
    return {"ok": True, "paid": pay, "amount_paid": new_paid,
            "remaining": round(t["total"] - new_paid, 2), "fully_paid": fully}


# ============================ DRIVER RECONCILIATION ============================
@api.post("/recon")
async def create_recon(data: ReconCreate, user: dict = Depends(require_roles(Role.owner, Role.driver))):
    driver = await db.users.find_one({"id": data.driver_id})
    if not driver:
        raise HTTPException(404, "Driver tidak ditemukan")
    # (Stok Awal - Stok Sisa) x Harga = Total Tagihan Setoran
    expected = 0
    delivered_units = 0
    for l in data.loads:
        sold = l.qty_out - l.qty_return
        expected += sold * l.price
        delivered_units += max(sold, 0)
    expected = round(expected, 2)
    difference = round(data.actual_deposit - expected, 2)  # negative => kurang setor
    doc = {
        "id": new_id(), "driver_id": data.driver_id, "driver_name": driver["name"],
        "date": data.date or datetime.now().strftime("%Y-%m-%d"),
        "loads": [l.model_dump() for l in data.loads],
        "expected_deposit": expected, "actual_deposit": data.actual_deposit,
        "difference": difference, "delivered_units": delivered_units,
        "status": "balanced" if difference >= 0 else "shortage",
        "created_at": now_utc(),
    }
    await db.driver_recon.insert_one(doc)
    # cash in for actual deposit
    await db.cash_entries.insert_one({"id": new_id(), "type": "in", "category": "setoran_driver",
        "amount": data.actual_deposit, "description": f"Setoran {driver['name']}", "created_at": now_utc()})
    # shortage -> kasbon / potongan gaji
    if difference < 0:
        await db.driver_debts.insert_one({"id": new_id(), "driver_id": data.driver_id,
            "driver_name": driver["name"], "amount": abs(difference),
            "description": f"Selisih setoran {doc['date']}", "settled": False, "created_at": now_utc()})
    doc.pop("_id", None)
    return doc


@api.get("/recon")
async def list_recon(user: dict = Depends(current_user)):
    q = {} if user["role"] in ("owner",) else {"driver_id": user["id"]}
    items = await db.driver_recon.find(q).sort("created_at", -1).to_list(200)
    for i in items:
        i.pop("_id", None)
    return items


# ============================ PAYROLL ============================
@api.post("/payroll/{employee_id}")
async def generate_payroll(employee_id: str, period: str, user: dict = Depends(require_roles(Role.owner))):
    emp = await db.users.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    # delivery units from recon
    recons = await db.driver_recon.find({"driver_id": employee_id}).to_list(1000)
    delivery_units = sum(r.get("delivered_units", 0) for r in recons)
    # deductions from unsettled debts
    debts = await db.driver_debts.find({"driver_id": employee_id, "settled": False}).to_list(1000)
    deductions = sum(d["amount"] for d in debts)
    base = emp.get("base_salary", 0)
    rate = emp.get("incentive_rate", 0)
    incentive = delivery_units * rate
    net = round(base + incentive - deductions, 2)
    doc = {"id": new_id(), "employee_id": employee_id, "name": emp["name"], "period": period,
           "base_salary": base, "delivery_units": delivery_units, "incentive_rate": rate,
           "incentive": incentive, "deductions": deductions, "net_pay": net, "created_at": now_utc()}
    await db.payroll.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/payroll")
async def list_payroll(user: dict = Depends(require_roles(Role.owner))):
    items = await db.payroll.find().sort("created_at", -1).to_list(200)
    for i in items:
        i.pop("_id", None)
    return items


# ============================ FINANCE ============================
@api.post("/cash")
async def add_cash_entry(data: CashEntryCreate, user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_utc()}
    await db.cash_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/finance/summary")
async def finance_summary(user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    entries = await db.cash_entries.find({"deleted": {"$ne": True}}).to_list(5000)
    cash_in = sum(e["amount"] for e in entries if e["type"] == "in")
    cash_out = sum(e["amount"] for e in entries if e["type"] == "out")
    # receivables
    custs = await db.customers.find().to_list(2000)
    total_receivable = sum(c.get("receivable_balance", 0) for c in custs)
    total_deposit = sum(c.get("deposit_balance", 0) for c in custs)
    # payables
    pays = await db.payables.find({"status": "outstanding"}).to_list(2000)
    total_payable = sum(p["amount"] for p in pays)
    # sales & COGS today
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    txns = await db.transactions.find().to_list(5000)
    products = {p["id"]: p for p in await db.products.find().to_list(2000)}
    sales_today = 0
    cogs_today = 0
    sales_total = 0
    cogs_total = 0
    for t in txns:
        created = t["created_at"]
        if isinstance(created, str):
            created = datetime.fromisoformat(created)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        cogs = sum(products.get(i["product_id"], {}).get("hpp", 0) * i["qty"] for i in t["items"])
        sales_total += t["total"]
        cogs_total += cogs
        if created >= today:
            sales_today += t["total"]
            cogs_today += cogs
    return {
        "cash_balance": round(cash_in - cash_out, 2),
        "cash_in": round(cash_in, 2), "cash_out": round(cash_out, 2),
        "total_receivable": round(total_receivable, 2),
        "total_payable": round(total_payable, 2),
        "total_deposit": round(total_deposit, 2),
        "sales_today": round(sales_today, 2),
        "profit_today": round(sales_today - cogs_today, 2),
        "sales_total": round(sales_total, 2),
        "profit_total": round(sales_total - cogs_total, 2),
    }


@api.get("/finance/cashflow")
async def cashflow(user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    entries = await db.cash_entries.find({"deleted": {"$ne": True}}).sort("created_at", -1).to_list(1000)
    for e in entries:
        e.pop("_id", None)
        e["category_label"] = EXPENSE_LABELS.get(e.get("category", ""), e.get("category", ""))
    return entries


@api.delete("/finance/entry/{eid}")
async def delete_cash_entry(eid: str, user: dict = Depends(require_roles(Role.owner))):
    existing = await db.cash_entries.find_one({"id": eid})
    if not existing:
        raise HTTPException(404, "Catatan tidak ditemukan")
    await db.cash_entries.update_one({"id": eid}, {"$set": {"deleted": True, "deleted_at": now_utc()}})
    return {"ok": True}


@api.post("/finance/reset-history")
async def reset_finance_history(user: dict = Depends(require_roles(Role.owner))):
    res = await db.cash_entries.update_many(
        {"deleted": {"$ne": True}}, {"$set": {"deleted": True, "deleted_at": now_utc()}})
    await db.transactions.delete_many({})
    return {"ok": True, "cleared": res.modified_count}


@api.get("/finance/receivables", response_model=List[Transaction])
async def receivables(user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    items = await db.transactions.find({"status": "outstanding"}).sort("due_date", 1).to_list(500)
    return [Transaction(**i) for i in items]


EXPENSE_LABELS = {
    "bbm": "BBM Armada", "gaji": "Gaji Karyawan", "listrik": "Listrik Depot",
    "maintenance_filter": "Perawatan Filter", "penyusutan": "Penyusutan Wadah/Armada",
    "sewa": "Sewa/Tempat", "lainnya": "Lain-lain", "pelunasan_piutang": "Pelunasan Piutang",
    "penjualan": "Penjualan", "setoran_driver": "Setoran Driver",
    "pembelian_supplier": "Pembelian Supplier", "topup_deposit": "Top-up Deposit",
}


@api.post("/finance/expense")
async def add_expense(data: ExpenseCreate, user: dict = Depends(require_roles(Role.owner))):
    doc = {"id": new_id(), "type": "out", "category": data.category, "amount": data.amount,
           "description": data.description or EXPENSE_LABELS.get(data.category, data.category),
           "created_at": now_utc()}
    await db.cash_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


def _norm_dt(v):
    if isinstance(v, str):
        v = datetime.fromisoformat(v)
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v


def _window_metrics(txns, entries, start, end):
    """Compute income/hpp/expenses/net/outstanding for [start, end)."""
    income = {"cash": 0.0, "transfer": 0.0, "qris": 0.0, "deposit": 0.0, "piutang": 0.0}
    hpp_total = 0.0
    outstanding_total = 0.0
    for t in txns:
        c = _norm_dt(t["created_at"])
        if not (start <= c < end):
            continue
        m = t.get("payment_method")
        if m in ("cash", "transfer", "qris"):
            income[m] += t["total"]
        elif m == "deposit":
            income["deposit"] += t["total"]
        hpp_total += t.get("total_hpp", 0)
        if t.get("status") == "outstanding":
            outstanding_total += t["total"] - t.get("amount_paid", 0)
    expenses = {}
    for e in entries:
        c = _norm_dt(e["created_at"])
        if not (start <= c < end):
            continue
        cat = e.get("category", "lainnya")
        if e["type"] == "in" and cat == "pelunasan_piutang":
            income["piutang"] += e["amount"]
        elif e["type"] == "out" and cat not in ("pembelian_supplier", "koreksi_deposit"):
            expenses[cat] = expenses.get(cat, 0) + e["amount"]
    income_total = round(sum(income.values()), 2)
    expenses_total = round(sum(expenses.values()), 2)
    net = round(income_total - hpp_total - expenses_total, 2)
    return {
        "income": {k: round(v, 2) for k, v in income.items()},
        "income_total": income_total,
        "hpp_total": round(hpp_total, 2),
        "expenses": [{"category": k, "label": EXPENSE_LABELS.get(k, k), "amount": round(v, 2)}
                     for k, v in sorted(expenses.items(), key=lambda x: -x[1])],
        "expenses_total": expenses_total,
        "net_profit": net,
        "outstanding_total": round(outstanding_total, 2),
    }


@api.get("/finance/report")
async def finance_report(period: str = "monthly",
                         user: dict = Depends(require_roles(Role.owner, Role.cashier))):
    now = datetime.now(timezone.utc)
    txns = await db.transactions.find().to_list(10000)
    entries = await db.cash_entries.find({"deleted": {"$ne": True}}).to_list(20000)

    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        label = start.strftime("%d %b %Y")
    elif period == "yearly":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(year=start.year + 1)
        label = f"Tahun {start.year}"
    else:  # monthly
        period = "monthly"
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        nm = start.month % 12 + 1
        ny = start.year + (1 if start.month == 12 else 0)
        end = start.replace(year=ny, month=nm)
        label = start.strftime("%B %Y")

    summary = _window_metrics(txns, entries, start, end)

    # trend series
    trend = []
    if period == "daily":
        for i in range(6, -1, -1):
            s = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
            e = s + timedelta(days=1)
            m = _window_metrics(txns, entries, s, e)
            trend.append({"label": s.strftime("%d/%m"), "income": m["income_total"], "profit": m["net_profit"]})
    elif period == "yearly":
        for i in range(4, -1, -1):
            y = now.year - i
            s = now.replace(year=y, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            e = s.replace(year=y + 1)
            m = _window_metrics(txns, entries, s, e)
            trend.append({"label": str(y), "income": m["income_total"], "profit": m["net_profit"]})
    else:
        for mo in range(1, 13):
            s = now.replace(month=mo, day=1, hour=0, minute=0, second=0, microsecond=0)
            nm = mo % 12 + 1
            ny = now.year + (1 if mo == 12 else 0)
            e = s.replace(year=ny, month=nm)
            m = _window_metrics(txns, entries, s, e)
            trend.append({"label": s.strftime("%b"), "income": m["income_total"], "profit": m["net_profit"]})

    return {"period": period, "label": label, **summary, "trend": trend}


# ============================ ASSET BALANCE (Neraca Wadah) ============================
@api.get("/assets/balance")
async def asset_balance(user: dict = Depends(current_user)):
    """Total Aset Wadah = Isi Gudang + Kosong Gudang + Di Kurir + Dipinjamkan."""
    products = await db.products.find({"is_returnable": True}).to_list(2000)
    filled = sum(p.get("stock_filled", 0) for p in products)
    empty = sum(p.get("stock_empty", 0) for p in products)
    # di kurir: outstanding recon loads not yet returned
    recons = await db.driver_recon.find().to_list(1000)
    in_driver = 0  # containers currently on the road (simplified: 0 after recon closes)
    # borrowed by customers
    custs = await db.customers.find().to_list(2000)
    borrowed = sum(c.get("borrowed_containers", 0) for c in custs)
    per_product = [{"name": p["name"], "category": p["category"],
                    "filled": p.get("stock_filled", 0), "empty": p.get("stock_empty", 0)}
                   for p in products]
    return {
        "filled_warehouse": filled, "empty_warehouse": empty,
        "in_driver": in_driver, "borrowed_customers": borrowed,
        "total_assets": filled + empty + in_driver + borrowed,
        "per_product": per_product,
    }


# ============================ SEED ============================
async def seed():
    if await db.users.count_documents({}) > 0:
        return
    logger.info("Seeding initial data...")
    users = [
        {"email": os.environ["SEED_ADMIN_EMAIL"], "name": "Pemilik Usaha", "role": "owner",
         "password": os.environ["SEED_ADMIN_PASSWORD"], "base_salary": 0, "incentive_rate": 0},
        {"email": "kasir@gasgalon.id", "name": "Kasir Toko", "role": "cashier",
         "password": "kasir12345", "base_salary": 2500000, "incentive_rate": 0},
        {"email": "gudang@gasgalon.id", "name": "Admin Gudang", "role": "warehouse_admin",
         "password": "gudang12345", "base_salary": 3000000, "incentive_rate": 0},
        {"email": "driver@gasgalon.id", "name": "Budi Kurir", "role": "driver",
         "password": "driver12345", "base_salary": 1500000, "incentive_rate": 2000},
    ]
    for u in users:
        await db.users.insert_one({"id": new_id(), "email": u["email"].lower(), "name": u["name"],
            "role": u["role"], "disabled": False, "base_salary": u["base_salary"],
            "incentive_rate": u["incentive_rate"], "hashed_password": pwd_context.hash(u["password"]),
            "created_at": now_utc()})

    products = [
        {"name": "LPG 3 Kg (Melon)", "category": "lpg", "cost_price": 16000, "freight_cost": 1000,
         "depreciation_cost": 500, "price_eceran": 22000, "price_warung": 20000, "price_pangkalan": 18500,
         "price_korporat": 18000, "deposit_amount": 150000, "stock_filled": 120, "stock_empty": 40, "reorder_point": 30},
        {"name": "LPG 12 Kg (Biru)", "category": "lpg", "cost_price": 155000, "freight_cost": 3000,
         "depreciation_cost": 2000, "price_eceran": 210000, "price_warung": 200000, "price_pangkalan": 190000,
         "price_korporat": 185000, "deposit_amount": 350000, "stock_filled": 30, "stock_empty": 12, "reorder_point": 8},
        {"name": "Galon Aqua 19L", "category": "galon_brand", "cost_price": 16000, "freight_cost": 1500,
         "depreciation_cost": 1000, "price_eceran": 22000, "price_warung": 20000, "price_pangkalan": 19000,
         "price_korporat": 18500, "deposit_amount": 50000, "stock_filled": 80, "stock_empty": 60, "reorder_point": 20},
        {"name": "Le Minerale 15L", "category": "galon_brand", "cost_price": 15000, "freight_cost": 1500,
         "depreciation_cost": 1000, "price_eceran": 20000, "price_warung": 18500, "price_pangkalan": 17500,
         "price_korporat": 17000, "deposit_amount": 50000, "stock_filled": 45, "stock_empty": 30, "reorder_point": 15},
        {"name": "Air Isi Ulang RO 19L", "category": "refill", "cost_price": 2500, "freight_cost": 1000,
         "depreciation_cost": 500, "price_eceran": 6000, "price_warung": 5500, "price_pangkalan": 5000,
         "price_korporat": 4500, "deposit_amount": 40000, "stock_filled": 200, "stock_empty": 150, "reorder_point": 50},
    ]
    for p in products:
        prod = Product(**p)
        prod.hpp = calc_hpp(prod.cost_price, prod.freight_cost, prod.depreciation_cost)
        await db.products.insert_one(prod.model_dump())

    customers = [
        {"name": "Pangkalan Jaya Abadi", "type": "pangkalan", "tier": "pangkalan", "phone": "081234567890",
         "address": "Jl. Merdeka No.10", "credit_limit": 5000000, "payment_terms_days": 7,
         "deposit_balance": 1000000, "receivable_balance": 0},
        {"name": "Warung Bu Siti", "type": "warung", "tier": "warung", "phone": "081298765432",
         "address": "Jl. Mawar No.5", "credit_limit": 1000000, "payment_terms_days": 7,
         "deposit_balance": 200000, "receivable_balance": 0},
        {"name": "Resto Sederhana", "type": "korporat", "tier": "korporat", "phone": "081211112222",
         "address": "Jl. Sudirman No.99", "credit_limit": 10000000, "payment_terms_days": 14,
         "deposit_balance": 0, "receivable_balance": 0},
    ]
    for c in customers:
        cust = Customer(**c)
        await db.customers.insert_one(cust.model_dump())
    logger.info("Seed complete.")


@app.on_event("startup")
async def startup():
    await seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"message": "GasGalon ERP & POS API"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])
