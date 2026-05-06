package api

import (
	"embed"
	"mime"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

//go:embed panelui
var panelUI embed.FS

func registerPanelRoutes(app *fiber.App) {
	// Catch /panel and everything under it
	app.Get("/panel*", servePanelFile)
}

func servePanelFile(c *fiber.Ctx) error {
	// Get the requested path and strip /panel prefix
	reqPath := c.Path()
	var path string

	if reqPath == "/panel" {
		// Redirect /panel → /panel/
		return c.Redirect("/panel/", fiber.StatusMovedPermanently)
	}

	// Strip /panel/ prefix
	path = strings.TrimPrefix(reqPath, "/panel/")
	if path == "" || path == "/" {
		path = "index.html"
	}

	// Try to read the requested file
	data, err := panelUI.ReadFile("panelui/" + path)
	if err != nil {
		// SPA fallback: any unknown path → index.html (allows client-side routing)
		data, err = panelUI.ReadFile("panelui/index.html")
		if err != nil {
			return c.Status(fiber.StatusNotFound).SendString("not found")
		}
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(data)
	}

	// Set correct Content-Type based on file extension
	ext := filepath.Ext(path)
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}
	c.Set("Content-Type", ct)
	return c.Send(data)
}
