import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
import jwt

# ==========================================
# KONFIGURASI DAN DATABASE
# ==========================================
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "depotpro")
JWT_SECRET = os.getenv("JWT_SECRET", "depotpro_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Hari

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="GasGalon ERP Backend")

# Middleware CORS (Izinkan koneksi dari React Native / Expo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# SCHEMAS (PYDANTIC)
# ==========================================
class LoginRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# ==========================================
# AKUN DEMO & AUTO-SEEDER
# ==========================================
DEMO_USERS = {
    "owner@gasgalon.id": ("owner12345", "owner", "Pemilik Depot"),
    "kasir@gasgalon.id": ("kasir12345", "kasir", "Kasir Depot"),
    "gudang@gasgalon.id": ("gudang12345", "gudang", "Staf Gudang"),
    "driver@gasgalon.id": ("driver12345", "driver", "Driver Kurir"),
}

async def auto_seed_demo_users():
    """Otomatis mendaftarkan akun demo ke database jika belum ada"""
    try:
        for email, (plain_pass, role, name) in DEMO_USERS.items():
            existing = await db.users.find_one({"$or": [{"email": email}, {"username": email}]})
            if not existing:
                hashed = pwd_context.hash(plain_pass)
                user_doc = {
                    "email": email,
                    "username": email,
                    "hashed_password": hashed,
                    "role": role,
                    "name": name,
                    "created_at": datetime.utcnow()
                }
                await db.users.insert_one(user_doc)
                print(f"✅ Auto-seeded account: {email}")
    except Exception as e:
        print(f"⚠️ Auto-seed info: {e}")

@app.on_event("startup")
async def startup_event():
    await auto_seed_demo_users()

# ==========================================
# HELPER TOKEN
# ==========================================
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

# ==========================================
# ENDPOINTS
# ==========================================
@app.get("/")
async def root():
    return {"status": "ok", "message": "GasGalon ERP Backend Active"}

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest = Body(...)):
    identifier = data.email or data.username
    if not identifier:
        raise HTTPException(
            status_code=400, 
            detail="Email atau username wajib diisi"
        )

    # 1. Cari user di Database
    user = await db.users.find_one({"$or": [{"email": identifier}, {"username": identifier}]})

    # 2. Jika user belum ada di DB tapi merupakan akun demo, buatkan instan
    if not user and identifier in DEMO_USERS:
        plain_pass, role, name = DEMO_USERS[identifier]
        user = {
            "email": identifier,
            "username": identifier,
            "hashed_password": pwd_context.hash(plain_pass),
            "role": role,
            "name": name,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user)

    # 3. Verifikasi Keberadaan User & Password
    if not user or not pwd_context.verify(data.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=401, 
            detail="Email atau password salah"
        )

    # 4. Generate JWT Token & Respon
    token_data = {
        "sub": str(user.get("_id", user["email"])),
        "email": user["email"],
        "role": user.get("role", "owner")
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["email"],
            "name": user.get("name", "User"),
            "role": user.get("role", "owner")
        }
    }