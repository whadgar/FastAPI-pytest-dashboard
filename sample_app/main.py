from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional
import uuid

app = FastAPI(title="Product Inventory API", version="1.0.0")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: int

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 100:
            raise ValueError("name must be 2-100 characters")
        return v

    @field_validator("category")
    @classmethod
    def category_length(cls, v: str) -> str:
        v = v.strip()
        if not 2 <= len(v) <= 50:
            raise ValueError("category must be 2-50 characters")
        return v

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be greater than 0")
        return round(v, 2)

    @field_validator("stock")
    @classmethod
    def stock_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("stock must be >= 0")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not 2 <= len(v) <= 100:
                raise ValueError("name must be 2-100 characters")
        return v

    @field_validator("category")
    @classmethod
    def category_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not 2 <= len(v) <= 50:
                raise ValueError("category must be 2-50 characters")
        return v

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v <= 0:
                raise ValueError("price must be greater than 0")
            return round(v, 2)
        return v

    @field_validator("stock")
    @classmethod
    def stock_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("stock must be >= 0")
        return v


# ---------------------------------------------------------------------------
# In-memory store + seed data
# ---------------------------------------------------------------------------

SEED = [
    {"id": "p001", "name": "Wireless Mouse",      "category": "Electronics",  "price": 29.99, "stock": 150},
    {"id": "p002", "name": "Mechanical Keyboard", "category": "Electronics",  "price": 89.99, "stock": 75},
    {"id": "p003", "name": "USB-C Hub",           "category": "Accessories",  "price": 45.00, "stock": 0},
]

_products: dict[str, dict] = {p["id"]: dict(p) for p in SEED}


def _reset():
    """Restore seed data — used by tests."""
    _products.clear()
    for p in SEED:
        _products[p["id"]] = dict(p)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "product_count": len(_products)}


@app.get("/products", tags=["products"])
def list_products(
    category: Optional[str] = Query(None),
    in_stock: Optional[bool] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
):
    items = list(_products.values())
    if category is not None:
        items = [p for p in items if p["category"].lower() == category.lower()]
    if in_stock is not None:
        items = [p for p in items if (p["stock"] > 0) == in_stock]
    if min_price is not None:
        items = [p for p in items if p["price"] >= min_price]
    if max_price is not None:
        items = [p for p in items if p["price"] <= max_price]
    return items


@app.get("/products/{product_id}", tags=["products"])
def get_product(product_id: str):
    product = _products.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    return product


@app.post("/products", status_code=201, tags=["products"])
def create_product(data: ProductCreate):
    for p in _products.values():
        if p["name"].lower() == data.name.lower():
            raise HTTPException(status_code=409, detail=f"Product name '{data.name}' already exists")
    product_id = f"p{str(uuid.uuid4())[:8]}"
    product = {"id": product_id, **data.model_dump()}
    _products[product_id] = product
    return product


@app.put("/products/{product_id}", tags=["products"])
def update_product(product_id: str, data: ProductUpdate):
    product = _products.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    updates = data.model_dump(exclude_none=True)
    if "name" in updates:
        for pid, p in _products.items():
            if pid != product_id and p["name"].lower() == updates["name"].lower():
                raise HTTPException(status_code=409, detail=f"Product name '{updates['name']}' already exists")
    product.update(updates)
    return product


@app.delete("/products/{product_id}", status_code=204, tags=["products"])
def delete_product(product_id: str):
    if product_id not in _products:
        raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
    del _products[product_id]
