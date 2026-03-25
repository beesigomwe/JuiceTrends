# Social Media Orchestrator

## Overview

A comprehensive social media marketing automation platform that enables marketing teams to generate, schedule, publish, and analyze social media content across multiple platforms from a unified dashboard. The application follows a Linear-inspired productivity interface design with clean, information-dense layouts optimized for daily professional use.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON APIs under `/api/*` prefix
- **Build Tool**: esbuild for production server bundling, Vite for client development

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Validation**: Zod schemas auto-generated from Drizzle schemas via drizzle-zod
- **Current Storage**: In-memory storage implementation (`MemStorage` class) with seeded demo data
- **Database Ready**: PostgreSQL schema defined, migrations configured via drizzle-kit

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── components/ui/   # shadcn/ui component library
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Data access layer
│   └── vite.ts          # Development server setup
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migration files
```

### Key Design Patterns
- **Shared Schema**: Database types and validation schemas shared between frontend and backend
- **Path Aliases**: `@/` for client source, `@shared/` for shared modules
- **API Pattern**: All API routes return JSON, frontend uses React Query for data fetching
- **Component Pattern**: Compound components with variants using class-variance-authority

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database schema migrations (`npm run db:push`)

### UI Framework Dependencies
- **Radix UI**: Full suite of accessible, unstyled UI primitives
- **Lucide React**: Icon library
- **React Icons**: Additional platform-specific icons (social media logos)
- **Embla Carousel**: Carousel component foundation
- **Vaul**: Drawer component
- **cmdk**: Command palette component

### Data & Forms
- **TanStack React Query**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation
- **date-fns**: Date manipulation utilities

### Development Tools
- **Vite**: Frontend development server with HMR
- **TypeScript**: Type checking across entire codebase
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS/Autoprefixer**: CSS processing

### Session & Authentication (Configured but not fully implemented)
- **express-session**: Session middleware
- **connect-pg-simple**: PostgreSQL session store
- **passport/passport-local**: Authentication framework (available for implementation)