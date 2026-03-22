# Buzz Documentation Site

This directory contains the static documentation website for Buzz Notification Service.

## Structure

```
docs/site/
├── index.html              # Homepage
├── pages/
│   ├── architecture.html   # Architecture documentation
│   ├── api.html           # API reference
│   ├── guides.html        # How-to guides
│   └── deployment.html    # Deployment guide
├── assets/
│   ├── css/
│   │   └── style.css      # Styles
│   ├── js/
│   │   └── script.js      # Interactive features
│   └── images/            # Images and diagrams
└── dist/                  # Build output (generated)
```

## Local Development

### Serve Locally

```bash
# From project root
./build-docs.sh serve

# Or use Python directly
cd docs/site
python3 -m http.server 8000
```

Visit: http://localhost:8000

### Build for Production

```bash
./build-docs.sh build
```

Output will be in `docs/site/dist/`

## Deployment

### GitHub Pages

```bash
# Deploy to GitHub Pages
./build-docs.sh deploy
```

The documentation will be available at:
`https://elight.github.io/buzz-service/`

### Custom Server

Copy the contents of `docs/site/` (or `docs/site/dist/`) to your web server:

```bash
# Build first
./build-docs.sh build

# Upload to server
rsync -avz docs/site/dist/ user@server:/var/www/buzz-docs/
```

### Netlify/Vercel

1. Connect your GitHub repository
2. Set build command: `./build-docs.sh build`
3. Set publish directory: `docs/site/dist`

## Updating Documentation

### Adding a New Page

1. Create new HTML file in `docs/site/pages/`
2. Use existing pages as templates
3. Add navigation link in all pages
4. Update sidebar if needed

### Styling

- Main styles: `assets/css/style.css`
- Uses CSS variables for theming
- Responsive design with mobile-first approach

### Interactive Features

- Mobile navigation toggle
- Code block copy buttons
- Smooth scrolling
- Active navigation highlighting

## Dependencies

**External CDNs:**

- Font Awesome 6.4.0 (icons)

**No build tools required** - Pure HTML, CSS, and vanilla JavaScript

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

When updating documentation:

1. Test locally with `./build-docs.sh serve`
2. Check responsive design (mobile, tablet, desktop)
3. Verify all links work
4. Ensure code examples are accurate
5. Build and deploy: `./build-docs.sh deploy`

## License

MIT License - Same as the main project
