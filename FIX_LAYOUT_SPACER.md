# Fix Layout Issues - Normal Mode and Image Mode

## Problems
1. **Normal mode**: + icon shifts to the right (should stay on left)
2. **Image mode**: Send button moves from right to left (should stay on right)

## Root Cause
The wrapper div using `'contents'` in normal mode is causing layout issues. We need a better approach.

---

## Solution: Add flex-1 spacer in image mode

Instead of using `'contents'`, we'll keep the wrapper div but add a spacer element that pushes the send button to the right in image mode.

### Change the wrapper div

**Find this line (around line 668):**
```typescript
            <div className={imageMode ? 'flex items-center space-x-3 w-full' : 'contents'}>
```

**Replace with:**
```typescript
            <div className="flex items-center space-x-3 flex-1">
```

**Explanation:** 
- Remove the conditional className
- Always use `flex items-center space-x-3 flex-1`
- This keeps the layout consistent in both modes

---

### Add spacer before send button (image mode only)

**Find the send button section (around line 720):**
```typescript
              {/* Send button */}
              <button
                type="submit"
```

**Add this BEFORE the send button:**
```typescript
              {/* Spacer to push send button to the right in image mode */}
              {imageMode && <div className="flex-1"></div>}

              {/* Send button */}
              <button
                type="submit"
```

**Explanation:**
- In image mode: the spacer div takes up all available space, pushing the send button to the right
- In normal mode: no spacer, so send button stays in its natural position

---

## Result

**Normal mode (imageMode = false):**
- + button on left
- Image indicator hidden
- Textarea in middle (flex-1 makes it take available space)
- Send button on right
- No spacer, natural flex layout

**Image mode (imageMode = true):**
- Form uses flex-col (vertical)
- **Top row**: Textarea (full width)
- **Bottom row**: 
  - + button on left
  - Image indicator next to it
  - Spacer (flex-1) takes middle space
  - Send button pushed to the right

---

## Summary

1. Change wrapper div from conditional to always use: `className="flex items-center space-x-3 flex-1"`
2. Add spacer before send button: `{imageMode && <div className="flex-1"></div>}`

This keeps the layout clean and predictable in both modes!
