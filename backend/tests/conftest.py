import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

CREDS = {
    "owner": ("owner@gasgalon.id", "owner12345"),
    "cashier": ("kasir@gasgalon.id", "kasir12345"),
    "warehouse": ("gudang@gasgalon.id", "gudang12345"),
    "driver": ("driver@gasgalon.id", "driver12345"),
}


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def tokens():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    out = {}
    for role, (email, pwd) in CREDS.items():
        data = _login(session, email, pwd)
        out[role] = {"token": data["access_token"], "user": data["user"]}
    return out


def _client(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return s


@pytest.fixture()
def owner_client(tokens):
    return _client(tokens["owner"]["token"])


@pytest.fixture()
def cashier_client(tokens):
    return _client(tokens["cashier"]["token"])


@pytest.fixture()
def warehouse_client(tokens):
    return _client(tokens["warehouse"]["token"])


@pytest.fixture()
def driver_client(tokens):
    return _client(tokens["driver"]["token"])
