# Çalışkan Group RMA Panel - Design Guidelines (Compact)

## Core Principles
- **Clarity over decoration**: Every element serves functional purpose
- **Scannable architecture**: Quick data location
- **Progressive disclosure**: Complex details on demand
- **Consistent interactions**: Predictable behavior across components

---

## Typography

**Fonts:**
- Body/Forms/Tables: 'Inter' (Google Fonts)
- Headings: 'Manrope' (Google Fonts)
- Technical Data: 'JetBrains Mono' (Google Fonts)

**Scale:**
```
Display: 2.5rem/40px (Manrope Bold) - Dashboard title
H1: 2rem/32px (Manrope SemiBold) - Page headers
H2: 1.5rem/24px (Manrope SemiBold) - Sections
H3: 1.25rem/20px (Manrope Medium) - Cards/modals
Body Large: 1rem/16px (Inter) - Primary content
Body: 0.875rem/14px (Inter) - Tables/secondary
Small: 0.75rem/12px (Inter) - Metadata/timestamps
Technical: 0.875rem/14px (JetBrains Mono) - Serial numbers
```
**Line heights:** Headings 1.2, Body 1.5, Tables 1.4

---

## Layout & Spacing

**Spacing Units:** 4, 8, 12, 16, 24, 32, 48px

**Application:**
- Component padding: p-4 (buttons), p-6 (cards), p-8 (modals)
- Section spacing: mb-8/12/16
- Grid gaps: gap-4/6/8
- Container margins: mx-4 (mobile), mx-8 (tablet), mx-12 (desktop)

**Grid:**
- Sidebar: 280px (desktop), 72px (collapsed), off-canvas (mobile)
- Content: 12-column grid, max-width-7xl
- Breakpoints: Mobile <768px, Tablet 768-1024px, Desktop >1024px

---

## Color System

