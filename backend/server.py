import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import uuid

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import jwt
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

# ==========================================
# KONFIGURASI & MONGODB INTEGRATION
# ==========================================
JWT_SECRET = os.getenv("JWT_SECRET", "depotpro_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "depotpro_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

app = FastAPI(title="GasGalon ERP Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_USERS = {
    "owner@gasgalon.id": ("owner12345", "owner", "Pemilik Depot"),
    "kasir@gasgalon.id": ("kasir12345", "kasir", "Kasir Depot"),
    "gudang@gasgalon.id": ("gudang12345", "gudang", "Staf Gudang"),
    "driver@gasgalon.id": ("driver12345", "driver", "Driver Kurir"),
    "owner@depot.com": ("password_owner", "owner", "Owner Depot"),
}

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

# Inisialisasi Seed Data di MongoDB jika database masih kosong
@app.on_event("startup")
async def startup_event():
    try:
        count = await db.products.count_documents({})
        if count == 0:
            initial_products = [
                {
                    "id": "prod-default-1",
                    "name": "Gas LPG 3 Kg",
                    "category": "lpg",
                    "is_returnable": True,
                    "cost_price": 16000,
                    "freight_cost": 1000,
                    "depreciation_cost": 500,
                    "price_eceran": 20000,
                    "price_warung": 18500,
                    "price_pangkalan": 17500,
                    "price_korporat": 17000,
                    "deposit_amount": 100000,
                    "stock_filled": 50,
                    "stock_empty": 20,
                    "reorder_point": 10,
                    "total_sold": 0
                },
                {
                    "id": "prod-default-2",
                    "name": "Air Galon Brand 19L",
                    "category": "galon_brand",
                    "is_returnable": True,
                    "cost_price": 14000,
                    "freight_cost": 1000,
                    "depreciation_cost": 500,
                    "price_eceran": 20000,
                    "price_warung": 18000,
                    "price_pangkalan": 17000,
                    "price_korporat": 16500,
                    "deposit_amount": 50000,
                    "stock_filled": 30,
                    "stock_empty": 15,
                    "reorder_point": 10,
                    "total_sold": 0
                }
            ]
            await db.products.insert_many(initial_products)
            print("🌱 [SEED] Berhasil menginisialisasi produk awal ke MongoDB Atlas")
    except Exception as e:
        print(f"⚠️ [MONGO WARNING] Gagal menginisialisasi DB: {e}")

# ==========================================
# AUTH ENDPOINTS
# ==========================================
@app.get("/")
@app.get("/api")
async def root():
    return {"status": "ok", "message": "GasGalon ERP Backend Active"}

@app.post("/api/auth/login")
@app.post("/auth/login")
@app.post("/login")
async def login(payload: Dict[str, Any] = Body(...)):
    identifier = str(payload.get("email") or payload.get("username") or payload.get("identifier") or "").strip().lower()
    password = str(payload.get("password") or payload.get("pass") or "").strip()

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Email dan password wajib diisi")

    if identifier in DEMO_USERS:
        valid_password, role, name = DEMO_USERS[identifier]
        if password == valid_password:
            token_data = {"sub": identifier, "email": identifier, "role": role}
            access_token = create_access_token(token_data)
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {"email": identifier, "name": name, "role": role}
            }

    raise HTTPException(status_code=401, detail="Email atau password salah")

# ==========================================
# DASHBOARD & PROFIL
# ==========================================
@app.get("/dashboard")
@app.get("/api/dashboard")
async def get_dashboard():
    return {
        "status": "success",
        "revenue": 0,
        "transactions_count": 0,
        "low_stock_count": 0,
        "recent_transactions": [],
        "low_stock_items": [],
        "daily_revenue": 0,
        "monthly_revenue": 0,
        "total_sales": 0,
        "data": []
    }

@app.get("/users/me")
@app.get("/api/users/me")
@app.get("/auth/me")
@app.get("/api/auth/me")
@app.get("/profile")
@app.get("/api/profile")
async def get_me():
    return {"email": "owner@gasgalon.id", "name": "Pemilik Depot", "role": "owner"}

# ====================================================================
# API PRODUCT HANDLERS (MongoDB Persistent)
# ====================================================================

class ProductModel(BaseModel):
    id: Optional[str] = None
    name: str
    category: str = "lpg"
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

@app.get("/products")
@app.get("/api/products")
async def get_products_real():
    try:
        products = []
        cursor = db.products.find({}, {"_id": 0})
        async for doc in cursor:
            products.append(doc)
        return products
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []

