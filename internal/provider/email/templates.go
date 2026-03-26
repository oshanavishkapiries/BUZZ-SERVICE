package email

import (
	"bytes"
	"html/template"
)

const defaultHTMLTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Subject}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .footer {
            background: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: #4CAF50;
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            margin: 16px 0;
        }
        .button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.InstitutionName}}</h1>
        </div>
        <div class="content">
            {{.HTMLContent}}
        </div>
        <div class="footer">
            <p>This is an automated message from {{.InstitutionName}}.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`

// HTMLTemplateData represents data for HTML email rendering
type HTMLTemplateData struct {
	Subject         string
	InstitutionName string
	HTMLContent     template.HTML
}

// RenderHTMLTemplate renders an HTML email template with the provided data
func RenderHTMLTemplate(subject, content, institutionName string) (string, error) {
	tmpl, err := template.New("email").Parse(defaultHTMLTemplate)
	if err != nil {
		return "", err
	}

	data := HTMLTemplateData{
		Subject:         subject,
		InstitutionName: institutionName,
		HTMLContent:     template.HTML(content),
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}
