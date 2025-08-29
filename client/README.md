# AutoBio Client

Frontend React application for the AutoBio platform, providing an intuitive interface for users to capture, organize, and share their life memories with AI-powered features.

## Features

- **User Authentication**: Secure login and registration with JWT tokens
- **Memory Creation**: Rich text editor with TipTap for creating detailed memories
- **AI Image Generation**: Integration with AWS Bedrock for AI-generated images
- **Memory Timeline**: Chronological view of user memories with filtering
- **Memory Exploration**: Discover and explore memories from the community
- **User Profiles**: Personalized user profiles with customizable settings
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Real-time Updates**: React Query for efficient data fetching and caching
- **Form Validation**: Zod schema validation with React Hook Form
- **Drag & Drop**: Beautiful drag and drop interface for memory organization

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for global state
- **Data Fetching**: TanStack React Query (formerly React Query)
- **Routing**: React Router DOM v7
- **Forms**: React Hook Form with Zod validation
- **Rich Text Editor**: TipTap with extensions
- **UI Components**: Headless UI for accessible components
- **Icons**: Heroicons
- **Maps**: Leaflet with React Leaflet
- **Date Handling**: date-fns
- **HTTP Client**: Axios
- **Development**: ESLint, TypeScript, PostCSS

## Project Structure

```
client/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── auth/      # Authentication components
│   │   ├── editor/    # Rich text editor components
│   │   ├── memories/  # Memory-related components
│   │   └── ui/        # Base UI components
│   ├── pages/         # Page components
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API services and utilities
│   ├── stores/        # Zustand state stores
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   ├── assets/        # Static assets
│   ├── App.tsx        # Main application component
│   └── main.tsx       # Application entry point
├── public/            # Public static assets
├── index.html         # HTML template
└── package.json       # Dependencies and scripts
```

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- AutoBio server running locally

### Installation

1. Install dependencies:
```bash
cd client
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Feature Flags
VITE_AUTH_ENABLED=true
VITE_ENABLE_IMAGE_GENERATION=true
VITE_ENABLE_SOCIAL_FEATURES=true

# App Configuration
VITE_APP_NAME=AutoBio
VITE_APP_DESCRIPTION=Capture and preserve your life's precious moments

# Optional: Analytics
VITE_ANALYTICS_ID=your-analytics-id
```

4. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Application Architecture

### Component Structure

#### Pages
- **Home**: Landing page with app overview
- **Login/Register**: Authentication pages
- **Contribute**: Memory creation with rich text editor
- **Memories**: Timeline view of user memories
- **Explore**: Community memory discovery
- **Profile**: User profile management

#### Components
- **Layout**: Main application layout with navigation
- **ProtectedRoute**: Authentication guard for protected pages
- **MemoryCard**: Individual memory display component
- **Timeline**: Chronological memory view
- **Toolbar**: Rich text editor toolbar
- **LoadingSpinner**: Loading state component

### State Management

#### Zustand Stores
- **authStore**: User authentication state and methods
  - User information
  - Authentication status
  - Login/logout methods
  - Token management

#### React Query
- **API Data**: Server state management
- **Caching**: Automatic data caching and invalidation
- **Background Updates**: Real-time data synchronization
- **Optimistic Updates**: Immediate UI feedback

### Data Flow

```
User Action → Component → Hook → Service → API → Server
     ↑                                                      ↓
     ← State Update ← Store ← Query ← Response ← Server ←
```

## Key Features Implementation

### Authentication
- JWT token-based authentication
- Protected routes with automatic redirection
- Persistent login state
- Secure token storage

### Rich Text Editor (TipTap)
- Extensible editor with plugins
- Image upload and embedding
- Markdown support
- Collaborative editing ready

### Memory Management
- CRUD operations for memories
- Real-time updates
- Optimistic UI updates
- Error handling and retry logic

### AI Integration
- AWS Bedrock integration for image generation
- Prompt-based image creation
- Image storage and retrieval
- User-friendly AI interface

## Styling and Design

### Tailwind CSS
- Utility-first CSS framework
- Custom design system
- Responsive design patterns
- Dark mode support ready

### Component Design
- Consistent design language
- Accessible components (Headless UI)
- Mobile-first responsive design
- Smooth animations and transitions

## Development Guidelines

### Code Style
- TypeScript strict mode
- ESLint configuration
- Consistent naming conventions
- Component composition patterns

### Component Patterns
```typescript
// Functional components with TypeScript
interface ComponentProps {
  title: string;
  onAction: () => void;
}

export const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  return (
    <div className="component">
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
```

### Custom Hooks
```typescript
// Custom hook pattern
export const useCustomHook = () => {
  const [state, setState] = useState();
  
  const action = useCallback(() => {
    // Implementation
  }, []);
  
  return { state, action };
};
```

## Testing Strategy

### Unit Testing
- Component testing with React Testing Library
- Hook testing with custom test utilities
- Utility function testing

### Integration Testing
- API integration testing
- User flow testing
- Authentication flow testing

### E2E Testing
- Critical user journeys
- Cross-browser testing
- Performance testing

## Performance Optimization

### Code Splitting
- Route-based code splitting
- Component lazy loading
- Dynamic imports for heavy components

### Bundle Optimization
- Vite build optimization
- Tree shaking
- Asset optimization

### Caching Strategy
- React Query caching
- Browser caching
- Service worker ready

## Environment Configuration

### Development
- Hot module replacement
- Source maps
- Development-specific features

### Production
- Optimized builds
- Environment-specific configurations
- Performance monitoring

### Feature Flags
- Environment-based feature toggles
- A/B testing ready
- Gradual feature rollout

## Deployment

### Build Process
```bash
# Production build
npm run build

# Preview build
npm run preview
```

### Static Hosting
- Vercel deployment ready
- Netlify configuration
- CDN optimization

### Environment Variables
- Build-time environment configuration
- Runtime configuration support
- Secure secret management

## Contributing

### Development Workflow
1. Create feature branch
2. Implement changes with tests
3. Run linting and type checking
4. Submit pull request

### Code Quality
- ESLint for code quality
- TypeScript for type safety
- Prettier for code formatting
- Husky for pre-commit hooks

### Documentation
- Component documentation
- API integration docs
- User flow documentation
- Performance guidelines

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Development Server Issues
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

#### TypeScript Errors
```bash
# Run type checking
npm run type-check

# Fix auto-fixable issues
npm run lint -- --fix
```

### Performance Issues
- Check bundle size with `npm run build`
- Analyze dependencies with `npm ls`
- Monitor React Query cache usage
- Profile component re-renders

## License

This project is licensed under the MIT License.
