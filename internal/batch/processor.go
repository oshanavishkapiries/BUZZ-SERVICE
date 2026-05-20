package batch

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/datasource"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/store"
	"github.com/google/uuid"
)

// Processor handles batch processing and fan-out
type Processor struct {
	store              *store.PostgresStore
	dsClient           *datasource.Client
	templateRepository *store.TemplateRepository
	provider           provider.Provider
}

// NewProcessor creates a new batch processor
func NewProcessor(
	s *store.PostgresStore,
	dsClient *datasource.Client,
	templateRepository *store.TemplateRepository,
	prov provider.Provider,
) *Processor {
	return &Processor{
		store:              s,
		dsClient:           dsClient,
		templateRepository: templateRepository,
		provider:           prov,
	}
}

// ProcessBatch fetches recipients from datasource and sends notifications
func (p *Processor) ProcessBatch(ctx context.Context, appID uuid.UUID, batchID uuid.UUID) error {
	// Fetch batch
	batch, err := p.store.GetBatch(ctx, appID, batchID)
	if err != nil {
		return fmt.Errorf("failed to fetch batch: %w", err)
	}

	// Update status to FETCHING
	if err := p.store.UpdateBatchStatus(ctx, appID, batchID, domain.BatchStatusFetching); err != nil {
		return fmt.Errorf("failed to update batch status to FETCHING: %w", err)
	}

	// Fetch datasource
	if batch.DatasourceID == nil {
		return p.failBatch(ctx, appID, batchID, "batch has no datasource configured")
	}
	ds, err := p.store.GetDatasourceByID(ctx, appID, *batch.DatasourceID)
	if err != nil {
		return p.failBatch(ctx, appID, batchID, fmt.Sprintf("failed to fetch datasource: %v", err))
	}

	// Fetch recipients from datasource
	recipients, err := p.dsClient.FetchRecipientsWithPagination(ctx, ds, batch.EndpointName, batch.EndpointParams)
	if err != nil {
		return p.failBatch(ctx, appID, batchID, fmt.Sprintf("failed to fetch recipients: %v", err))
	}

	// Update total count
	if err := p.store.UpdateBatchTotal(ctx, appID, batchID, len(recipients)); err != nil {
		return p.failBatch(ctx, appID, batchID, fmt.Sprintf("failed to update batch total: %v", err))
	}

	// Update status to QUEUED
	if err := p.store.UpdateBatchStatus(ctx, appID, batchID, domain.BatchStatusQueued); err != nil {
		return p.failBatch(ctx, appID, batchID, fmt.Sprintf("failed to update batch status to QUEUED: %v", err))
	}

	// Update status to DELIVERING
	if err := p.store.UpdateBatchStatus(ctx, appID, batchID, domain.BatchStatusDelivering); err != nil {
		return p.failBatch(ctx, appID, batchID, fmt.Sprintf("failed to update batch status to DELIVERING: %v", err))
	}

	// Create notifications for each recipient (fan-out)
	for _, r := range recipients {
		recipient := map[string]interface{}{
			"id":           r.ID,
			"name":         r.Name,
			"email":        r.Email,
			"phone":        r.Phone,
			"device_token": r.DeviceToken,
		}
		if err := p.createNotificationForRecipient(ctx, appID, batch, recipient); err != nil {
			// Log error but continue with other recipients
			fmt.Printf("failed to create notification for recipient: %v\n", err)
			if err := p.store.IncrementBatchFailed(ctx, appID, batchID); err != nil {
				fmt.Printf("failed to increment batch failed count: %v\n", err)
			}
			continue
		}

		if err := p.store.IncrementBatchSent(ctx, appID, batchID); err != nil {
			fmt.Printf("failed to increment batch sent count: %v\n", err)
		}
	}

	// Update status to COMPLETED
	return p.store.UpdateBatchStatus(ctx, appID, batchID, domain.BatchStatusCompleted)
}

// createNotificationForRecipient creates a notification for a single recipient
func (p *Processor) createNotificationForRecipient(ctx context.Context, appID uuid.UUID, batch *domain.Batch, recipient map[string]interface{}) error {
	// Render template with recipient data
	subject, body, err := p.renderTemplate(ctx, appID, batch.TemplateName, batch.TemplateData, recipient)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	// Create notification based on channel
	notification := &domain.Notification{
		ApplicationID: appID,
		BatchID:       &batch.ID,
		Channel:       batch.Channel,
		Subject:       &subject,
		Body:          body,
		Priority:      batch.Priority,
		Recipient:     recipient,
		Status:        domain.StatusPending,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Send notification via provider
	return p.provider.Send(ctx, notification)
}

// renderTemplate renders a template with template data and recipient data merged
func (p *Processor) renderTemplate(ctx context.Context, appID uuid.UUID, templateName string, templateData map[string]interface{}, recipient map[string]interface{}) (string, string, error) {
	// Fetch template
	tmpl, err := p.templateRepository.GetByName(ctx, appID, templateName)
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch template: %w", err)
	}

	// Merge template data with recipient data
	mergedData := make(map[string]interface{})
	for k, v := range templateData {
		mergedData[k] = v
	}
	for k, v := range recipient {
		mergedData[k] = v
	}

	// Render subject
	subjectStr := ""
	if tmpl.Subject != nil {
		subjectStr = *tmpl.Subject
	}
	subject, err := p.renderTemplateString(subjectStr, mergedData)
	if err != nil {
		return "", "", fmt.Errorf("failed to render subject: %w", err)
	}

	// Render body
	body, err := p.renderTemplateString(tmpl.Body, mergedData)
	if err != nil {
		return "", "", fmt.Errorf("failed to render body: %w", err)
	}

	return subject, body, nil
}

// renderTemplateString renders a simple template string with {{placeholder}} syntax
func (p *Processor) renderTemplateString(templateStr string, data map[string]interface{}) (string, error) {
	// Create a simple regex-based template renderer for {{key}} syntax
	re := regexp.MustCompile(`\{\{(\w+)\}\}`)
	result := re.ReplaceAllStringFunc(templateStr, func(match string) string {
		key := match[2 : len(match)-2]
		if val, ok := data[key]; ok {
			return fmt.Sprintf("%v", val)
		}
		return match
	})

	return result, nil
}

// failBatch marks batch as failed with error message
func (p *Processor) failBatch(ctx context.Context, appID uuid.UUID, batchID uuid.UUID, errMsg string) error {
	return p.store.UpdateBatchError(ctx, appID, batchID, errMsg)
}
