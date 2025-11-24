# Fix + Button Position - Keep it on the Left

## Problem
Both + button and send button moved to the right. The + button should be on the LEFT side.

## Root Cause
The current structure has the textarea BEFORE the wrapper div containing the + button. In normal mode with `flex items-end`, this causes the + button to appear after the textarea.

---

## Solution: Conditional Rendering Order

We need different element orders for normal mode vs image mode:
- **Normal mode**: + button → textarea → send button
- **Image mode**: textarea → (+ button, image indicator, send button)

### Option 1: Use CSS `order` property (RECOMMENDED - Simpler)

**Find the textarea div (around line 648):**
```typescript
            {/* Textarea */}
            <div className="relative flex-1">
```

**Replace with:**
```typescript
            {/* Textarea */}
            <div className={`relative flex-1 ${imageMode ? 'order-first' : ''}`}>
```

**Find the wrapper div (around line 668):**
```typescript
            <div className={`flex items-center space-x-3 ${imageMode ? 'flex-1' : ''}`}>
```

**Replace with:**
```typescript
            <div className={`flex items-center space-x-3 ${imageMode ? 'flex-1 order-last' : 'order-first'}`}>
```

**Explanation:**
- **Normal mode**: Wrapper has `order-first`, textarea has no order (defaults to 0), so wrapper appears first (left)
- **Image mode**: Textarea has `order-first`, wrapper has `order-last`, so textarea appears on top

---

## Result

**Normal mode:**
- Wrapper (+ button): `order-first` → appears first (LEFT)
- Textarea: default order → appears in middle
- Send button: default order → appears last (RIGHT)
- Layout: `[+ button] [textarea---grows---] [send button]`

**Image mode:**
- Form: `flex-col` (vertical)
- Textarea: `order-first` → appears first (TOP)
- Wrapper: `order-last` → appears last (BOTTOM)
- Layout:
  ```
  [textarea---full width---]
  [+ button] [image indicator] [---spacer---] [send button]
  ```

---

## Summary

**Two changes needed:**

1. **Textarea div (line ~648):**
   ```typescript
   <div className={`relative flex-1 ${imageMode ? 'order-first' : ''}`}>
   ```

2. **Wrapper div (line ~668):**
   ```typescript
   <div className={`flex items-center space-x-3 ${imageMode ? 'flex-1 order-last' : 'order-first'}`}>
   ```

This uses CSS flexbox `order` property to control the visual order without changing the DOM structure!
