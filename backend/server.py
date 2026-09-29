import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Body
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
async def root():
    return {"status": "ok", "message": "GasGalon ERP Backend Active"}

@app.post("/api/auth/login")
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
# DASHBOARD & DATA ENDPOINTS (MENCEGAH 404)
# ==========================================
@app.get("/api/dashboard")
@app.get("/api/dashboard/summary")
@app.get("/api/dashboard/stats")
async def get_dashboard_summary():
    return {
        "status": "success",
        "revenue": 0,
        "transactions_count": 0,
        "low_stock_count": 0,
        "recent_transactions": [],
        "low_stock_items": []
    }

@app.get("/api/stock")
@app.get("/api/products")
async def get_stock():
    return []

@app.get("/api/transactions")
async def get_transactions():
    return []

@app.get("/api/users/me")
async def get_current_user():
    return {
        "email": "owner@gasgalon.id",
        "name": "Pemilik Depot",
        "role": "owner"
    }

@app.get("/api/reports")
@app.get("/api/reports/financial")
async def get_reports():
    return {"daily": 0, "monthly": 0, "yearly": 0}