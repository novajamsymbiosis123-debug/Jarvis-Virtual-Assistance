"""Tests for authentication endpoints."""

import pytest


@pytest.mark.asyncio
async def test_register(client):
    resp = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "securepass123",
        "full_name": "Test User",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_register_duplicate(client):
    payload = {
        "email": "dup@example.com",
        "username": "dupuser",
        "password": "securepass123",
    }
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login(client):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "username": "loginuser",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "username": "wronguser",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "badpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_profile(client):
    reg = await client.post("/api/auth/register", json={
        "email": "profile@example.com",
        "username": "profileuser",
        "password": "securepass123",
    })
    token = reg.json()["access_token"]
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "profile@example.com"


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 403
