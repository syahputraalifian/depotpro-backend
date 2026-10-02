import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import uuid
from bson import ObjectId, errors

from fastapi import FastAPI, HTTPException, Body, Request, status
from fastapi.middleware.cors import CORSMiddleware
import jwt
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

# ==========================================
# KONFIGURASI & MONGODB ATLAS INTEGRATION
# ==========================================
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

# ==========================================
# FUNGSIONALITAS UTAMA: VALIDASI & EKSEKUSI HAPUS MONGODB
# ==========================================
async def execute_mongo_delete(collection, item_id: str) -> bool:
    """
    Fungsi penanganan hapus presisi:
    1. Memeriksa validitas ID.
    2. Menyiapkan kueri pencocokan ganda (field 'id' string, '_id' string, dan BSON '_id' ObjectId).
    3. Mengembalikan status sukses jika dokumen terhapus dari MongoDB Atlas.
    """
    if not item_id or not isinstance(item_id, str):
        return False
    
    clean_id = item_id.strip()
    
    or_conditions = [
        {"id": clean_id},
        {"_id": clean_id}
    ]
    
    if ObjectId.is_valid(clean_id):
        try:
            or_conditions.append({"_id": ObjectId(clean_id)})
        except errors.InvalidId:
            pass

    result = await collection.delete_one({"$or": or_conditions})
    return result.deleted_count > 0

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

@app.get("/dashboard")
@app.get("/api/dashboard")
async def get_dashboard():
    try:
        pipeline = [{"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}]
        agg_result = await db.transactions.aggregate(pipeline).to_list(length=1)
        revenue = agg_result[0]["total_revenue"] if agg_result else 0
        tx_count = agg_result[0]["count"] if agg_result else 0

        recent_tx = []
        cursor = db.transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(5)
        async for doc in cursor:
            recent_tx.append(doc)

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
        return {"status": "error", "revenue": 0, "transactions_count": 0, "low_stock_count": 0, "recent_transactions": [], "low_stock_items": []}

# ==========================================
# ENDPOINT PRODUK (CRUD & DELETE)
# ==========================================
@app.get("/products")
@app.get("/api/products")
async def get_products():
    products = []
    cursor = db.products.find({})
    async for doc in cursor:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
            if not doc.get("id"):
                doc["id"] = doc["_id"]
        products.append(doc)
    return products

@app.post("/products")
@app.post("/api/products")
async def create_product(payload: Dict[str, Any] = Body(...)):
    if not payload.get("id"):
        payload["id"] = str(uuid.uuid4())
    await db.products.update_one({"id": payload["id"]}, {"$set": payload}, upsert=True)
    return payload

@app.delete("/products/{product_id}")
@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str):
    if not product_id or product_id == "undefined":
        raise HTTPException(status_code=400, detail="ID produk tidak valid atau kosong")
    
    is_deleted = await execute_mongo_delete(db.products, product_id)
    if is_deleted:
        return {"status": "success", "message": f"Produk dengan ID {product_id} berhasil dihapus"}
    
    raise HTTPException(status_code=404, detail="Produk tidak ditemukan di MongoDB Atlas")

# ==========================================
# ENDPOINT TRANSAKSI & LAPORAN
# ==========================================
@app.get("/reports")
@app.get("/api/reports")
async def get_reports():
    transactions = []
    cursor = db.transactions.find({}).sort("created_at", -1)
    async for doc in cursor:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
            if not doc.get("id"):
                doc["id"] = doc["_id"]
        transactions.append(doc)
    total_income = sum(t.get("total_amount", 0) for t in transactions)
    return {"status": "success", "daily": total_income, "total_transactions": len(transactions), "data": transactions}

@app.post("/transactions")
@app.post("/api/transactions")
async def create_transaction(payload: Dict[str, Any] = Body(...)):
    payload["id"] = str(uuid.uuid4())
    payload["created_at"] = datetime.utcnow().isoformat()
    await db.transactions.insert_one(payload)
    for item in payload.get("items", []):
        await db.products.update_one(
            {"id": item.get("product_id")},
            {"$inc": {"stock_filled": -item.get("qty", 0), "total_sold": item.get("qty", 0)}}
        )
    if "_id" in payload:
        del payload["_id"]
    return {"status": "success", "data": payload}

@app.delete("/reports/{tx_id}")
@app.delete("/api/reports/{tx_id}")
@app.delete("/transactions/{tx_id}")
@app.delete("/api/transactions/{tx_id}")
async def delete_transaction(tx_id: str):
    if not tx_id or tx_id == "undefined":
        raise HTTPException(status_code=400, detail="ID transaksi tidak valid atau kosong")
        
    is_deleted = await execute_mongo_delete(db.transactions, tx_id)
    if is_deleted:
        return {"status": "success", "message": f"Transaksi dengan ID {tx_id} berhasil dihapus"}
    
    raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan di MongoDB Atlas")

# ==========================================
# ENDPOINT PELANGGAN & DRIVER
# ==========================================
@app.get("/customers")
@app.get("/api/customers")
async def get_customers():
    customers = []
    cursor = db.customers.find({})
    async for doc in cursor:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
            if not doc.get("id"):
                doc["id"] = doc["_id"]
        customers.append(doc)
    return customers

@app.delete("/customers/{customer_id}")
@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str):
    if await execute_mongo_delete(db.customers, customer_id):
        return {"status": "success", "message": "Pelanggan berhasil dihapus"}
    raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")

@app.get("/drivers")
@app.get("/api/drivers")
async def get_drivers():
    drivers = []
    cursor = db.drivers.find({})
    async for doc in cursor:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
            if not doc.get("id"):
                doc["id"] = doc["_id"]
        drivers.append(doc)
    return drivers

@app.delete("/drivers/{driver_id}")
@app.delete("/api/drivers/{driver_id}")
async def delete_driver(driver_id: str):
    if await execute_mongo_delete(db.drivers, driver_id):
        return {"status": "success", "message": "Driver berhasil dihapus"}
    raise HTTPException(status_code=404, detail="Driver tidak ditemukan")

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    return {"status": "success", "message": f"Intercepted: {full_path}", "data": []}