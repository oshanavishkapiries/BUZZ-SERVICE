package sms

import (
	"unicode/utf8"
)

// SMS character limits for different encoding schemes
const (
	// GSM 7-bit encoding (standard ASCII)
	GSM7BitSingleSMS = 160
	GSM7BitMultiSMS  = 153 // characters per segment in concatenated SMS

	// UCS-2 (Unicode) encoding (for Sinhala, Tamil, etc.)
	UnicodeSingleSMS = 70
	UnicodeMultiSMS  = 67 // characters per segment in concatenated SMS
)

// SMSInfo contains information about SMS encoding and segmentation
type SMSInfo struct {
	Length       int    // Character count
	Segments     int    // Number of SMS segments required
	Encoding     string // "GSM 7-bit" or "UCS-2"
	CharsPerSMS  int    // Characters per single SMS segment
	IsUnicode    bool   // Whether unicode encoding is used
	TotalChars   int    // Total characters including segment headers
}

// CalculateSMSInfo analyzes text and returns SMS information
// including required segments, encoding type, and character limits
func CalculateSMSInfo(text string) SMSInfo {
	length := utf8.RuneCountInString(text)
	isUnicode := isUnicodeRequired(text)

	var segments int
	var charsPerSMS int
	var encoding string
	var totalChars int

	if isUnicode {
		encoding = "UCS-2"
		if length <= UnicodeSingleSMS {
			segments = 1
			charsPerSMS = UnicodeSingleSMS
		} else {
			segments = (length + UnicodeMultiSMS - 1) / UnicodeMultiSMS
			charsPerSMS = UnicodeMultiSMS
		}
	} else {
		encoding = "GSM 7-bit"
		if length <= GSM7BitSingleSMS {
			segments = 1
			charsPerSMS = GSM7BitSingleSMS
		} else {
			segments = (length + GSM7BitMultiSMS - 1) / GSM7BitMultiSMS
			charsPerSMS = GSM7BitMultiSMS
		}
	}

	// Calculate total characters including segment headers (7 bytes per segment)
	if segments > 1 {
		totalChars = length + (7 * segments)
	} else {
		totalChars = length
	}

	return SMSInfo{
		Length:      length,
		Segments:    segments,
		Encoding:    encoding,
		CharsPerSMS: charsPerSMS,
		IsUnicode:   isUnicode,
		TotalChars:  totalChars,
	}
}

// IsUnicodeRequired checks if text contains non-ASCII characters
// Returns true if text contains Sinhala, Tamil, or other Unicode characters
func IsUnicodeRequired(text string) bool {
	return isUnicodeRequired(text)
}

// MaxSegments returns the maximum number of segments allowed
const MaxSegments = 3

// IsWithinLimit checks if the message is within SMS limits
func IsWithinLimit(text string) bool {
	info := CalculateSMSInfo(text)
	return info.Segments <= MaxSegments
}

// TruncateToLimit truncates text to fit within SMS segment limits
func TruncateToLimit(text string, maxSegments int) string {
	if maxSegments < 1 {
		maxSegments = 1
	}

	info := CalculateSMSInfo(text)
	if info.Segments <= maxSegments {
		return text
	}

	// Calculate max characters allowed
	var maxChars int
	if info.IsUnicode {
		maxChars = (maxSegments * UnicodeMultiSMS)
	} else {
		maxChars = (maxSegments * GSM7BitMultiSMS)
	}

	// Truncate to character limit
	runes := []rune(text)
	if len(runes) > maxChars {
		return string(runes[:maxChars]) + "..."
	}

	return text
}
