package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/elight/buzz-service/internal/domain"
)

// Client fetches recipients from registered datasources
type Client struct {
	httpClient *http.Client
}

// Recipient represents a recipient from a datasource
type Recipient struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	DeviceToken string `json:"device_token"`
}

// NewClient creates a new datasource client
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// FetchRecipients fetches recipients from a registered datasource
func (c *Client) FetchRecipients(
	ctx context.Context,
	ds *domain.Datasource,
	endpointName string,
	params map[string]interface{},
) ([]Recipient, error) {
	// Get endpoint configuration
	endpointConfig, ok := ds.Endpoints[endpointName].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("endpoint %s not found", endpointName)
	}

	// Build URL
	path, ok := endpointConfig["path"].(string)
	if !ok {
		return nil, fmt.Errorf("endpoint %s missing path", endpointName)
	}

	method, ok := endpointConfig["method"].(string)
	if !ok {
		method = "GET"
	}

	// Replace path parameters
	for key, value := range params {
		placeholder := fmt.Sprintf("{%s}", key)
		path = strings.ReplaceAll(path, placeholder, fmt.Sprint(value))
	}

	url := ds.BaseURL + path

	// Add query parameters for GET requests
	if method == "GET" && len(params) > 0 {
		queryParams := make([]string, 0)
		for key, value := range params {
			if !strings.Contains(path, fmt.Sprintf("{%s}", key)) {
				queryParams = append(queryParams, fmt.Sprintf("%s=%v", key, value))
			}
		}
		if len(queryParams) > 0 {
			url += "?" + strings.Join(queryParams, "&")
		}
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if err := c.addAuth(req, ds); err != nil {
		return nil, err
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("datasource returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Extract recipients using response format config
	responseFormat, ok := endpointConfig["response_format"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("endpoint %s missing response_format", endpointName)
	}

	recipientsKey, ok := responseFormat["recipients_key"].(string)
	if !ok {
		recipientsKey = "recipients"
	}

	recipientsData, ok := response[recipientsKey].([]interface{})
	if !ok {
		return nil, fmt.Errorf("recipients data not found at key: %s", recipientsKey)
	}

	// Map to Recipient struct
	recipients := make([]Recipient, 0, len(recipientsData))
	emailField, _ := responseFormat["email_field"].(string)
	if emailField == "" {
		emailField = "email"
	}
	phoneField, _ := responseFormat["phone_field"].(string)
	if phoneField == "" {
		phoneField = "phone"
	}
	nameField, _ := responseFormat["name_field"].(string)
	if nameField == "" {
		nameField = "name"
	}

	for _, item := range recipientsData {
		data, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		recipient := Recipient{
			ID:    getString(data, "id"),
			Name:  getString(data, nameField),
			Email: getString(data, emailField),
			Phone: getString(data, phoneField),
		}

		if tokenField, ok := responseFormat["device_token_field"].(string); ok {
			recipient.DeviceToken = getString(data, tokenField)
		}

		recipients = append(recipients, recipient)
	}

	return recipients, nil
}

// FetchRecipientsWithPagination handles paginated endpoints
func (c *Client) FetchRecipientsWithPagination(
	ctx context.Context,
	ds *domain.Datasource,
	endpointName string,
	params map[string]interface{},
) ([]Recipient, error) {
	allRecipients := make([]Recipient, 0)
	page := 1
	perPage := 100

	for {
		paginatedParams := make(map[string]interface{})
		for k, v := range params {
			paginatedParams[k] = v
		}
		paginatedParams["page"] = page
		paginatedParams["per_page"] = perPage

		recipients, err := c.FetchRecipients(ctx, ds, endpointName, paginatedParams)
		if err != nil {
			return nil, err
		}

		if len(recipients) == 0 {
			break
		}

		allRecipients = append(allRecipients, recipients...)

		if len(recipients) < perPage {
			break
		}

		page++
	}

	return allRecipients, nil
}

// addAuth adds authentication headers based on auth type
func (c *Client) addAuth(req *http.Request, ds *domain.Datasource) error {
	if ds.AuthConfig == nil {
		return nil
	}

	switch ds.AuthType {
	case "bearer":
		token, ok := ds.AuthConfig["token"].(string)
		if !ok {
			return fmt.Errorf("bearer auth missing token")
		}
		req.Header.Set("Authorization", "Bearer "+token)

	case "basic":
		username, ok := ds.AuthConfig["username"].(string)
		if !ok {
			return fmt.Errorf("basic auth missing username")
		}
		password, ok := ds.AuthConfig["password"].(string)
		if !ok {
			return fmt.Errorf("basic auth missing password")
		}
		req.SetBasicAuth(username, password)

	case "api_key":
		headerName, ok := ds.AuthConfig["header"].(string)
		if !ok {
			return fmt.Errorf("api_key auth missing header")
		}
		apiKey, ok := ds.AuthConfig["key"].(string)
		if !ok {
			return fmt.Errorf("api_key auth missing key")
		}
		req.Header.Set(headerName, apiKey)

	case "":
		// No auth required

	default:
		return fmt.Errorf("unsupported auth type: %s", ds.AuthType)
	}

	return nil
}

// getString safely gets a string value from a map
func getString(data map[string]interface{}, key string) string {
	if val, ok := data[key]; ok && val != nil {
		return fmt.Sprint(val)
	}
	return ""
}
