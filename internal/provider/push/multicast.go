package push

import (
	"context"
	"fmt"

	"firebase.google.com/go/v4/messaging"
)

// MulticastResult contains the result of a multicast send operation
type MulticastResult struct {
	SuccessCount int
	FailureCount int
	Results      []SendResult
}

// SendResult contains the result for a single device in a multicast operation
type SendResult struct {
	Token     string
	Success   bool
	MessageID string
	Error     string
}

// SendMulticast sends the same notification to multiple devices
func (p *FCMProvider) SendMulticast(ctx context.Context, tokens []string, msg *PushMessage) (*MulticastResult, error) {
	if len(tokens) == 0 {
		return nil, fmt.Errorf("no device tokens provided")
	}

	const maxTokensPerRequest = 500

	result := &MulticastResult{
		SuccessCount: 0,
		FailureCount: 0,
		Results:      make([]SendResult, 0),
	}

	// Process in batches of up to 500 tokens
	for i := 0; i < len(tokens); i += maxTokensPerRequest {
		end := i + maxTokensPerRequest
		if end > len(tokens) {
			end = len(tokens)
		}

		batch := tokens[i:end]
		batchResult, err := p.sendMulticastBatch(ctx, batch, msg)
		if err != nil {
			return nil, err
		}

		result.SuccessCount += batchResult.SuccessCount
		result.FailureCount += batchResult.FailureCount
		result.Results = append(result.Results, batchResult.Results...)
	}

	return result, nil
}

// sendMulticastBatch sends to a single batch of tokens (≤500)
func (p *FCMProvider) sendMulticastBatch(ctx context.Context, tokens []string, msg *PushMessage) (*MulticastResult, error) {
	fcmMsg := &messaging.MulticastMessage{
		Tokens: tokens,
		Notification: &messaging.Notification{
			Title: msg.Title,
			Body:  msg.Body,
		},
		Data: msg.Data,
	}

	// Add platform-specific configs
	if msg.Android != nil {
		fcmMsg.Android = &messaging.AndroidConfig{
			Priority: msg.Android.Priority,
			Notification: &messaging.AndroidNotification{
				Title:       msg.Title,
				Body:        msg.Body,
				Icon:        msg.Android.Icon,
				Color:       msg.Android.Color,
				Sound:       msg.Android.Sound,
				ChannelID:   msg.Android.ChannelID,
				ClickAction: msg.Android.ClickAction,
			},
		}
	}

	if msg.APNS != nil {
		fcmMsg.APNS = &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": msg.APNS.Priority,
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Alert: &messaging.ApsAlert{
						Title: msg.Title,
						Body:  msg.Body,
					},
					Badge:    msg.APNS.Badge,
					Sound:    msg.APNS.Sound,
					Category: msg.APNS.Category,
				},
			},
		}
	}

	response, err := p.client.SendMulticast(ctx, fcmMsg)
	if err != nil {
		return nil, fmt.Errorf("FCM multicast send failed: %w", err)
	}

	result := &MulticastResult{
		SuccessCount: response.SuccessCount,
		FailureCount: response.FailureCount,
		Results:      make([]SendResult, len(response.Responses)),
	}

	for i, resp := range response.Responses {
		result.Results[i] = SendResult{
			Token:     tokens[i],
			Success:   resp.Success,
			MessageID: resp.MessageID,
		}
		if !resp.Success {
			result.Results[i].Error = resp.Error.Error()
		}
	}

	return result, nil
}