### Light Mode (Default)
**Primary Brand:** Blue-600 (#2563EB)
**Backgrounds:** White (#FFFFFF), Gray-50 (#F9FAFB)
**Text:** Gray-900 (#111827), Gray-600 (#4B5563)
**Borders:** Gray-200 (#E5E7EB)

### Dark Mode
**Backgrounds:** Gray-900 (#111827), Gray-800 (#1F2937)
**Text:** Gray-50 (#F9FAFB), Gray-400 (#9CA3AF)
**Borders:** Gray-700 (#374151)

### Status Colors (Both Modes)
- Success: Green-600 / Green-400
- Error: Red-600 / Red-400
- Warning: Yellow-600 / Yellow-400
- Info: Blue-600 / Blue-400

---

## Components

### Navigation

**Sidebar:**
- Active state: Left accent border (primary color)
- Icons: Heroicons outline
- Sections: Dashboard, Kayıtlar, İstatistikler, Müşteriler, Ayarlar
- Footer: Theme toggle, user profile

**Top Nav (64px):**
- Logo left, search center (400px min), notifications + avatar right
- Mobile: Full-width search

**Breadcrumb:**
- text-sm, "/" separator, clickable segments except current

### Cards

**Standard Card:**
```css
border-radius: 8px (rounded-lg)
padding: 24px (p-6)
shadow: shadow-sm (hover: shadow-md)
```

**Product Status Card:**
- Grid: 1/2/3 columns (mobile/tablet/desktop), gap-6
- Content: Thumbnail (80x80px), name, brand, serial, status badge, customer, date
- Actions: Icon buttons (View, Update, Export PDF)
- Status indicator: Vertical left border

### Tables

- Sticky header
- Alternating row backgrounds
- Cell padding: px-4 py-3
- Row hover: Full highlight
- Sort: Arrow icons in headers
- Pagination: Bottom placement

### Forms

**Modal (max-width-3xl):**
- Overlay: Semi-transparent backdrop
- Animation: Fade + scale 200ms
- Header: Title + close, border-bottom
- Body: Scrollable, sectioned forms
- Footer: Right-aligned actions, border-top

**Inputs (h-10/40px):**
```css
padding: px-4
border: 1px rounded-md
focus: Ring effect
label: Above, text-sm font-medium, mb-2
error: Red border + helper text (text-xs, mt-1)
```

**Buttons:**
- Standard: h-10, px-6, rounded-md, font-medium
- Large CTA: h-12, px-8
- Primary: Solid fill | Secondary: Outline
- Icon: w-10 h-10 square

### Status Categories

Three collapsible sections: "İade Ürünler", "Değişim Ürünleri", "Arızalı Ürünler"
- Count badges
- Product card grids
- Empty states: Centered illustration (240x180px) + message

### Statistics

**Metric Cards (2x2 grid):**
- Large number: text-3xl font-bold
- Label: text-sm
- Trend: Arrow + percentage
- Icon: Top-left decorative

**Charts (300px min height):**
- Types: Bar (brand comparison), Pie (status), Line (trends)
- Library: Chart.js (CDN)
- Legend: Below, horizontal

### Interactive

**Search:**
- Placeholder: "Müşteri, seri numarası veya ürün ara..."
- Dropdown: Recent searches, filters, quick links
- Clear button when text present

**Filter Panel:**
- Sections: Status, Date, Brand, Customer
- Checkbox multi-select
- Actions: "Uygula", "Temizle"

**Notifications (Toast):**
- Position: Top-right stack
- Auto-dismiss: 4s
- Types: Success, Error, Info, Warning (icon + message + close)
- Animation: Slide right, fade out

**Timeline (Product History):**
- Vertical with dashed connectors
- Entry: Timestamp, status, user, notes
- Current: Highlighted node

### Special Features

**QR Code:**
- Export: 200x200px, top-right PDF placement
- Label: "Kayıt Detayı İçin Tara"

**PDF Export:**
- Button: "Fiş Oluştur / Dışa Aktar (PDF)" with icon
- Bulk: Checkbox selection mode

**PWA Prompt:**
- Trigger: Second visit
- Actions: "Ana Ekrana Ekle" (primary), "Şimdi Değil" (secondary)

---

## Accessibility

- **Touch targets:** Minimum 44x44px
- **Focus:** Clear ring on all interactive elements
- **Keyboard:** Full Tab/Enter/Esc support
- **ARIA:** Labels on icon-only buttons
- **Validation:** Clear error messages
- **Skip link:** "Ana İçeriğe Geç"
- **Turkish chars:** UTF-8 encoding (Ç, Ş, Ğ, İ, Ö, Ü support)

---

## Mobile Optimization

**Responsive:**
- Sidebar: Off-canvas drawer with hamburger
- Cards: Full-width stack
- Tables: Horizontal scroll or card transform
- Forms: Single column
- Modals: Full-screen <768px
- Bottom sheet: Quick actions

**PWA:**
- Icon: 512x512px
- Standalone: Hide browser chrome
- Theme color: Primary brand
- Offline: Top banner indicator

---

## Animation

**Duration & Easing:**
- Modal: 200ms fade + scale
- Dropdown: 150ms slide down
- Hover: 100ms background
- Loading: Spinner/skeleton (no page transitions)

**Avoid:** Excessive scroll animations, decorative motion

---

## Images

- **Product thumbnails:** 80x80px (cards), 120x120px (detail), rounded
- **Empty states:** 240x180px simple line illustrations, centered
- **Logo:** 40px height (nav), 120px width (PDF)
- **QR:** Generated per ticket (200x200px exports)

---

## Implementation Notes

**Grid Layout Structure:**
```
┌─────────────────────┐
│ Nav (64px)          │
├────┬────────────────┤
│Side│ Breadcrumb     │
│bar │ Title + Actions│
│280 │ Content        │
│px  │ Cards/Tables   │
└────┴────────────────┘
```

**Form Sections (Yeni Kayıt):**
1. Müşteri Bilgileri: 2-col grid (Name/Phone, Email/Address)
2. Ürün Bilgileri: Dynamic rows (+ Ürün Ekle), remove per row, expandable textarea

**Customer Reports:** Sortable table (name, returns, last activity, status), top customers highlighted, PDF export