"""Pulihkan cadangan (.json.gz) ke MongoDB.

Pakai (default = simulasi, tidak mengubah apa pun):
    MONGO_URL="mongodb+srv://..." DB_NAME=gasgalon_erp python3 scripts/restore_mongo.py backup.json.gz
Terapkan sungguhan (menimpa dokumen dengan _id yang sama, tidak menghapus dokumen lain):
    ... python3 scripts/restore_mongo.py backup.json.gz --apply
"""
import gzip
import os
import sys

from bson import json_util
from pymongo import MongoClient


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    apply = "--apply" in sys.argv
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGO_URI")
    if not uri:
        print("MONGO_URL belum diset", file=sys.stderr)
        return 2
    db_name = os.environ.get("DB_NAME") or "gasgalon_erp"

    with gzip.open(path, "rt", encoding="utf-8") as f:
        data = json_util.loads(f.read())
    print(f"Cadangan dari {data['meta'].get('created_at')} (db asal: {data['meta'].get('db')})")
    db = MongoClient(uri, serverSelectionTimeoutMS=30000)[db_name]
    for name, docs in data["collections"].items():
        print(f"  {name}: {len(docs)} dokumen" + ("" if apply else "  (simulasi)"))
        if apply:
            for d in docs:
                db[name].replace_one({"_id": d["_id"]}, d, upsert=True)
    print("Selesai." if apply else "Simulasi selesai. Tambahkan --apply untuk benar-benar memulihkan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
