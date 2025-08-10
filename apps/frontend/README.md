# Frontend

A clean, modern React frontend built with TypeScript, Vite, and Tailwind CSS.

## Structure

```
src/
├── components/
│   └── ui/           # Reusable UI components
├── config/           # Environment configuration
├── lib/             # Utility libraries (API, etc.)
├── pages/           # Page components (Landing, Login, SignUp)
├── styles/          # Global styles
├── App.tsx          # Main application component
└── main.tsx         # Application entry point
```

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

## Development

```bash
# Start development server
pnpm dev --filter=frontend

# Build for production
pnpm build --filter=frontend

# Type checking
pnpm typecheck --filter=frontend

# Linting
pnpm lint --filter=frontend
```

## Components

### UI Components

- `FormField` - Reusable form input with label and error handling
- `Input` - Base input component
- `Label` - Form label component
- `ModernButton` - Styled button with animations and variants
- `PageTransition` - Page transition animations
- `Toaster` - Toast notification system

### Pages

- `LandingPage` - Marketing/welcome page
- `LoginPage` - User authentication
- `SignUpPage` - User registration
