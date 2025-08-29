# AutoBio Client

A React-based frontend for the AutoBio autobiography platform, built with modern web technologies and designed for creating, sharing, and exploring personal memories with AI-enhanced image generation.

## Features

### Core Functionality
- **Memory Creation**: Rich text editor with AI image generation
- **Memory Sharing**: Public and private memory sharing
- **Memory Exploration**: Discover and explore memories from other users
- **User Profiles**: Enhanced profiles with contextual information for AI

### Enhanced AI Image Generation
- **Contextual Prompts**: Uses user profile data and memory history for personalized images
- **Memory Summaries**: Pre-generated summaries stored with each memory for efficient context
- **User Context**: Incorporates location, occupation, interests, and cultural background
- **Style Preferences**: Personalized artistic style preferences
- **Fallback Support**: Graceful degradation to basic prompts when enhancement unavailable

### User Profile Enhancement
- **Extended Profile Fields**:
  - Location (city, country)
  - Occupation (job title/field)
  - Gender (for personalized prompts)
  - Interests (hobbies and preferences)
  - Cultural Background
  - Preferred Art Style
- **Profile Management**: Easy editing and updating of profile information
- **Privacy Controls**: Optional fields with user control over data sharing

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS for utility-first styling
- **State Management**: Zustand for global state management
- **Rich Text Editor**: TipTap for memory content creation
- **Date Handling**: date-fns for date formatting and manipulation
- **UI Components**: Headless UI for accessible components
- **Icons**: Heroicons for consistent iconography
- **Maps**: Leaflet for location-based features
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios for API communication
- **Server State**: TanStack React Query for efficient data fetching

## Project Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Authentication components
│   │   ├── editor/         # Rich text editor components
│   │   ├── memories/       # Memory-related components
│   │   └── ui/             # Generic UI components
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   ├── services/           # API service layer
│   ├── stores/             # Zustand state stores
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── package.json           # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- AutoBio server running (see server documentation)

### Installation
```bash
cd client
npm install
```

### Development
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production
```bash
npm run build
```

## Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_URL=http://localhost:3000/api
```

## Key Features Implementation

### Enhanced Image Generation
The client integrates with the server's enhanced image generation system:

1. **User Context Integration**: Automatically includes user profile data in image generation requests
2. **Memory History**: Uses pre-generated memory summaries for context
3. **Personalized Prompts**: Incorporates user preferences and style choices
4. **Fallback Handling**: Gracefully handles cases where enhancement is unavailable

### Profile Management
Enhanced profile management with comprehensive user data:

1. **Extended Fields**: Support for location, occupation, interests, and cultural background
2. **Real-time Updates**: Immediate profile updates with optimistic UI
3. **Privacy Controls**: Optional fields with user consent
4. **Data Validation**: Client-side validation for all profile fields

### Memory Creation
Rich memory creation with AI enhancement:

1. **Rich Text Editor**: TipTap-based editor with image support
2. **AI Image Generation**: Contextual image generation with user data
3. **Image Management**: Drag-and-drop positioning and confirmation
4. **Enhanced Prompts**: Automatic inclusion of user context and memory history

## API Integration

The client communicates with the server through a comprehensive API layer:

### Authentication
- JWT-based authentication
- Automatic token management
- Secure profile updates

### Memory Management
- CRUD operations for memories
- Image generation and regeneration
- Public/private memory controls

### User Profiles
- Enhanced profile data management
- Real-time profile updates
- Privacy-aware data handling

## Development Guidelines

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting

### Component Architecture
- Functional components with hooks
- Composition over inheritance
- Reusable component patterns

### State Management
- Zustand for global state
- React Query for server state
- Local state for component-specific data

### Testing
- Unit tests for utilities and hooks
- Integration tests for API calls
- Component testing with React Testing Library

## Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

## Contributing

1. Follow the existing code style and patterns
2. Add TypeScript types for all new features
3. Update documentation for API changes
4. Test thoroughly before submitting

## License

MIT License - see LICENSE file for details
