/**
 * Buzz Notification Service - JavaScript/TypeScript Examples
 */

const BASE_URL = 'http://localhost:8080/api/v1';
const API_KEY = 'YOUR_API_KEY';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// ==================== Single Notifications ====================

/**
 * Send a single email notification
 */
async function sendEmailNotification(email, subject, body) {
  const payload = {
    channel: 'email',
    priority: 'normal',
    recipient: {
      email,
      name: email.split('@')[0]
    },
    subject,
    body,
    max_retries: 3
  };

  const response = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Send an SMS notification
 */
async function sendSmsNotification(phone, body, priority = 'normal') {
  const payload = {
    channel: 'sms',
    priority,
    recipient: { phone },
    body,
    max_retries: 2
  };

  const response = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Send a push notification
 */
async function sendPushNotification(deviceToken, title, body) {
  const payload = {
    channel: 'push',
    priority: 'high',
    recipient: { device_token: deviceToken },
    subject: title,
    body
  };

  const response = await fetch(`${BASE_URL}/notifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Bulk Notifications ====================

/**
 * Send bulk notifications to multiple recipients
 */
async function sendBulkNotifications(datasourceName, endpointName, templateName, channel, options = {}) {
  const payload = {
    datasource_name: datasourceName,
    endpoint_name: endpointName,
    endpoint_params: options.endpointParams || {},
    template_name: templateName,
    template_data: options.templateData || {},
    channel,
    priority: options.priority || 'normal'
  };

  if (options.idempotencyKey) {
    payload.idempotency_key = options.idempotencyKey;
  }

  const response = await fetch(`${BASE_URL}/batches/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Get batch status
 */
async function getBatchStatus(batchId) {
  const response = await fetch(`${BASE_URL}/batches/${batchId}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * List batches with optional filtering
 */
async function listBatches(options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 10,
    offset: options.offset || 0
  });

  if (options.status) {
    params.append('status', options.status);
  }

  const response = await fetch(`${BASE_URL}/batches?${params}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Inbox / In-App Notifications ====================

/**
 * Get user's inbox
 */
async function getInbox(options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 20,
    offset: options.offset || 0,
    unread_only: options.unreadOnly || false
  });

  const response = await fetch(`${BASE_URL}/inbox?${params}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Mark an inbox entry as read
 */
async function markInboxAsRead(entryId) {
  const response = await fetch(`${BASE_URL}/inbox/${entryId}/read`, {
    method: 'PATCH',
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Mark all inbox entries as read
 */
async function markAllInboxAsRead() {
  const response = await fetch(`${BASE_URL}/inbox/read-all`, {
    method: 'POST',
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Delete an inbox entry
 */
async function deleteInboxEntry(entryId) {
  const response = await fetch(`${BASE_URL}/inbox/${entryId}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Real-time Stream (SSE) ====================

/**
 * Connect to real-time notification stream
 */
function subscribeToNotifications(callbacks = {}) {
  const eventSource = new EventSource(`${BASE_URL}/stream`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  eventSource.addEventListener('notification', (event) => {
    const notification = JSON.parse(event.data);
    if (callbacks.onNotification) {
      callbacks.onNotification(notification);
    }
  });

  eventSource.addEventListener('heartbeat', (event) => {
    if (callbacks.onHeartbeat) {
      callbacks.onHeartbeat();
    }
  });

  eventSource.addEventListener('error', (event) => {
    if (callbacks.onError) {
      callbacks.onError(event);
    }
    eventSource.close();
  });

  return eventSource;
}

// ==================== Templates ====================

/**
 * Create a notification template
 */
async function createTemplate(name, body, channels, options = {}) {
  const payload = {
    name,
    channels,
    body
  };

  if (options.subject) {
    payload.subject = options.subject;
  }
  if (options.variables) {
    payload.variables = options.variables;
  }

  const response = await fetch(`${BASE_URL}/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Get a template
 */
async function getTemplate(name) {
  const response = await fetch(`${BASE_URL}/templates/${name}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Device Management ====================

/**
 * Register a device for push notifications
 */
async function registerDevice(token, platform, options = {}) {
  const payload = {
    token,
    platform
  };

  if (options.deviceName) {
    payload.device_name = options.deviceName;
  }
  if (options.deviceId) {
    payload.device_id = options.deviceId;
  }

  const response = await fetch(`${BASE_URL}/devices/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * List user's devices
 */
async function listDevices() {
  const response = await fetch(`${BASE_URL}/devices`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Unregister a device
 */
async function unregisterDevice(token) {
  const response = await fetch(`${BASE_URL}/devices/${token}`, {
    method: 'DELETE',
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Monitoring ====================

/**
 * Get queue statistics
 */
async function getQueueStats(queueName = null) {
  const url = queueName
    ? `${BASE_URL}/monitoring/queues/${queueName}`
    : `${BASE_URL}/monitoring/stats`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// ==================== Example Usage ====================

(async () => {
  try {
    // Send single email
    console.log('Sending email...');
    const email = await sendEmailNotification(
      'john@example.com',
      'Welcome!',
      'Welcome to Buzz Service!'
    );
    console.log(JSON.stringify(email, null, 2));

    // Send SMS
    console.log('\nSending SMS...');
    const sms = await sendSmsNotification(
      '+1234567890',
      'Your OTP is 123456'
    );
    console.log(JSON.stringify(sms, null, 2));

    // Send bulk
    console.log('\nSending bulk notifications...');
    const bulk = await sendBulkNotifications(
      'crm_database',
      'active_users',
      'weekly_digest',
      'email',
      {
        endpointParams: { status: 'active' },
        templateData: { week: 12 },
        idempotencyKey: 'weekly-12-2026'
      }
    );
    console.log(JSON.stringify(bulk, null, 2));

    // Get inbox
    console.log('\nGetting inbox...');
    const inbox = await getInbox({ limit: 5 });
    console.log(JSON.stringify(inbox, null, 2));

    // Subscribe to real-time notifications
    console.log('\nSubscribing to real-time notifications...');
    subscribeToNotifications({
      onNotification: (notification) => {
        console.log('New notification:', notification);
      },
      onHeartbeat: () => {
        console.log('Heartbeat');
      },
      onError: (error) => {
        console.error('Stream error:', error);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
})();

// Export for module usage
export {
  sendEmailNotification,
  sendSmsNotification,
  sendPushNotification,
  sendBulkNotifications,
  getBatchStatus,
  listBatches,
  getInbox,
  markInboxAsRead,
  markAllInboxAsRead,
  deleteInboxEntry,
  subscribeToNotifications,
  createTemplate,
  getTemplate,
  registerDevice,
  listDevices,
  unregisterDevice,
  getQueueStats
};