@app.post("/products")
@app.post("/api/products")
async def create_product_real(product: ProductModel):
    try:
        new_product = product.dict()
        if not new_product.get("id"):
            new_product["id"] = f"prod-{uuid.uuid4().hex[:8]}"
        new_product["total_sold"] = new_product.get("total_sold", 0)

        # Simpan/update ke MongoDB (upsert)
        await db.products.update_one(
            {"id": new_product["id"]},
            {"$set": new_product},
            upsert=True
        )
        print(f"[SUCCESS MONGO] Produk berhasil disimpan: {new_product['name']}")
        return new_product
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan ke MongoDB: {str(e)}")

class TransactionItemModel(BaseModel):
    product_id: str
    product_name: str
    qty: int
    price: float

class TransactionModel(BaseModel):
    items: List[TransactionItemModel]
    total_amount: float
    payment_method: str = "cash"  # cash, qris, transfer
    customer_name: Optional[str] = "Eceran / Umum"

@app.post("/transactions")
@app.post("/api/transactions")
async def create_transaction(tx: TransactionModel):
    try:
        tx_data = tx.dict()
        tx_data["id"] = f"tx-{uuid.uuid4().hex[:8]}"
        tx_data["created_at"] = datetime.utcnow().isoformat()

        # 1. Simpan data transaksi ke koleksi transactions di MongoDB
        await db.transactions.insert_one(tx_data)

        # 2. Kurangi stok terisi (stock_filled) & tambah total_sold untuk tiap produk
        for item in tx.items:
            await db.products.update_one(
                {"id": item.product_id},
                {
                    "$inc": {
                        "stock_filled": -item.qty,
                        "total_sold": item.qty
                    }
                }
            )

        # Hapus _id BSON bawaan MongoDB sebelum return JSON
        if "_id" in tx_data:
            del tx_data["_id"]

        print(f"[TRANSACTION SUCCESS] TX ID: {tx_data['id']} | Total: {tx_data['total_amount']}")
        return {"status": "success", "data": tx_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses transaksi: {str(e)}")

        @app.get("/dashboard")
@app.get("/api/dashboard")
async def get_dashboard():
    try:
        # Hitung total omzet & jumlah transaksi dari MongoDB
        pipeline = [
            {"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}
        ]
        agg_result = await db.transactions.aggregate(pipeline).to_list(length=1)
        
        revenue = agg_result[0]["total_revenue"] if agg_result else 0
        tx_count = agg_result[0]["count"] if agg_result else 0

        # Ambil 5 transaksi terakhir
        recent_tx = []
        cursor = db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(5)
        async for doc in cursor:
            recent_tx.append(doc)

        # Ambil produk dengan stok kritis (di bawah reorder point)
        low_stock = []
        cursor_stock = db.products.find({"$expr": {"$lte": ["$stock_filled", "$reorder_point"]}}, {"_id": 0})
        async for doc in cursor_stock:
            low_stock.append(doc)

        return {
            "status": "success",
            "revenue": revenue,
            "transactions_count": tx_count,
            "low_stock_count": len(low_stock),
            "recent_transactions": recent_tx,
            "low_stock_items": low_stock,
            "daily_revenue": revenue,
            "monthly_revenue": revenue,
            "total_sales": revenue,
            "data": []
        }
    except Exception as e:
        print(f"Error dashboard: {e}")
        return {"status": "error", "revenue": 0, "transactions_count": 0, "low_stock_count": 0, "recent_transactions": [], "low_stock_items": []}

@app.get("/reports")
@app.get("/api/reports")
@app.get("/reports/financial")
@app.get("/api/reports/financial")
async def get_reports():
    try:
        transactions = []
        cursor = db.transactions.find({}, {"_id": 0}).sort("created_at", -1)
        async for doc in cursor:
            transactions.append(doc)

        total_income = sum(t.get("total_amount", 0) for t in transactions)

        return {
            "status": "success",
            "daily": total_income,
            "monthly": total_income,
            "yearly": total_income,
            "total_transactions": len(transactions),
            "data": transactions
        }
    except Exception as e:
        return {"daily": 0, "monthly": 0, "yearly": 0, "total_transactions": 0, "data": []}
# ====================================================================
# CATCH-ALL WILDCARD
# ====================================================================

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    print(f"🚨 REQUEST DIPEGANG CATCH-ALL: {request.method} /{full_path}")
    return {
        "status": "success",
        "message": f"Intercepted: {full_path}",
        "data": [],
        "result": []
    }