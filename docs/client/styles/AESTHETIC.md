# AutoBio Design Aesthetic

## Core Design Philosophy

AutoBio follows a **sleek, artistic, and designer-focused** aesthetic that balances minimalism with vibrant user-generated content. The design is intentionally **non-cliche**, avoiding generic UI patterns in favor of a distinctive, high-style visual language.

---

## Color System

### UI Elements: Grayscale Palette
The entire user interface uses a sophisticated **slate grayscale palette** for all structural elements:

- **Backgrounds**: `slate-50` (lightest) to `slate-900` (darkest)
- **Text**: `slate-700` to `slate-900` for primary text, `slate-500` for secondary
- **Borders**: `slate-200` to `slate-900` depending on emphasis
- **No color in UI**: Buttons, forms, navigation, and structural elements are strictly grayscale

### User Content: Vibrant & Colorful
User-generated content (memories, images, illustrations) uses **vibrant, saturated colors** to create visual interest and contrast:

- **Rainbow Gradient Accents**: Memory cards feature a vertical rainbow gradient border (red → orange → yellow → green → blue → indigo → purple → pink)
- **Chronological Rainbow Timeline**: Timeline markers follow a chronological rainbow gradient based on memory position (oldest = red, newest = pink)
- **Color Palette**:
  - Red: `#ff1744`
  - Orange: `#ff6f00`
  - Yellow: `#ffc400`
  - Green: `#00e676`
  - Blue: `#2979ff`
  - Indigo: `#3d5afe`
  - Purple: `#7c4dff`
  - Pink: `#e91e63`

---

## Shape & Form

### Sharp, Geometric Design
- **No rounded corners**: All elements use sharp, geometric shapes (`border-radius: 0`)
- **Clean lines**: Borders are crisp and minimal (typically 1-2px)
- **Rectangular forms**: Cards, buttons, inputs all use sharp rectangular shapes
- **Circular elements**: Only used for timeline markers (circles, not squares)

### Minimal Shadows
- **Borders over shadows**: Prefer border-based depth over drop shadows
- **Subtle borders**: `border-slate-200` for default, `border-slate-900` for emphasis
- **No soft shadows**: Avoid generic shadow effects

---

## Typography

### Font Stack
- **Primary**: Inter (system fallbacks: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial)
- **Display**: Inter with system fallbacks
- **Font features**: Kerning and ligatures enabled for refined typography

### Typography Scale
- **Tight letter spacing**: Headings use negative letter spacing (`-0.02em` to `-0.03em`)
- **Uppercase labels**: Form labels, small text, and metadata use uppercase with wider tracking (`tracking-wider`)
- **Font weights**: 
  - Headings: `font-semibold` (600)
  - Body: `font-medium` (500) for emphasis, regular for body text
- **Line heights**: Tighter for headings, relaxed for body text

### Text Hierarchy
- **Headings**: Large, semibold, tight tracking (e.g., `text-4xl font-semibold tracking-tight`)
- **Labels**: Small, uppercase, wide tracking (e.g., `text-xs font-semibold uppercase tracking-wider`)
- **Body**: Regular weight, comfortable line height

---

## Spacing & Layout

### Generous Spacing
- **Section padding**: `py-12` (3rem vertical) for major sections
- **Component gaps**: `gap-6` to `gap-12` for component spacing
- **Content padding**: `px-6 sm:px-8 lg:px-12` for responsive horizontal padding

### Clean Layouts
- **Max-width containers**: `max-w-5xl` to `max-w-6xl` for content areas
- **Centered content**: `mx-auto` for centered layouts
- **Border separators**: Use `border-b border-slate-200` for section dividers

---

## Interactive Elements

### Buttons
- **Primary**: Black background (`bg-slate-900`), white text, uppercase, wide tracking
- **Secondary**: Transparent with black border, hover fills with black
- **Sharp corners**: No border radius
- **Minimal hover**: Simple color transitions, no box highlights
- **Uppercase text**: All button text is uppercase with `tracking-wider`

### Forms & Inputs
- **Sharp borders**: `border border-slate-200`, focus to `border-slate-400`
- **No rounded corners**: All inputs are rectangular
- **Label style**: Uppercase, small, wide tracking (`form-label` class)
- **Placeholder text**: `slate-400` for subtle hints

### Navigation
- **Minimal arrows**: Icon-only navigation (no boxes), color change on hover
- **Clean links**: No underlines by default, hover color transitions
- **Sharp dropdowns**: Border-based dropdowns, no rounded corners

---

## Component-Specific Patterns

