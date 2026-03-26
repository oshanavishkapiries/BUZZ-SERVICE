package realtime

import (
	"bufio"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/elight/buzz-service/pkg/logger"
)

// SSEConnection represents a single SSE client connection
type SSEConnection struct {
	ID     string
	UserID string
	writer *bufio.Writer
	done   chan struct{}
	mu     sync.Mutex
	logger logger.Logger
}

// NewSSEConnection creates a new SSE connection
func NewSSEConnection(userID string, writer *bufio.Writer, logger logger.Logger) *SSEConnection {
	return &SSEConnection{
		ID:     uuid.New().String(),
		UserID: userID,
		writer: writer,
		done:   make(chan struct{}),
		logger: logger,
	}
}

// Send sends an SSE event to the client
func (c *SSEConnection) Send(event string, data interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// SSE format: event: <event>\ndata: <json>\n\n
	if _, err := fmt.Fprintf(c.writer, "event: %s\n", event); err != nil {
		return err
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(c.writer, "data: %s\n\n", jsonData); err != nil {
		return err
	}

	return c.writer.Flush()
}

// Ping sends a heartbeat/keep-alive comment
func (c *SSEConnection) Ping() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// SSE comment (: prefix) for keep-alive without event
	if _, err := c.writer.WriteString(": ping\n\n"); err != nil {
		return err
	}

	return c.writer.Flush()
}

// Close closes the connection
func (c *SSEConnection) Close() {
	select {
	case <-c.done:
		// Already closed
	default:
		close(c.done)
	}
}

// Done returns a channel that closes when connection is done
func (c *SSEConnection) Done() <-chan struct{} {
	return c.done
}

// ConnectionManager manages multiple SSE connections per user
type ConnectionManager struct {
	connections map[string][]*SSEConnection // userID -> []*SSEConnection
	mu          sync.RWMutex
}

// NewConnectionManager creates a new connection manager
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string][]*SSEConnection),
	}
}

// Add adds a connection for a user
func (m *ConnectionManager) Add(userID string, conn *SSEConnection) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.connections[userID] = append(m.connections[userID], conn)
}

// Remove removes a specific connection for a user
func (m *ConnectionManager) Remove(userID string, connID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	connections := m.connections[userID]
	for i, conn := range connections {
		if conn.ID == connID {
			conn.Close()
			m.connections[userID] = append(connections[:i], connections[i+1:]...)
			break
		}
	}

	// Clean up empty user entries
	if len(m.connections[userID]) == 0 {
		delete(m.connections, userID)
	}
}

// GetUserConnections returns all connections for a user
func (m *ConnectionManager) GetUserConnections(userID string) []*SSEConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return a copy of the slice
	if conns, ok := m.connections[userID]; ok {
		connsCopy := make([]*SSEConnection, len(conns))
		copy(connsCopy, conns)
		return connsCopy
	}
	return []*SSEConnection{}
}

// CloseAll closes all connections
func (m *ConnectionManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, connections := range m.connections {
		for _, conn := range connections {
			conn.Close()
		}
	}

	m.connections = make(map[string][]*SSEConnection)
}

// GetStats returns statistics about connections
func (m *ConnectionManager) GetStats() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]int)
	totalConnections := 0

	for _, connections := range m.connections {
		totalConnections += len(connections)
	}

	stats["total_users"] = len(m.connections)
	stats["total_connections"] = totalConnections

	return stats
}
