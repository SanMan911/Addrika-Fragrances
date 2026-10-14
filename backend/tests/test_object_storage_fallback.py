"""Test object storage both with Emergent key and with MongoDB automatic fallback."""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import pytest
import os
import asyncio
from services.object_storage import is_configured, put_object, get_object, make_path
from dependencies import db
import services.object_storage as obj_mod


@pytest.mark.asyncio
async def test_object_storage_primary():
    """When EMERGENT_LLM_KEY is configured, put_object and get_object work with Emergent."""
    assert is_configured() is True
    test_data = b"Hello Emergent Object Storage Test!"
    path = make_path("tests", "unit_test", "txt")
    
    res = await put_object(path, test_data, "text/plain")
    assert res is not None, "put_object should succeed"
    assert "path" in res
    
    got = await get_object(res["path"])
    assert got is not None, "get_object should return content"
    content, ctype = got
    assert content == test_data
    assert "text/plain" in ctype


@pytest.mark.asyncio
async def test_object_storage_mongodb_fallback(monkeypatch):
    """When EMERGENT_LLM_KEY is missing/unset, put_object and get_object seamlessly fall back to MongoDB."""
    monkeypatch.setenv("EMERGENT_LLM_KEY", "")
    obj_mod._storage_key = None
    assert is_configured() is True
    
    test_data = b"Fallback to MongoDB binary storage!"
    path = make_path("tests", "fallback_test", "txt")
    
    res = await put_object(path, test_data, "text/plain")
    assert res is not None, "MongoDB fallback put_object should succeed"
    assert res["path"] == path
    
    got = await get_object(path)
    assert got is not None, "MongoDB fallback get_object should return content"
    content, ctype = got
    assert content == test_data
    assert ctype == "text/plain"
    
    # Cleanup test entry
    from pymongo import MongoClient
    mc = MongoClient(os.environ["MONGO_URL"])
    mc[os.environ["DB_NAME"]].object_storage_files.delete_one({"path": path})
    mc.close()

