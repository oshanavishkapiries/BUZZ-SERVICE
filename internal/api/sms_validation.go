package api

import (
	"fmt"
	"regexp"

	"github.com/elight/buzz-service/internal/provider/sms"
)

var phoneRegexE164 = regexp.MustCompile(`^\+[1-9]\d{1,14}$`)

// ValidatePhoneNumber validates E.164 format phone number
func ValidatePhoneNumber(phone string) error {
	if len(phone) == 0 {
		return fmt.Errorf("phone number cannot be empty")
	}

	if !phoneRegexE164.MatchString(phone) {
		return fmt.Errorf("invalid phone number format (use E.164: +94771234567)")
	}

	return nil
}

// ValidateSMSBody validates SMS message body
func ValidateSMSBody(body string) error {
	if len(body) == 0 {
		return fmt.Errorf("SMS body cannot be empty")
	}

	info := sms.CalculateSMSInfo(body)

	if info.Segments > 3 {
		return fmt.Errorf(
			"SMS too long (%d segments, max 3). Consider shortening message to %d characters",
			info.Segments,
			info.CharsPerSMS*3,
		)
	}

	return nil
}
