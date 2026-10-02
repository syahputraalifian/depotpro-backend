import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import uuid

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import jwt
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

JWT_SECRET = os.getenv("JWT_SECRET", "depotpro_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

ATLAS_MONGO_URI = "mongodb+srv://syahputraalifian_db_user:t5RklJ9LCVT6HFcy@cluster0.il9x6dt.mongodb.net/gasgalon_erp?retryWrites=true&w=majority"
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL") or ATLAS_MONGO_URI
DB_NAME = os.getenv("DB_NAME", "gasgalon_erp")

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
# PRODUCTS (GET, POST, DELETE)
# ==========================================
class ProductModel(BaseModel):
    id: Optional[str] = None
    name: str
    category: str = "lpg"
    is_returnable: bool = True
    cost_price: float = 0
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
async def get_products():
    products = []
    cursor = db.products.find({}, {"_id": 0})
    async for doc in cursor:
        products.append(doc)
    return products

@app.post("/products")
@app.post("/api/products")
async def save_product(product: ProductModel):
    p_data = product.dict()
    if not p_data.get("id"):
        p_data["id"] = f"prod-{uuid.uuid4().hex[:8]}"
    await db.products.update_one({"id": p_data["id"]}, {"$set": p_data}, upsert=True)
    return p_data

@app.delete("/products/{product_id}")
@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"status": "success", "message": "Produk terhapus dari MongoDB"}

# ==========================================
# CUSTOMERS (GET, POST, DELETE)
# ==========================================
class CustomerModel(BaseModel):
    id: Optional[str] = None
    name: str
    phone: str
    address: str
    type: str = "eceran"
    gallon_deposit_qty: int = 0
    lpg_deposit_qty: int = 0

@app.get("/customers")
@app.get("/api/customers")
async def get_customers():
    customers = []
    cursor = db.customers.find({}, {"_id": 0})
    async for doc in cursor:
        customers.append(doc)
    return customers

@app.post("/customers")
@app.post("/api/customers")
async def save_customer(cust: CustomerModel):
    c_data = cust.dict()
    if not c_data.get("id"):
        c_data["id"] = f"cust-{uuid.uuid4().hex[:8]}"
    await db.customers.update_one({"id": c_data["id"]}, {"$set": c_data}, upsert=True)
    return c_data

@app.delete("/customers/{customer_id}")
@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str):
    res = await db.customers.delete_one({"id": customer_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"status": "success", "message": "Pelanggan terhapus dari MongoDB"}

# ==========================================
# REPORTS / TRANSACTIONS (GET, POST, DELETE)
# ==========================================
@app.get("/reports")
@app.get("/api/reports")
async def get_reports():
    transactions = []
    cursor = db.transactions.find({}, {"_id": 0}).sort("created_at", -1)
    async for doc in cursor:
        transactions.append(doc)
    total_income = sum(t.get("total_amount", 0) for t in transactions)
    return {"status": "success", "daily": total_income, "total_transactions": len(transactions), "data": transactions}

@app.delete("/reports/{tx_id}")
@app.delete("/api/reports/{tx_id}")
@app.delete("/transactions/{tx_id}")
@app.delete("/api/transactions/{tx_id}")
async def delete_transaction(tx_id: str):
    res = await db.transactions.delete_one({"id": tx_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return {"status": "success", "message": "Transaksi terhapus dari MongoDB"}

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    return {"status": "success", "message": f"Intercepted: {full_path}", "data": []}