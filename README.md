# AutoBio

AutoBio is a web application that helps users capture and preserve their life's precious moments through AI-powered storytelling. Users can create, organize, and share their memories with loved ones.

## Project Structure

This is a monorepo containing both the frontend and backend of the AutoBio application:

```
autobio/
├── client/           # Frontend React application
│   ├── src/         # Source code
│   └── public/      # Static assets
└── server/          # Backend Node.js application
    ├── src/         # Source code
    └── config/      # Configuration files
```

## Features

- User authentication and profiles
- Memory creation with rich text editor (TipTap)
- AI-powered image generation
- Timeline view of memories
- Memory exploration and discovery
- Tag-based organization
- Social features (likes, comments)

## Tech Stack

### Frontend
- React with TypeScript
- State Management: Zustand
- Styling: Tailwind CSS
- Rich Text Editor: TipTap
- Date Handling: date-fns
- UI Components: Headless UI
- Icons: Heroicons
- Development: Vite

### Backend
- Node.js with TypeScript
- Express.js
- MongoDB
- JWT Authentication
- File Storage

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autobio.git
cd autobio
```

2. Install dependencies:
```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

3. Set up environment variables:
```bash
# In the client directory
cp .env.example .env

# In the server directory
cp .env.example .env
```

4. Start the development servers:
```bash
# Start the client (in the client directory)
npm run dev

# Start the server (in the server directory)
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Development

### Available Scripts

#### Client
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

#### Server
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Environment Variables

#### Client
- `VITE_API_URL` - API endpoint URL
- `VITE_AUTH_ENABLED` - Enable/disable authentication
- `VITE_ENABLE_IMAGE_GENERATION` - Enable/disable AI image generation
- `VITE_ENABLE_SOCIAL_FEATURES` - Enable/disable social features
- `VITE_ANALYTICS_ID` - Analytics tracking ID (optional)
- `VITE_APP_NAME` - Application name
- `VITE_APP_DESCRIPTION` - Application description

#### Server
- `PORT` - Server port
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `NODE_ENV` - Environment (development/production)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 