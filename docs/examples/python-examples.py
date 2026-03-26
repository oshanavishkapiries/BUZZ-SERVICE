#!/usr/bin/env python3
"""
Buzz Notification Service - Python Examples
"""

import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8080/api/v1"
API_KEY = "YOUR_API_KEY"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}


def send_email_notification(email: str, subject: str, body: str) -> Dict[str, Any]:
    """Send a single email notification"""
    payload = {
        "channel": "email",
        "priority": "normal",
        "recipient": {
            "email": email,
            "name": email.split("@")[0]
        },
        "subject": subject,
        "body": body,
        "max_retries": 3
    }
    
    response = requests.post(
        f"{BASE_URL}/notifications",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def send_sms_notification(phone: str, body: str, priority: str = "normal") -> Dict[str, Any]:
    """Send a single SMS notification"""
    payload = {
        "channel": "sms",
        "priority": priority,
        "recipient": {
            "phone": phone
        },
        "body": body,
        "max_retries": 2
    }
    
    response = requests.post(
        f"{BASE_URL}/notifications",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def send_push_notification(device_token: str, title: str, body: str) -> Dict[str, Any]:
    """Send a push notification"""
    payload = {
        "channel": "push",
        "priority": "high",
        "recipient": {
            "device_token": device_token
        },
        "subject": title,
        "body": body
    }
    
    response = requests.post(
        f"{BASE_URL}/notifications",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def send_bulk_notifications(datasource_name: str, endpoint_name: str, 
                           template_name: str, channel: str,
                           endpoint_params: Dict[str, Any] = None,
                           template_data: Dict[str, Any] = None,
                           idempotency_key: str = None) -> Dict[str, Any]:
    """Send bulk notifications to multiple recipients"""
    payload = {
        "datasource_name": datasource_name,
        "endpoint_name": endpoint_name,
        "endpoint_params": endpoint_params or {},
        "template_name": template_name,
        "template_data": template_data or {},
        "channel": channel,
        "priority": "normal"
    }
    
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    
    response = requests.post(
        f"{BASE_URL}/batches/send",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def get_batch_status(batch_id: str) -> Dict[str, Any]:
    """Get status of a bulk notification batch"""
    response = requests.get(
        f"{BASE_URL}/batches/{batch_id}",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def list_batches(status: str = None, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
    """List bulk notification batches"""
    params = {
        "limit": limit,
        "offset": offset
    }
    if status:
        params["status"] = status
    
    response = requests.get(
        f"{BASE_URL}/batches",
        headers=HEADERS,
        params=params
    )
    response.raise_for_status()
    return response.json()


def get_inbox(limit: int = 20, offset: int = 0, unread_only: bool = False) -> Dict[str, Any]:
    """Get user's inbox"""
    params = {
        "limit": limit,
        "offset": offset,
        "unread_only": unread_only
    }
    
    response = requests.get(
        f"{BASE_URL}/inbox",
        headers=HEADERS,
        params=params
    )
    response.raise_for_status()
    return response.json()


def mark_inbox_as_read(entry_id: str) -> Dict[str, Any]:
    """Mark an inbox entry as read"""
    response = requests.patch(
        f"{BASE_URL}/inbox/{entry_id}/read",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def mark_all_inbox_as_read() -> Dict[str, Any]:
    """Mark all inbox entries as read"""
    response = requests.post(
        f"{BASE_URL}/inbox/read-all",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def delete_inbox_entry(entry_id: str) -> Dict[str, Any]:
    """Delete an inbox entry"""
    response = requests.delete(
        f"{BASE_URL}/inbox/{entry_id}",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def create_template(name: str, body: str, channels: list, 
                   subject: str = None, variables: list = None) -> Dict[str, Any]:
    """Create a notification template"""
    payload = {
        "name": name,
        "channels": channels,
        "body": body
    }
    if subject:
        payload["subject"] = subject
    if variables:
        payload["variables"] = variables
    
    response = requests.post(
        f"{BASE_URL}/templates",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def get_template(name: str) -> Dict[str, Any]:
    """Get a template by name"""
    response = requests.get(
        f"{BASE_URL}/templates/{name}",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def register_device(token: str, platform: str, device_name: str = None) -> Dict[str, Any]:
    """Register a push notification device"""
    payload = {
        "token": token,
        "platform": platform
    }
    if device_name:
        payload["device_name"] = device_name
    
    response = requests.post(
        f"{BASE_URL}/devices/register",
        headers=HEADERS,
        json=payload
    )
    response.raise_for_status()
    return response.json()


def list_devices() -> Dict[str, Any]:
    """List user's registered devices"""
    response = requests.get(
        f"{BASE_URL}/devices",
        headers=HEADERS
    )
    response.raise_for_status()
    return response.json()


def get_queue_stats(queue_name: str = None) -> Dict[str, Any]:
    """Get queue statistics"""
    if queue_name:
        url = f"{BASE_URL}/monitoring/queues/{queue_name}"
    else:
        url = f"{BASE_URL}/monitoring/stats"
    
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()
    return response.json()


# Example usage
if __name__ == "__main__":
    # Send single email
    print("Sending single email...")
    result = send_email_notification("john@example.com", "Welcome!", "Welcome to Buzz Service!")
    print(json.dumps(result, indent=2))
    
    # Send SMS
    print("\nSending SMS...")
    result = send_sms_notification("+1234567890", "Your OTP is 123456")
    print(json.dumps(result, indent=2))
    
    # Send bulk
    print("\nSending bulk notifications...")
    result = send_bulk_notifications(
        datasource_name="crm_database",
        endpoint_name="active_users",
        template_name="weekly_digest",
        channel="email",
        endpoint_params={"status": "active"},
        template_data={"week": 12},
        idempotency_key="weekly-12-2026"
    )
    print(json.dumps(result, indent=2))
    
    # Get inbox
    print("\nGetting inbox...")
    result = get_inbox(limit=5)
    print(json.dumps(result, indent=2))
