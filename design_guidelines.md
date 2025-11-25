# Design Guidelines: Next.js RAG Chat Application

## Design Approach: Minimal Functional System
**Selected System**: Clean developer-focused interface inspired by Linear's clarity and VS Code's functional aesthetic
**Rationale**: This is an educational/technical demonstration prioritizing clarity and functionality over visual flair. The design should feel professional but stay out of the way of the learning experience.

## Core Design Elements

### A. Typography
- **Primary Font**: 'Inter' or 'system-ui' for all text
- **Chat Messages**: 
  - User messages: font-medium, text-base
  - AI responses: font-normal, text-base
  - Code/technical content: 'Monaco', 'Consolas', or monospace font family
- **Labels**: text-sm, font-medium
- **Headings**: text-lg to text-xl, font-semibold for page title only

### B. Layout System
**Spacing Units**: Use Tailwind units of 3, 4, 6, and 8 consistently
- Container padding: p-4 to p-6
- Message spacing: gap-4 between messages
- Form spacing: gap-3 for form elements
- Page margins: p-6 to p-8 for main container

**Layout Structure**:
- Single-column centered layout: max-w-3xl mx-auto
- Chat container: Full viewport height minus header (h-[calc(100vh-theme(spacing.16))])
- Messages area: flex-1 with overflow-y-auto
- Input form: Fixed at bottom with backdrop blur

### C. Component Library

**Chat Message Bubbles**:
- User messages: Align right, max-w-[80%] ml-auto
- AI messages: Align left, max-w-[80%] mr-auto
- Padding: p-4 for message content
- Border radius: rounded-lg
- Clear role indicators: Small label above each message ("You" / "AI Assistant")

**Input Form**:
- Textarea: min-h-[80px], resize-none, rounded-lg, p-3
- Submit button: px-6 py-3, rounded-lg, font-medium
- Container: Sticky bottom with p-4, backdrop-blur-sm

**Message Container**:
- Scrollable area with smooth scrolling behavior
- Auto-scroll to bottom on new messages
- Visual separator between messages using spacing only (no divider lines)

**Page Header** (minimal):
- Title: "RAG Chat Demo" or "FAQ Assistant"
- Subtitle: Brief description in text-sm
- Total height: h-16, with border-b-2

### D. Component States

**Form States**:
- Textarea focus: Subtle border change (2px border width)
- Button disabled: Reduced opacity (opacity-50) while processing
- Loading indicator: Simple text "Processing..." or minimal spinner

**Message Display**:
- User messages: Right-aligned with distinct visual treatment
- AI messages: Left-aligned with distinct visual treatment
- Consistent spacing pattern: mb-4 between message groups
- Timestamp: text-xs, opacity-70, positioned below message content

**Empty State**:
- Centered message: "Start a conversation by typing below"
- Icon: Simple chat icon or search icon from Heroicons
- Padding: py-12 for vertical centering

## Visual Hierarchy

**Priority Levels**:
1. User input area (most prominent interaction point)
2. Latest AI response
3. Message history
4. Page header

**Spacing Hierarchy**:
- Page padding: p-8
- Section gaps: gap-6
- Component internal spacing: p-4
- Small details: p-2 to p-3

## Technical Implementation Notes

**Accessibility**:
- Label all form inputs properly
- ARIA labels for message roles ("user message", "assistant message")
- Keyboard navigation support (Enter to send, Shift+Enter for new line)
- Focus visible states on all interactive elements

**Responsive Behavior**:
- Desktop (lg): max-w-3xl centered
- Tablet (md): max-w-2xl, reduced padding (p-6)
- Mobile (base): Full width with p-4, message max-width increases to 90%

**Icons**: Use Heroicons (outline style) via CDN for:
- Send button icon (paper-airplane)
- Optional user/AI avatars (user-circle, cpu-chip)

## Layout Specifications

**Main Container**:
```
- max-w-3xl mx-auto
- min-h-screen flex flex-col
- p-6 to p-8
```

**Messages Area**:
```
- flex-1 overflow-y-auto
- flex flex-col gap-4
- pb-6 (padding bottom for scroll breathing room)
```

**Form Container**:
```
- sticky bottom-0
- backdrop-blur-sm
- p-4, border-t-2
- flex gap-3
```

## Key Design Principles

1. **Clarity First**: Every element serves the tutorial/demonstration purpose
2. **Minimal Chrome**: No unnecessary decorative elements
3. **Functional Beauty**: Clean, professional appearance without visual complexity
4. **Developer-Friendly**: Design that developers would actually build and understand
5. **Scannable Content**: Easy to distinguish user vs AI messages at a glance

This design supports the educational nature of the project while maintaining professional polish suitable for demonstration purposes.