# Image Mode Two-Row Layout - Clear Instructions

## Current State
✅ Form changes to `flex-col` in image mode - DONE
✅ + button has `flex items-center` - DONE

## Problem
All 4 elements (+ button, image indicator, textarea, send button) are stacked vertically. We need:
- **Top row**: Textarea (full width)
- **Bottom row**: + button, Image indicator, and Send button (horizontal)

---

## Solution: Wrap Bottom Controls

We need to wrap the + button, image indicator, and send button in a container div that makes them horizontal.

### Step 1: Add opening wrapper div

**Find this line (around line 649):**
```typescript
            {/* "+" button with dropdown menu */}
            <div className="relative flex items-center" ref={menuRef}>
```

**Add this line BEFORE it:**
```typescript
            {/* Controls wrapper - groups + button, image indicator, and send button */}
            <div className={imageMode ? 'flex items-center space-x-3 w-full' : 'contents'}>

            {/* "+" button with dropdown menu */}
            <div className="relative flex items-center" ref={menuRef}>
```

**Explanation:** 
- When `imageMode` is true: creates a horizontal flex container with spacing
- When `imageMode` is false: `contents` makes the div "invisible" so layout stays normal

---

### Step 2: Move textarea BEFORE the wrapper

**Find the textarea section (around line 698-710):**
```typescript
            {/* Image mode indicator */}
            {imageMode && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-gray-700 dark:text-gray-300 text-sm font-medium border border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                onClick={() => setImageMode(false)}
                title="Click to exit image mode"
              >
                <ImagePlus className="w-4 h-4" />
                <span>Image</span>
                <span className="text-xs opacity-70">×</span>
              </button>
            )}


            {/* Textarea */}
            <div className="relative flex-1">
```

The textarea needs to come BEFORE the controls wrapper. So the order should be:

1. Textarea
2. Controls wrapper (containing + button, image indicator, send button)

**Cut the entire textarea section** (from `{/* Textarea */}` to the closing `</div>` after the blur overlay)

**Paste it BEFORE the controls wrapper** you just added in Step 1.

---

### Step 3: Close the wrapper div

**Find the Send button closing (around line 720):**
```typescript
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
```

**Add the closing wrapper div BEFORE `</form>`:**
```typescript
              <ArrowUp className="h-5 w-5" />
            </button>
            </div>  {/* Close controls wrapper */}
          </form>
```

---

## Final Structure

After these changes, your form should look like this:

```typescript
<form className={imageMode ? 'flex flex-col space-y-2' : 'flex items-end space-x-3'}>
  
  {/* Textarea - appears first in image mode (top row) */}
  <div className="relative flex-1">
    <textarea ... />
  </div>

  {/* Controls wrapper - groups bottom row controls */}
  <div className={imageMode ? 'flex items-center space-x-3 w-full' : 'contents'}>
    
    {/* + button */}
    <div className="relative flex items-center" ref={menuRef}>
      <button>+</button>
      <div>dropdown menu</div>
    </div>

    {/* Image mode indicator */}
    {imageMode && (
      <button>Image indicator</button>
    )}

    {/* Send button */}
    <button type="submit">Send</button>
    
  </div>  {/* Close controls wrapper */}
  
</form>
```

---

## Result

When `imageMode` is **false** (normal mode):
- `contents` makes the wrapper invisible
- Everything stays in one horizontal row as before

When `imageMode` is **true** (image mode):
- Form uses `flex-col` (vertical)
- Textarea is on top (first child)
- Controls wrapper creates horizontal row at bottom
- + button, Image indicator, and Send button are side-by-side

---

## Quick Summary

1. Add `<div className={imageMode ? 'flex items-center space-x-3 w-full' : 'contents'}>` before the + button
2. Move the entire textarea section to come BEFORE this new wrapper div
3. Add `</div>` closing tag after the send button, before `</form>`
