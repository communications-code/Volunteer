# VFW Post 7570 - Serving Network Platform

## Overview

VFW Post 7570 Serving Network is a community-focused web application that connects community needs with willing volunteers and supporters. The platform allows administrators to post needs, events, service opportunities, and item requests, and enables community members to view, pledge support, and fulfill those needs. The application features email notifications, Supabase-backed CRM records, and a comprehensive admin dashboard for managing community requests.

## System Architecture

### Full-Stack Application Structure
- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based auth
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Email Service**: MailerSend for transactional emails
- **Newsletter Integration**: MailerLite API for subscriber management

### Database Architecture
The application uses PostgreSQL with the following main entities:
- **Users**: Admin authentication with username/password
- **Needs**: Community requests with categories (FOOD, CLOTHING, SERVICE, EDUCATION, HOUSING, EVENT, OTHER)
- **Pledges**: Commitments from community members to fulfill needs
- **Need Statuses**: DRAFT, FLOATING, PLEDGED, FULFILLED, RECURRING
- **Need Types**: ONETIME, ONGOING

## Key Components

### Frontend Architecture
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom styling
- **Forms**: React Hook Form with Zod validation
- **Authentication Context**: Custom auth provider with session management

### Backend Architecture
- **API Routes**: RESTful endpoints for CRUD operations
- **Middleware**: Express session management, body parsing, error handling
- **Authentication**: Passport.js local strategy with bcrypt password hashing
- **Database Access**: Drizzle ORM with connection pooling
- **File Handling**: Static file serving for uploaded content

### Key Features
1. **Need Management**: Full CRUD operations for community needs
2. **Pledge System**: Community members can commit to fulfill needs
3. **Email Notifications**: Automated emails for pledges and fulfillments
4. **Admin Dashboard**: Comprehensive management interface
5. **Responsive Design**: Mobile-first approach with responsive layouts
6. **Share Functionality**: Direct links to individual needs
7. **Onboarding Tours**: Interactive user guidance system

## Data Flow

### Authentication Flow
1. Users authenticate via email/password
2. Session stored in PostgreSQL with connect-pg-simple
3. Admin users gain access to dashboard and management features
4. Regular users can view and pledge to needs

### Need Lifecycle
1. Admin creates need in DRAFT status
2. Need published to FLOATING status (visible to public)
3. Community member pledges support (status changes to PLEDGED)
4. Need fulfilled via email confirmation (status changes to FULFILLED)
5. Recurring needs cycle back to FLOATING status

### Email Workflow
1. Pledge made → Admin receives notification email
2. Pledge made → Supporter receives confirmation email
3. Email contains secure tokens for direct fulfillment actions
4. Token verification prevents unauthorized status changes

## External Dependencies

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `MAILERSEND_API_TOKEN`: Email service authentication
- `MAILERLITE_API_KEY`: Newsletter service integration

### Third-Party Services
- **Supabase**: PostgreSQL hosting and CRM data store
- **MailerSend**: Transactional email delivery
- **MailerLite**: Newsletter and subscriber management
- **Vercel**: Application hosting

### NPM Dependencies
- **Frontend**: React ecosystem, Radix UI, TanStack Query, Wouter
- **Backend**: Express, Passport, Drizzle ORM, MailerSend
- **Development**: TypeScript, Vite, Tailwind CSS, ESBuild

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20
- **Build Tool**: Vite with hot module replacement
- **Database**: PostgreSQL 16 module
- **Process**: `npm run dev` starts development server on port 5000

### Production Deployment
- **Build Process**: Vite builds client assets, ESBuild bundles server
- **Output**: Static assets in `dist/public`, server bundle as `dist/index.mjs`
- **Runtime**: Node.js production mode with Express serving static files
- **Scaling**: Replit autoscale deployment target

### Database Management
- **Schema**: Defined in TypeScript with Drizzle
- **Migrations**: Manual SQL migrations for schema changes
- **Connection**: Pooled connections with environment-based configuration

## Changelog

```
Changelog:
- June 27, 2025. Initial setup
- January 19, 2025. Created comprehensive card system documentation (CARD_SYSTEM_PROMPT.md) extracting all logic patterns for replication in other projects
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```