### Memory Cards
- **Rainbow gradient accent**: Vertical gradient border on left edge (1px width)
- **Sharp borders**: `border border-slate-200`, active state uses `border-slate-900`
- **Generous padding**: `p-8` for card content
- **Section dividers**: `border-b border-slate-200` for header/content separation
- **Tags**: Sharp rectangular tags with borders, uppercase text

### Timeline
- **Circular markers**: Rounded markers (not squares) with chronological rainbow colors
- **Sharp preview cards**: Hover previews use sharp borders, no rounded corners
- **Gradient distribution**: Colors evenly distributed across all memories (oldest = red, newest = pink)

### Navigation
- **Tall header**: `h-20` for more breathing room
- **Uppercase nav links**: Small, uppercase, wide tracking
- **Sharp dropdowns**: Border-based dropdowns with sharp corners
- **Minimal hover states**: Simple background color changes

---

## Visual Hierarchy

### Emphasis Through Contrast
- **Bold borders**: Use `border-2 border-slate-900` for important elements
- **Color for content**: Only user-generated content gets color
- **Grayscale structure**: All UI chrome is grayscale

### Content vs. Chrome
- **UI elements**: Grayscale, minimal, structural
- **User content**: Colorful, vibrant, expressive
- **Clear separation**: The contrast between grayscale UI and colorful content creates visual interest

---

## Animation & Transitions

### Subtle Motion
- **Duration**: `duration-150` to `duration-200` (fast, not sluggish)
- **Easing**: Default ease transitions
- **Hover states**: Simple color transitions, no complex animations
- **Scale effects**: Minimal scale on active states (e.g., timeline markers: `scale(1.5)` when active)

---

## Responsive Design

### Breakpoints
- **Mobile**: Default styles
- **sm**: `640px` and up
- **lg**: `1024px` and up

### Adaptive Elements
- **Padding**: Increases on larger screens (`px-6 sm:px-8 lg:px-12`)
- **Typography**: Scales appropriately but maintains tight tracking
- **Layout**: Flexbox and grid adapt gracefully

---

## Anti-Patterns (What We Avoid)

### ❌ Don't Use
- Rounded corners (`rounded-md`, `rounded-lg`, etc.)
- Soft shadows (`shadow-lg`, `shadow-xl`)
- Generic button styles (gradient backgrounds, multiple colors)
- Color in UI elements (buttons, forms, navigation should be grayscale)
- Cliche design patterns (card shadows, rounded buttons, etc.)
- Excessive animations or transitions
- Multiple color schemes in UI

### ✅ Do Use
- Sharp, geometric shapes
- Border-based depth
- Grayscale for all UI
- Color only for user content
- Minimal, purposeful animations
- Uppercase labels with wide tracking
- Tight letter spacing for headings

---

## Implementation Guidelines

### CSS Classes
- **`.btn-primary`**: Black background, white text, uppercase, sharp
- **`.btn-secondary`**: Transparent with border, hover fills
- **`.input-field`**: Sharp borders, no rounded corners
- **`.form-label`**: Uppercase, small, wide tracking
- **`.card`**: Sharp borders, minimal styling

### Tailwind Patterns
- **Colors**: Use `slate-*` for all UI elements
- **Borders**: `border`, `border-2` with `border-slate-*`
- **Typography**: `tracking-tight` for headings, `tracking-wider` for labels
- **Spacing**: Generous padding (`p-8`, `py-12`)
- **Shapes**: No `rounded-*` classes

### Component Patterns
- **Memory cards**: Always include rainbow gradient accent border
- **Timeline markers**: Use chronological rainbow colors (not random)
- **Navigation**: Minimalist arrows/icons, no boxes
- **Forms**: Sharp inputs with uppercase labels

---

## Design Principles Summary

1. **Grayscale UI, Colorful Content**: Structural elements are grayscale; user content is vibrant
2. **Sharp & Geometric**: No rounded corners, clean lines, rectangular forms
3. **Minimal & Sleek**: Avoid cliche patterns, use borders over shadows
4. **Typography-First**: Tight tracking, uppercase labels, clear hierarchy
5. **Purposeful Color**: Rainbow gradients for memory accents and timeline markers
6. **Consistent Spacing**: Generous padding and clear section separation
7. **Subtle Interactions**: Fast, simple transitions without excessive motion

---

## Future Considerations

When adding new components or features:

1. **Maintain grayscale UI**: All new UI elements should use the slate palette
2. **Reserve color for content**: Only user-generated content should have color
3. **Use sharp shapes**: No rounded corners unless specifically needed (like timeline circles)
4. **Follow typography scale**: Use established heading and label patterns
5. **Keep spacing generous**: Don't compress layouts
6. **Maintain consistency**: Reference existing components for patterns

---

*Last Updated: 2024*

