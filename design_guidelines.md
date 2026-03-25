# Social Media Orchestrator Design Guidelines

## Design Approach

**Selected System:** Linear-inspired productivity interface with Material Design data visualization principles

**Rationale:** This is a utility-focused, information-dense application requiring efficiency, learnability, and consistent patterns for daily professional use. Drawing from Linear's clean interface architecture and Material Design's robust data display components.

---

## Typography System

**Font Stack:**
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for metrics/data)

**Hierarchy:**
- H1: 2.5rem (40px), font-weight 700 - Dashboard headers
- H2: 2rem (32px), font-weight 600 - Section titles
- H3: 1.5rem (24px), font-weight 600 - Card headers
- H4: 1.25rem (20px), font-weight 600 - Subsections
- Body Large: 1rem (16px), font-weight 400 - Primary content
- Body: 0.875rem (14px), font-weight 400 - Secondary content
- Small: 0.75rem (12px), font-weight 500 - Labels, metadata
- Metrics: 1.5-3rem, font-weight 700, monospace - Analytics numbers

---

## Spacing System

**Tailwind Units:** Standardize on 2, 4, 6, 8, 12, 16, 24 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-16
- Card gaps: gap-6
- Button padding: px-6 py-3
- Input fields: p-3

---

## Layout Architecture

**Dashboard Structure:**
- Fixed left sidebar (280px) for navigation, collapsible to 64px icons-only
- Top bar (64px height) with search, notifications, user profile
- Main content area: max-w-screen-2xl with px-8 py-6
- Multi-column grids: 2-3 columns for analytics cards, single column for calendar

**Content Calendar:**
- Full-width calendar view with week/month toggle
- Day columns with vertical time slots
- Drag-and-drop post cards in timeline
- Right sidebar (320px) for post details when selected

**Analytics Dashboard:**
- Hero metrics row: 4-column grid showing key stats (reach, engagement, ROI, posts)
- Chart section: 2-column layout for graphs
- Performance table: full-width sortable data table

---

## Component Library

**Navigation:**
- Vertical sidebar with icon + label (collapsible)
- Active state: subtle left border accent
- Grouped sections with dividers

**Cards:**
- Elevated cards with rounded corners (rounded-lg)
- Subtle shadow: shadow-sm
- Padding: p-6
- Header + content + footer structure

**Buttons:**
- Primary: Solid fill, px-6 py-3, rounded-md, font-weight 600
- Secondary: Border outline, same padding
- Icon buttons: 40px square for toolbars
- Glass-morphism for buttons over images: backdrop-blur-md with semi-transparent background

**Form Elements:**
- Input fields: Full-width, rounded-md, border, p-3, focus ring
- Dropdowns: Custom styled with chevron icon
- Toggle switches: Modern pill-shaped
- File upload: Drag-drop zone with dashed border

**Calendar/Scheduling:**
- Grid-based time slots
- Post preview cards: rounded, shadow, platform icon badge
- Color-coded by platform (subtle accent bars)
- Hover state shows quick actions

**Tables:**
- Striped rows for readability
- Sticky header on scroll
- Sortable columns with arrow indicators
- Row hover state
- Compact row height for data density

**Modals/Drawers:**
- Slide-out drawer from right (480px) for content creation
- Centered modals for confirmations (max-w-2xl)
- Overlay: backdrop-blur-sm

**Analytics Visualizations:**
- Line charts for trend data
- Bar charts for comparisons
- Donut charts for distribution
- Minimal grid lines, clean axes
- Tooltips on hover with precise values

---

## Images

**Hero Image:**
No traditional hero section - this is a productivity application launching directly into dashboard.

**Content Images:**
- Empty state illustrations: Friendly, minimal line-art style illustrations (400x300px) for empty calendars, no posts scheduled
- Profile avatars: 40px circles for user profiles, 32px for team mentions
- Social platform icons: 24px official brand icons via Font Awesome
- Post preview thumbnails: 16:9 ratio within calendar cards
- Stock photos: Used within post creation interface, not in main UI

**Image Placement:**
- Dashboard: Platform connection status cards with small logo icons
- Content creation drawer: Large preview area (600x600px) for visual content
- Analytics: Optional campaign thumbnails in performance tables (64x64px)
- Empty states: Centered illustrations with call-to-action below

---

## Page-Specific Layouts

**Dashboard Home:**
- Quick stats grid (4 columns)
- Activity feed (2-column: scheduled posts + recent activity)
- Performance snapshot chart

**Content Calendar:**
- Full calendar grid with drag-drop
- Platform filter chips at top
- Bulk actions toolbar when items selected

**Analytics:**
- Date range selector in top-right
- Metric cards row
- Interactive charts section
- Detailed performance table below

**Post Creation:**
- Right-side drawer workflow
- Platform selector at top
- AI suggestion panel
- Visual editor canvas
- Schedule picker at bottom

---

## Interaction Patterns

**No hover/active states on glass-morphism buttons** - Button component handles its own states

**Animations:** Minimal and purposeful
- Sidebar collapse/expand: 200ms ease
- Modal/drawer entry: 300ms slide
- Calendar drag: Visual feedback only

**Icons:** Heroicons via CDN exclusively for consistency