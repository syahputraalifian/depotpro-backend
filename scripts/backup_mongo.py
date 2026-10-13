"""Cadangan MongoDB ke berkas JSON terkompres (.json.gz).

Pakai:
    MONGO_URL="mongodb+srv://..." DB_NAME=gasgalon_erp python3 scripts/backup_mongo.py [berkas_keluaran]

Butuh: pip install "pymongo>=4.6" dnspython
Berkas berisi SEMUA data (termasuk hash password): jangan disimpan tanpa enkripsi di tempat umum.
"""
import datetime
import gzip
import os
import sys

from bson import json_util
from pymongo import MongoClient


def main() -> int:
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGO_URI")
    if not uri:
        print("MONGO_URL belum diset", file=sys.stderr)
        return 2
    db_name = os.environ.get("DB_NAME") or "gasgalon_erp"
    out = sys.argv[1] if len(sys.argv) > 1 else f"backup-{datetime.date.today().isoformat()}.json.gz"

    client = MongoClient(uri, serverSelectionTimeoutMS=30000)
    db = client[db_name]
    data = {"meta": {"db": db_name, "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "counts": {}},
            "collections": {}}
    total = 0
    for name in sorted(db.list_collection_names()):
        if name.startswith("system."):
            continue
        docs = list(db[name].find({}))
        data["collections"][name] = docs
        data["meta"]["counts"][name] = len(docs)
        total += len(docs)

    if total == 0:
        print("Database kosong / tidak terbaca: cadangan dibatalkan agar tidak menimpa cadangan bagus dengan yang kosong.", file=sys.stderr)
        return 3

    with gzip.open(out, "wt", encoding="utf-8") as f:
        f.write(json_util.dumps(data))
    print(f"Cadangan selesai: {out}")
    for name, n in data["meta"]["counts"].items():
        print(f"  {name}: {n} dokumen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
