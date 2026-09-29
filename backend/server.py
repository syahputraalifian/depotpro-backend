import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
import jwt

# ==========================================
# KONFIGURASI
# ==========================================
JWT_SECRET = os.getenv("JWT_SECRET", "depotpro_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

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
}

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

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
    print(f"📥 PAYLOAD LOGIN: {payload}")
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
# ROUTE UTAMA DASHBOARD & PROFIL
# ==========================================
DASHBOARD_DATA = {
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

@app.get("/dashboard")
@app.get("/api/dashboard")
@app.get("/dashboard/summary")
@app.get("/api/dashboard/summary")
@app.get("/dashboard/stats")
@app.get("/api/dashboard/stats")
@app.post("/dashboard")
@app.post("/api/dashboard")
async def get_dashboard():
    return DASHBOARD_DATA

@app.get("/users/me")
@app.get("/api/users/me")
@app.get("/auth/me")
@app.get("/api/auth/me")
@app.get("/profile")
@app.get("/api/profile")
async def get_me():
    return {"email": "owner@gasgalon.id", "name": "Pemilik Depot", "role": "owner"}

@app.get("/stock")
@app.get("/api/stock")
@app.get("/products")
@app.get("/api/products")
async def get_stock():
    return []

@app.get("/transactions")
@app.get("/api/transactions")
@app.get("/sales")
@app.get("/api/sales")
async def get_transactions():
    return []

@app.get("/reports")
@app.get("/api/reports")
@app.get("/reports/financial")
@app.get("/api/reports/financial")
async def get_reports():
    return {"daily": 0, "monthly": 0, "yearly": 0, "data": []}
# ====================================================================
# API PRODUCT HANDLERS (Mencegah Request Jatuh ke Catch-All Interceptor)
# ====================================================================

from pydantic import BaseModel
from typing import Optional
import uuid

class ProductModel(BaseModel):
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

@app.post("/products")
@app.post("/api/products")
async def create_product_real(product: ProductModel):
    new_product = product.dict()
    new_product["id"] = str(uuid.uuid4())
    new_product["total_sold"] = 0
    
    # Jika server menggunakan state memory internal
    if hasattr(app, "state") and hasattr(app.state, "products"):
        if isinstance(app.state.products, list):
            app.state.products.append(new_product)
            
    print(f"[SUCCESS] Produk berhasil ditambahkan: {new_product['name']}")
    return new_product

@app.get("/products")
@app.get("/api/products")
async def get_products_real():
    if hasattr(app, "state") and hasattr(app.state, "products"):
        return app.state.products
    return []


# ====================================================================
# CATCH-ALL WILDCARD INTERCEPTOR (Harus Berada di Paling Bawah File)
# ====================================================================

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(request: Request, full_path: str):
    print(f"REQUEST DIPEGANG CATCH-ALL: {request.method} /{full_path}")
    return {
        "status": "success",
        "message": f"Intercepted: {full_path}",
        "data": [],
        "result": []
    }
# ==========================================
# CATCH-ALL WILDCARD (Satu-satunya Penuntas 404)
# ==========================================
@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    print(f"🚨 REQUEST DIPEGANG CATCH-ALL: {request.method} /{full_path}")
    return {
        "status": "success",
        "message": f"Intercepted: {full_path}",
        "data": [],
        "result": []
    }