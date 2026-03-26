package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Logger   LoggerConfig
	Queue    QueueConfig
	Email    EmailConfig
	AWS      AWSConfig
	SMTP     SMTPConfig
	SMS      SMSConfig
	NotifyLK NotifyLKConfigStruct
	Twilio   TwilioConfigStruct
}

type ServerConfig struct {
	Port         int
	Host         string
	Env          string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	Host           string
	Port           int
	Name           string
	User           string
	Password       string
	SSLMode        string
	MaxConnections int
	MaxIdleConns   int
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type LoggerConfig struct {
	Level  string
	Format string
}

type QueueConfig struct {
	Concurrency int
	Queues      map[string]int // queue name -> priority weight
}

type EmailConfig struct {
	Provider       string
	FromEmail      string
	FromName       string
	RateLimitRPS   int
}

type AWSConfig struct {
	Region          string
	AccessKeyID     string
	SecretAccessKey string
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	UseTLS   bool
}

type SMSConfig struct {
	Provider           string
	RateLimitPerSecond int
	MaxSegments        int
	DefaultSenderID    string
}

type NotifyLKConfigStruct struct {
	UserID   string
	APIKey   string
	SenderID string
}

type TwilioConfigStruct struct {
	AccountSID          string
	AuthToken           string
	FromNumber          string
	MessagingServiceSID string
}

func Load() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Optional: Load from file if exists
	_ = viper.ReadInConfig()

	// Set defaults
	viper.SetDefault("SERVER_PORT", 8080)
	viper.SetDefault("SERVER_HOST", "0.0.0.0")
	viper.SetDefault("ENV", "development")
	viper.SetDefault("SERVER_READ_TIMEOUT", "10s")
	viper.SetDefault("SERVER_WRITE_TIMEOUT", "10s")

	viper.SetDefault("DB_HOST", "localhost")
	viper.SetDefault("DB_PORT", 5432)
	viper.SetDefault("DB_NAME", "buzz_service")
	viper.SetDefault("DB_USER", "buzz_user")
	viper.SetDefault("DB_PASSWORD", "secure_password")
	viper.SetDefault("DB_SSL_MODE", "disable")
	viper.SetDefault("DB_MAX_CONNECTIONS", 20)
	viper.SetDefault("DB_MAX_IDLE_CONNECTIONS", 5)

	viper.SetDefault("REDIS_HOST", "localhost")
	viper.SetDefault("REDIS_PORT", 6379)
	viper.SetDefault("REDIS_PASSWORD", "")
	viper.SetDefault("REDIS_DB", 0)

	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("LOG_FORMAT", "json")

	viper.SetDefault("QUEUE_CONCURRENCY", 10)
	viper.SetDefault("QUEUE_EMAIL_WEIGHT", 3)
	viper.SetDefault("QUEUE_SMS_WEIGHT", 3)
	viper.SetDefault("QUEUE_PUSH_WEIGHT", 2)
	viper.SetDefault("QUEUE_INAPP_WEIGHT", 2)
	viper.SetDefault("QUEUE_BATCH_WEIGHT", 1)

	viper.SetDefault("EMAIL_PROVIDER", "smtp")
	viper.SetDefault("EMAIL_FROM", "noreply@buzz.local")
	viper.SetDefault("EMAIL_FROM_NAME", "Buzz Service")
	viper.SetDefault("EMAIL_RATE_LIMIT_RPS", 10)

	viper.SetDefault("AWS_REGION", "us-east-1")
	viper.SetDefault("AWS_ACCESS_KEY_ID", "")
	viper.SetDefault("AWS_SECRET_ACCESS_KEY", "")

	viper.SetDefault("SMTP_HOST", "localhost")
	viper.SetDefault("SMTP_PORT", 587)
	viper.SetDefault("SMTP_USERNAME", "")
	viper.SetDefault("SMTP_PASSWORD", "")
	viper.SetDefault("SMTP_USE_TLS", true)

	viper.SetDefault("SMS_PROVIDER", "router")
	viper.SetDefault("SMS_RATE_LIMIT_PER_SECOND", 10)
	viper.SetDefault("SMS_MAX_SEGMENTS", 3)
	viper.SetDefault("SMS_DEFAULT_SENDER_ID", "Buzz")

	viper.SetDefault("NOTIFYLK_USER_ID", "")
	viper.SetDefault("NOTIFYLK_API_KEY", "")
	viper.SetDefault("NOTIFYLK_SENDER_ID", "Buzz")

	viper.SetDefault("TWILIO_ACCOUNT_SID", "")
	viper.SetDefault("TWILIO_AUTH_TOKEN", "")
	viper.SetDefault("TWILIO_FROM_NUMBER", "")
	viper.SetDefault("TWILIO_MESSAGING_SERVICE_SID", "")

	readTimeout, err := time.ParseDuration(viper.GetString("SERVER_READ_TIMEOUT"))
	if err != nil {
		readTimeout = 10 * time.Second
	}

	writeTimeout, err := time.ParseDuration(viper.GetString("SERVER_WRITE_TIMEOUT"))
	if err != nil {
		writeTimeout = 10 * time.Second
	}

	cfg := &Config{
		Server: ServerConfig{
			Port:         viper.GetInt("SERVER_PORT"),
			Host:         viper.GetString("SERVER_HOST"),
			Env:          viper.GetString("ENV"),
			ReadTimeout:  readTimeout,
			WriteTimeout: writeTimeout,
		},
		Database: DatabaseConfig{
			Host:           viper.GetString("DB_HOST"),
			Port:           viper.GetInt("DB_PORT"),
			Name:           viper.GetString("DB_NAME"),
			User:           viper.GetString("DB_USER"),
			Password:       viper.GetString("DB_PASSWORD"),
			SSLMode:        viper.GetString("DB_SSL_MODE"),
			MaxConnections: viper.GetInt("DB_MAX_CONNECTIONS"),
			MaxIdleConns:   viper.GetInt("DB_MAX_IDLE_CONNECTIONS"),
		},
		Redis: RedisConfig{
			Host:     viper.GetString("REDIS_HOST"),
			Port:     viper.GetInt("REDIS_PORT"),
			Password: viper.GetString("REDIS_PASSWORD"),
			DB:       viper.GetInt("REDIS_DB"),
		},
		Logger: LoggerConfig{
			Level:  viper.GetString("LOG_LEVEL"),
			Format: viper.GetString("LOG_FORMAT"),
		},
		Queue: QueueConfig{
			Concurrency: viper.GetInt("QUEUE_CONCURRENCY"),
			Queues: map[string]int{
				"email":  viper.GetInt("QUEUE_EMAIL_WEIGHT"),
				"sms":    viper.GetInt("QUEUE_SMS_WEIGHT"),
				"push":   viper.GetInt("QUEUE_PUSH_WEIGHT"),
				"in_app": viper.GetInt("QUEUE_INAPP_WEIGHT"),
				"batch":  viper.GetInt("QUEUE_BATCH_WEIGHT"),
			},
		},
		Email: EmailConfig{
			Provider:     viper.GetString("EMAIL_PROVIDER"),
			FromEmail:    viper.GetString("EMAIL_FROM"),
			FromName:     viper.GetString("EMAIL_FROM_NAME"),
			RateLimitRPS: viper.GetInt("EMAIL_RATE_LIMIT_RPS"),
		},
		AWS: AWSConfig{
			Region:          viper.GetString("AWS_REGION"),
			AccessKeyID:     viper.GetString("AWS_ACCESS_KEY_ID"),
			SecretAccessKey: viper.GetString("AWS_SECRET_ACCESS_KEY"),
		},
		SMTP: SMTPConfig{
			Host:     viper.GetString("SMTP_HOST"),
			Port:     viper.GetInt("SMTP_PORT"),
			Username: viper.GetString("SMTP_USERNAME"),
			Password: viper.GetString("SMTP_PASSWORD"),
			UseTLS:   viper.GetBool("SMTP_USE_TLS"),
		},
		SMS: SMSConfig{
			Provider:           viper.GetString("SMS_PROVIDER"),
			RateLimitPerSecond: viper.GetInt("SMS_RATE_LIMIT_PER_SECOND"),
			MaxSegments:        viper.GetInt("SMS_MAX_SEGMENTS"),
			DefaultSenderID:    viper.GetString("SMS_DEFAULT_SENDER_ID"),
		},
		NotifyLK: NotifyLKConfigStruct{
			UserID:   viper.GetString("NOTIFYLK_USER_ID"),
			APIKey:   viper.GetString("NOTIFYLK_API_KEY"),
			SenderID: viper.GetString("NOTIFYLK_SENDER_ID"),
		},
		Twilio: TwilioConfigStruct{
			AccountSID:          viper.GetString("TWILIO_ACCOUNT_SID"),
			AuthToken:           viper.GetString("TWILIO_AUTH_TOKEN"),
			FromNumber:          viper.GetString("TWILIO_FROM_NUMBER"),
			MessagingServiceSID: viper.GetString("TWILIO_MESSAGING_SERVICE_SID"),
		},
	}

	// Validate config
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}

	if c.Database.Name == "" {
		return fmt.Errorf("database name is required")
	}

	return nil
}
