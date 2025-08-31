# Inventory Management System

## Overview

This is a comprehensive inventory management system built for retail businesses with multiple locations. The application manages product inventory across warehouses and stores, tracks stock movements, handles sales transactions, manages shipping instructions, and processes returns. The system uses Japanese terminology for inventory states and operation types, indicating it's designed for Japanese retail operations.

The application follows a full-stack architecture with a React frontend and Express.js backend, utilizing PostgreSQL for data persistence through Drizzle ORM. It features real-time inventory tracking, automated low-stock alerts, and comprehensive audit trails for all inventory movements.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **Form Handling**: React Hook Form with Zod schema validation
- **Component Structure**: Page-based routing with shared layout and reusable UI components

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured error handling and request logging
- **Database Integration**: Drizzle ORM with type-safe queries and migrations
- **Development Setup**: Vite middleware integration for seamless development experience

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM providing type-safe database operations
- **Schema Management**: Code-first approach with shared schema definitions
- **Connection Pooling**: Neon serverless connection pooling for scalability

### Core Data Models
- **Users**: Role-based access (warehouse, store, admin) with store assignments
- **Locations**: Warehouses and stores with hierarchical organization
- **Products**: SKU-based product management with pricing and categorization
- **Inventory Balances**: Multi-state inventory tracking (通常, 確保, 検品中, 不良)
- **Inventory History**: Complete audit trail of all stock movements
- **Shipping Instructions**: Inter-location transfer management
- **Replenishment Criteria**: Automated reorder point management

### Business Logic Architecture
- **Inventory States**: Japanese terminology system for precise inventory classification
- **Operation Types**: Comprehensive tracking of 10 different inventory operations
- **Real-time Monitoring**: Automatic low-stock alerts and dashboard metrics
- **Multi-location Support**: Separate inventory tracking per location and state
- **Audit Trail**: Complete history of all inventory movements with user attribution

### Authentication and Authorization
- **Session-based Authentication**: Express sessions with PostgreSQL session storage
- **Role-based Access Control**: Three-tier permission system (warehouse, store, admin)
- **Store Assignment**: Users can be assigned to specific store locations
- **API Protection**: Middleware-based route protection with user context

### Development and Deployment Architecture
- **Build Process**: Vite for frontend bundling, esbuild for backend compilation
- **Development Server**: Hot module replacement with error overlay
- **Environment Configuration**: Environment-based database URL configuration
- **Migration System**: Drizzle Kit for database schema migrations
- **Replit Integration**: Specialized plugins for Replit development environment

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Database Configuration**: Environment-based connection string management

### UI and Styling Dependencies
- **Radix UI**: Comprehensive component primitives for accessibility
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography
- **shadcn/ui**: Pre-built component library following design system patterns

### Development Tools
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Fast development server and build tool
- **Drizzle Kit**: Database migration and introspection tools
- **React Query DevTools**: Development debugging for data fetching

### Form and Validation
- **React Hook Form**: Performant form management
- **Zod**: Runtime type validation and schema definition
- **Hookform Resolvers**: Integration between React Hook Form and Zod

### Date and Utility Libraries
- **date-fns**: Date manipulation and formatting with Japanese locale support
- **clsx**: Conditional CSS class composition
- **class-variance-authority**: Type-safe variant API for component styling

### Replit-specific Integrations
- **Replit Vite Plugins**: Development error overlay and cartographer integration
- **Replit Development Banner**: Environment-aware development notifications