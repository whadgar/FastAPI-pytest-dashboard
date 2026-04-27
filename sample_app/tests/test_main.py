import pytest
from fastapi.testclient import TestClient
from sample_app.main import app, _reset


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_products():
    _reset()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "product_count" in data


# ---------------------------------------------------------------------------
# List products
# ---------------------------------------------------------------------------

def test_list_products_returns_all_seeds(client):
    res = client.get("/products")
    assert res.status_code == 200
    assert len(res.json()) == 3


def test_list_products_filter_by_category(client):
    res = client.get("/products", params={"category": "Electronics"})
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    assert all(p["category"] == "Electronics" for p in items)


def test_list_products_filter_in_stock(client):
    res = client.get("/products", params={"in_stock": True})
    assert res.status_code == 200
    items = res.json()
    assert all(p["stock"] > 0 for p in items)


def test_list_products_filter_out_of_stock(client):
    res = client.get("/products", params={"in_stock": False})
    assert res.status_code == 200
    items = res.json()
    assert all(p["stock"] == 0 for p in items)


def test_list_products_filter_by_price_range(client):
    res = client.get("/products", params={"min_price": 30, "max_price": 90})
    assert res.status_code == 200
    items = res.json()
    assert all(30 <= p["price"] <= 90 for p in items)


# ---------------------------------------------------------------------------
# Get product
# ---------------------------------------------------------------------------

def test_get_product_returns_correct_product(client):
    res = client.get("/products/p001")
    assert res.status_code == 200
    assert res.json()["name"] == "Wireless Mouse"


def test_get_product_404_for_unknown(client):
    res = client.get("/products/does_not_exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Create product
# ---------------------------------------------------------------------------

def test_create_product_201_with_valid_data(client):
    payload = {"name": "New Gadget", "category": "Electronics", "price": 19.99, "stock": 5}
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "New Gadget"
    assert "id" in data


def test_create_product_409_on_duplicate_name(client):
    payload = {"name": "Wireless Mouse", "category": "Electronics", "price": 9.99, "stock": 1}
    res = client.post("/products", json=payload)
    assert res.status_code == 409


def test_create_product_422_missing_fields(client):
    res = client.post("/products", json={})
    assert res.status_code == 422


def test_create_product_422_negative_price(client):
    payload = {"name": "Broken Item", "category": "Misc", "price": -5.0, "stock": 1}
    res = client.post("/products", json=payload)
    assert res.status_code == 422


def test_create_product_422_negative_stock(client):
    payload = {"name": "Bad Stock", "category": "Misc", "price": 9.99, "stock": -1}
    res = client.post("/products", json=payload)
    assert res.status_code == 422


def test_create_product_price_rounded(client):
    payload = {"name": "Rounded Price", "category": "Misc", "price": 9.999, "stock": 1}
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    assert res.json()["price"] == 10.0


# ---------------------------------------------------------------------------
# Update product
# ---------------------------------------------------------------------------

def test_update_product_partial_update(client):
    res = client.put("/products/p001", json={"stock": 200})
    assert res.status_code == 200
    assert res.json()["stock"] == 200
    assert res.json()["name"] == "Wireless Mouse"  # unchanged


def test_update_product_full_update(client):
    payload = {"name": "Super Mouse", "category": "Electronics", "price": 39.99, "stock": 100}
    res = client.put("/products/p001", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Super Mouse"
    assert data["price"] == 39.99


def test_update_product_404_for_unknown(client):
    res = client.put("/products/nope", json={"stock": 1})
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Delete product
# ---------------------------------------------------------------------------

def test_delete_product_204_on_success(client):
    res = client.delete("/products/p001")
    assert res.status_code == 204


def test_delete_product_actually_removes_it(client):
    client.delete("/products/p001")
    res = client.get("/products/p001")
    assert res.status_code == 404


def test_delete_product_404_on_unknown(client):
    res = client.delete("/products/ghost")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_zero_stock_allowed(client):
    payload = {"name": "No Stock Item", "category": "Rare", "price": 999.99, "stock": 0}
    res = client.post("/products", json=payload)
    assert res.status_code == 201
    assert res.json()["stock"] == 0


def test_name_must_be_at_least_2_chars(client):
    payload = {"name": "X", "category": "Misc", "price": 1.0, "stock": 1}
    res = client.post("/products", json=payload)
    assert res.status_code == 422
