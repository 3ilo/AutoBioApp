# AutoBio

AutoBio is a web application that helps users capture and preserve their life's precious moments through AI-powered storytelling. Users can create, organize, and share their memories with loved ones.

## Features

- User authentication and profiles
- Memory creation with rich text editor (TipTap)
- AI-powered image generation
- Timeline view of memories
- Memory exploration and discovery
- Tag-based organization
- Social features (likes, comments)

## Tech Stack

- Frontend: React with TypeScript
- State Management: Zustand
- Styling: Tailwind CSS
- Rich Text Editor: TipTap
- Date Handling: date-fns
- UI Components: Headless UI
- Icons: Heroicons
- Development: Vite

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autobio.git
cd autobio/client
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Project Structure

```
client/
├── src/
│   ├── components/    # Reusable UI components
│   │   ├── auth/     # Authentication components
│   │   ├── editor/   # Rich text editor components
│   │   ├── memories/ # Memory-related components
│   │   └── ui/       # Generic UI components
│   ├── pages/        # Page components
│   ├── stores/       # Zustand state management
│   ├── services/     # API services
│   ├── hooks/        # Custom React hooks
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utility functions
└── public/           # Static assets
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Variables

The following environment variables are available:

- `VITE_API_URL` - API endpoint URL
- `VITE_AUTH_ENABLED` - Enable/disable authentication
- `VITE_ENABLE_IMAGE_GENERATION` - Enable/disable AI image generation
- `VITE_ENABLE_SOCIAL_FEATURES` - Enable/disable social features
- `VITE_ANALYTICS_ID` - Analytics tracking ID (optional)
- `VITE_APP_NAME` - Application name
- `VITE_APP_DESCRIPTION` - Application description

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
