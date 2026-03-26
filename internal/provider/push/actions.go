package push

import "fmt"

// NotificationAction represents an action button in a notification
type NotificationAction struct {
	ID    string
	Title string
	Icon  string
}

// AddActionsToWebPush adds action buttons to a web push notification
func AddActionsToWebPush(msg *PushMessage, actions []NotificationAction) {
	if msg.WebPush == nil {
		msg.WebPush = &WebPushConfig{}
	}

	if msg.Data == nil {
		msg.Data = make(map[string]string)
	}

	// Serialize actions in data payload
	for i, action := range actions {
		prefix := fmt.Sprintf("action_%d", i)
		msg.Data[prefix+"_id"] = action.ID
		msg.Data[prefix+"_title"] = action.Title
		if action.Icon != "" {
			msg.Data[prefix+"_icon"] = action.Icon
		}
	}
}

// AddActionsToAndroid adds action buttons to an Android notification
func AddActionsToAndroid(msg *PushMessage, actions []NotificationAction) {
	if msg.Android == nil {
		msg.Android = &AndroidConfig{}
	}

	if msg.Data == nil {
		msg.Data = make(map[string]string)
	}

	// Android handles actions client-side via data payload
	for i, action := range actions {
		prefix := fmt.Sprintf("action_%d", i)
		msg.Data[prefix+"_id"] = action.ID
		msg.Data[prefix+"_title"] = action.Title
	}
}

// AddActionsToAPNS adds action category to an iOS notification
func AddActionsToAPNS(msg *PushMessage, category string) {
	if msg.APNS == nil {
		msg.APNS = &APNSConfig{}
	}
	msg.APNS.Category = category
}
