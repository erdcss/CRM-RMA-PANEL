# Çalışkan Group RMA Panel

## Overview
A comprehensive Turkish-language RMA (Return Merchandise Authorization) management system for tracking product returns, exchanges, and service requests. Built as a Progressive Web App (PWA) with offline capabilities.

## Purpose
This application enables Çalışkan Group to efficiently manage customer service interactions, track product issues across three categories (returns, exchanges, service), and generate detailed reports and analytics.

## Current State
- **Phase**: MVP Complete - Ready for Testing and Deployment
- **Last Updated**: October 28, 2025

## Recent Changes
- **October 29, 2025 - Ultra-Compact Product Display**: 
  - ✅ **Çubuk Sütun (Bar/Column) Layout**: Redesigned product cards on detail page with ultra-compact spacing
  - ✅ **Colored Left Borders**: Added 4px colored left borders (red for İade, blue for Değişim, green for Servis) for visual category coding
  - ✅ **Optimized Spacing**: Achieved product heights of 171-179px (target <220px) with compact padding and margins
  - ✅ **Inline Status History**: Status and date displayed on same line with minimal spacing between entries
  - ✅ **Shadcn Compliance**: Used proper Card components with Tailwind color classes instead of inline styles
  
- **October 28, 2025 - Next Phase Features**: 
  - ✅ **Real-time Dashboard Updates**: Implemented automatic data refresh every 30 seconds on Dashboard, Kayıtlar, and İstatistikler pages using TanStack Query with optimized caching (staleTime, refetchOnWindowFocus settings)
  
- **October 28, 2025 - MVP Complete**: 
  - ✅ Implemented complete database schema with customers, tickets, products, and status history
  - ✅ Built all frontend pages: Dashboard, Kayıtlar (Records), İstatistikler (Statistics), Müşteriler (Customers), Ayarlar (Settings)
  - ✅ Created responsive sidebar navigation with theme toggle (light/dark mode)
  - ✅ Fixed responsive navigation with global SidebarTrigger in header
  - ✅ Implemented new ticket dialog with multi-product entry support
  - ✅ Added PWA manifest and service worker for offline functionality
  - ✅ Configured Turkish language support throughout the UI
  - ✅ Implemented complete backend API with PostgreSQL database
  - ✅ Created auto-system user (ID=1) for safe foreign key handling
  - ✅ Added PDF export with QR code generation
  - ✅ Integrated all frontend components with backend APIs
  - ✅ Added loading states, error handling, and toast notifications

## Project Architecture

### Technology Stack
- **Frontend**: React + TypeScript, Wouter (routing), TanStack Query (data fetching)
- **Backend**: Express.js, PostgreSQL with Drizzle ORM
- **UI**: Shadcn UI components, Tailwind CSS
- **Charts**: Recharts for statistics visualization
- **PDF**: jsPDF for report generation
- **QR Codes**: qrcode library for ticket tracking

### Database Schema
- **users**: System users (ID=1 auto-created for system operations)
- **customers**: Customer information (name, phone, email, address)
- **tickets**: Service tickets linking customers to products
- **products**: Individual product entries with category (iade/degisim/servis) and status tracking
- **statusHistory**: Timeline of status changes for each product

### Key Features Implemented
1. **Multi-page Navigation**
   - Dashboard with stats overview and recent tickets
   - Kayıtlar (Records) page with filtering by category, status, brand
   - İstatistikler (Statistics) with charts and analytics
   - Müşteriler (Customers) directory
   - Ayarlar (Settings) for app configuration

2. **Ticket Management**
   - Create tickets with customer info and multiple products
   - Categorize products as İade (Return), Değişim (Exchange), or Servis (Service)
   - Track product status: Beklemede, Serviste, Teslim Edildi, İptal
   - View detailed ticket information with status history

3. **Design System**
   - Blue/gray color scheme (#2563EB primary)
   - Inter font for body text, Manrope for headings, JetBrains Mono for technical data
   - Dark mode support with theme toggle
   - Responsive layout for mobile, tablet, and desktop
   - Accessible with proper ARIA labels and keyboard navigation

4. **PWA Support**
   - manifest.json for installability
   - Service worker for offline caching
   - Mobile-optimized UI

### File Structure
```
client/
  src/
    components/
      - app-sidebar.tsx (main navigation)
      - theme-toggle.tsx (dark/light mode switch)
      - new-ticket-dialog.tsx (multi-product ticket creation)
      - product-card.tsx (reusable product display)
      - ui/ (Shadcn components)
    pages/
      - dashboard.tsx (main overview)
      - kayitlar.tsx (records list with tabs)
      - kayit-detay.tsx (ticket detail view)
      - istatistikler.tsx (statistics and charts)
      - musteriler.tsx (customer directory)
      - ayarlar.tsx (settings)
    lib/
      - queryClient.ts (TanStack Query setup)
  index.html (Turkish language, PWA meta tags)
  
public/
  - manifest.json (PWA configuration)
  - service-worker.js (offline caching)

server/
  - routes.ts (API endpoints - to be implemented)
  - storage.ts (data access layer - to be converted to DatabaseStorage)
  - db.ts (to be created for PostgreSQL connection)

shared/
  - schema.ts (Drizzle database schema)
```

## User Preferences
- Language: Turkish (all UI labels and messages)
- Color scheme: Professional blue/gray theme
- Design style: Modern, clean, card-based layout
- Typography: Clear hierarchy with multiple font weights
- Mobile-first approach with responsive breakpoints

## MVP Features Completed
✅ **Database & Backend**
- PostgreSQL database with Drizzle ORM
- Complete schema: users, customers, tickets, products, statusHistory
- Auto-system user creation (ID=1)
- All CRUD API endpoints implemented
- Safe foreign key handling with cascading deletes

✅ **Frontend UI**
- Modern, responsive dashboard with Turkish language
- Sidebar navigation with mobile support
- Global header with SidebarTrigger and ThemeToggle
- Statistics page with charts (Recharts)
- Customer directory
- Ticket management with filtering and search
- Multi-product ticket creation dialog
- Ticket detail page with status updates and history

✅ **Advanced Features**
- PDF export with QR codes (jsPDF + qrcode)
- PWA support (manifest.json + service worker)
- Dark/Light theme toggle
- Loading states with Skeleton components
- Error handling with toast notifications
- Form validation with Zod

## Next Phase (Future Enhancements)
1. AI-powered assistant for natural language queries
2. Automated service tracking with 24-hour status updates
3. Email notifications for status changes
4. Advanced reporting with weekly/monthly PDF exports
5. Mobile app packaging for Android/iOS using Capacitor
6. Real-time dashboard updates with live data refresh

## Development Commands
- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Push schema changes to PostgreSQL database
- `npm run db:studio` - Open Drizzle Studio for database management

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key (auto-configured)

## Turkish Terms Used
- **Kayıt**: Record/Ticket
- **İade**: Return
- **Değişim**: Exchange  
- **Servis**: Service
- **Müşteri**: Customer
- **Beklemede**: Pending/Waiting
- **Serviste**: In Service
- **Teslim Edildi**: Delivered
- **İptal**: Cancelled
- **İstatistikler**: Statistics
- **Ayarlar**: Settings
