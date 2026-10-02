import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import uuid
from bson import ObjectId, errors

from fastapi import FastAPI, HTTPException, Body, Request, status
from fastapi.middleware.cors import CORSMiddleware
import jwt
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
# FUNGSI HAPUS MONGODB PRESISI
# ==========================================
async def delete_document_by_id(collection, item_id: str) -> bool:
    if not item_id or item_id == "undefined":
        return False
    
    clean_id = str(item_id).strip()
    
    or_conditions = [
        {"id": clean_id},
        {"_id": clean_id}
    ]
    
    if len(clean_id) == 24 and ObjectId.is_valid(clean_id):
        try:
            or_conditions.append({"_id": ObjectId(clean_id)})
        except Exception:
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
        cursor = db.transactions.find({}).sort("created_at", -1).limit(5)
        async for doc in cursor:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
                if not doc.get("id"):
                    doc["id"] = doc["_id"]
            recent_tx.append(doc)

        low_stock = []
        cursor_stock = db.products.find({"$expr": {"$lte": ["$stock_filled", "$reorder_point"]}})
        async for doc in cursor_stock:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
                if not doc.get("id"):
                    doc["id"] = doc["_id"]
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
# ENDPOINT PRODUK
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

@app.delete("/products/{id}")
@app.delete("/api/products/{id}")
async def delete_product(id: str):
    if not id or id == "undefined":
        raise HTTPException(status_code=400, detail="Format ID tidak valid")
    
    deleted = await delete_document_by_id(db.products, id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Data produk tidak ditemukan")
    
    return {"success": True, "status": "success", "message": "Data produk berhasil dihapus"}

# ==========================================
# ENDPOINT TRANSAKSI / LAPORAN
# ==========================================
@app.get("/reports")
@app.get("/api/reports")
@app.get("/finance")
@app.get("/api/finance")
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

@app.delete("/reports/{id}")
@app.delete("/api/reports/{id}")
@app.delete("/finance/{id}")
@app.delete("/api/finance/{id}")
async def delete_finance_report(id: str):
    if not id or id == "undefined":
        raise HTTPException(status_code=400, detail="Format ID tidak valid")
        
    deleted = await delete_document_by_id(db.transactions, id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Data laporan tidak ditemukan")
    
    return {"success": True, "status": "success", "message": "Data laporan berhasil dihapus"}

# ==========================================
# ENDPOINT PELANGGAN (GET, POST, DELETE)
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

@app.post("/customers")
@app.post("/api/customers")
async def create_or_update_customer(payload: Dict[str, Any] = Body(...)):
    item_id = payload.get("id") or str(uuid.uuid4())
    payload["id"] = item_id
    payload["updated_at"] = datetime.utcnow().isoformat()
    if "created_at" not in payload:
        payload["created_at"] = datetime.utcnow().isoformat()

    await db.customers.update_one({"id": item_id}, {"$set": payload}, upsert=True)
    return {"success": True, "data": payload}

@app.delete("/customers/{id}")
@app.delete("/api/customers/{id}")
async def delete_customer(id: str):
    if not id or id == "undefined":
        raise HTTPException(status_code=400, detail="Format ID tidak valid")

    if await delete_document_by_id(db.customers, id):
        return {"success": True, "message": "Data pelanggan berhasil dihapus"}
    raise HTTPException(status_code=404, detail="Data pelanggan tidak ditemukan")

# ==========================================
# ENDPOINT DRIVER (GET, POST, DELETE)
# ==========================================
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

@app.post("/drivers")
@app.post("/api/drivers")
async def create_or_update_driver(payload: Dict[str, Any] = Body(...)):
    item_id = payload.get("id") or str(uuid.uuid4())
    payload["id"] = item_id
    payload["updated_at"] = datetime.utcnow().isoformat()
    if "created_at" not in payload:
        payload["created_at"] = datetime.utcnow().isoformat()

    await db.drivers.update_one({"id": item_id}, {"$set": payload}, upsert=True)
    return {"success": True, "data": payload}

@app.delete("/drivers/{id}")
@app.delete("/api/drivers/{id}")
async def delete_driver(id: str):
    if not id or id == "undefined":
        raise HTTPException(status_code=400, detail="Format ID tidak valid")

    if await delete_document_by_id(db.drivers, id):
        return {"success": True, "message": "Data driver berhasil dihapus"}
    raise HTTPException(status_code=404, detail="Data driver tidak ditemukan")

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    raise HTTPException(status_code=404, detail=f"Rute API /{full_path} tidak ditemukan")