"""Tests for chat endpoints."""

import pytest


async def _get_auth_token(client) -> str:
    resp = await client.post("/api/auth/register", json={
        "email": "chattest@example.com",
        "username": "chattester",
        "password": "securepass123",
    })
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_conversation(client):
    token = await _get_auth_token(client)
    resp = await client.post(
        "/api/chat/conversations",
        json={"title": "Test Chat"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Chat"


@pytest.mark.asyncio
async def test_list_conversations(client):
    token = await _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/chat/conversations", json={"title": "Chat 1"}, headers=headers)
    await client.post("/api/chat/conversations", json={"title": "Chat 2"}, headers=headers)

    resp = await client.get("/api/chat/conversations", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_delete_conversation(client):
    token = await _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/api/chat/conversations", json={"title": "To Delete"}, headers=headers
    )
    convo_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/chat/conversations/{convo_id}", headers=headers)
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_health_check(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
