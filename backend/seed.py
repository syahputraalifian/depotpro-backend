import asyncio
import os
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

# Setup Hashing & Database
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017") # Menyesuaikan koneksi DB
DB_NAME = os.getenv("DB_NAME", "depotpro")

demo_users = [
    {
        "email": "owner@gasgalon.id",
        "username": "owner@gasgalon.id",
        "hashed_password": pwd_context.hash("owner12345"),
        "role": "owner",
        "name": "Pemilik Depot"
    },
    {
        "email": "kasir@gasgalon.id",
        "username": "kasir@gasgalon.id",
        "hashed_password": pwd_context.hash("kasir12345"),
        "role": "kasir",
        "name": "Kasir Depot"
    },
    {
        "email": "gudang@gasgalon.id",
        "username": "gudang@gasgalon.id",
        "hashed_password": pwd_context.hash("gudang12345"),
        "role": "gudang",
        "name": "Staf Gudang"
    },
    {
        "email": "driver@gasgalon.id",
        "username": "driver@gasgalon.id",
        "hashed_password": pwd_context.hash("driver12345"),
        "role": "driver",
        "name": "Driver Kurir"
    }
]

async def seed():
    # Ambil MONGO_URL dari env jika ada
    mongo_uri = os.environ.get("MONGO_URL") or os.environ.get("DATABASE_URL")
    if not mongo_uri:
        print("PERINGATAN: MONGO_URL/DATABASE_URL tidak ditemukan di env lokal, pastikan diset jika menggunakan DB Cloud.")
        return

    client = AsyncIOMotorClient(mongo_uri)
    db = client.get_default_database() if not DB_NAME else client[DB_NAME]
    users_collection = db["users"]

    for u in demo_users:
        existing = await users_collection.find_one({"email": u["email"]})
        if not existing:
            await users_collection.insert_one(u)
            print(f"✅ Berhasil membuat user demo: {u['email']}")
        else:
            # Update password jika user sudah ada
            await users_collection.update_one(
                {"email": u["email"]},
                {"$set": {"hashed_password": u["hashed_password"]}}
            )
            print(f"ℹ️ User {u['email']} sudah ada (password diperbarui).")

if __name__ == "__main__":
    asyncio.run(seed())