"""Seed manual: python seed.py  (memakai MONGO_URL/DB_NAME yang sama dengan server.py).

Idempoten: hanya menambah user demo & produk awal yang belum ada, tidak pernah menimpa password.
"""
import asyncio

from server import seed_database

if __name__ == "__main__":
    asyncio.run(seed_database())
    print("Seed selesai.")
