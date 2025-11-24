# Fix Normal Mode Layout - Final Touch

## Problem
In normal mode, both + button and send button are in the middle side by side. We need:
- + button on the LEFT
- Textarea in the MIDDLE (taking available space)
- Send button on the RIGHT

## Root Cause
The wrapper div has `flex-1` which makes it take all available space, centering its contents. In normal mode, we want the wrapper to only take the space it needs, and let the textarea take the flex space.

---

## Solution: Make wrapper conditional for flex-1

### Change the wrapper div className

**Find this line (around line 668):**
```typescript
            <div className="flex items-center space-x-3 flex-1">
```

**Replace with:**
```typescript
            <div className={`flex items-center space-x-3 ${imageMode ? 'flex-1' : ''}`}>
```

**Explanation:**
- **Normal mode** (`imageMode = false`): `flex items-center space-x-3` - wrapper only takes the space it needs
- **Image mode** (`imageMode = true`): `flex items-center space-x-3 flex-1` - wrapper takes full width

---

## Result

**Normal mode:**
- Wrapper div: only takes space for + button and image indicator (no flex-1)
- Textarea: has `flex-1` class, so it takes all remaining space
- Send button: stays on the right
- Layout: `[+ button] [textarea---grows---] [send button]`

**Image mode:**
- Form: `flex-col` (vertical)
- Top row: Textarea (full width)
- Bottom row: Wrapper has `flex-1`, contains:
  - + button on left
  - Image indicator
  - Spacer (flex-1) pushes send button right
  - Send button on right
- Layout: 
  ```
  [textarea---full width---]
  [+ button] [image indicator] [---spacer---] [send button]
  ```

---

## Summary

**Single change needed:**
```typescript
// FROM:
<div className="flex items-center space-x-3 flex-1">

// TO:
<div className={`flex items-center space-x-3 ${imageMode ? 'flex-1' : ''}`}>
```

This makes the wrapper only take `flex-1` in image mode, allowing the textarea to properly expand in normal mode!
