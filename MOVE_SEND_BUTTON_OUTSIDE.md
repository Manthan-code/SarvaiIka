# Fix Send Button Position - Move it Outside Wrapper

## Problem
In normal mode:
- + button and send button are both inside the wrapper div
- They appear together on the left
- Textarea appears after them on the right

We need:
- + button on LEFT (inside wrapper)
- Textarea in MIDDLE
- Send button on RIGHT (OUTSIDE wrapper)

---

## Solution: Move Send Button Outside the Wrapper

The send button needs to be a sibling to the wrapper div, not a child of it.

### Step 1: Find the send button (around line 718-730)

**Find this code:**
```typescript
              {imageMode && <div className="flex-1"></div>}
              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className={`w-10 h-10 rounded-full p-0 flex items-center justify-center transition-all duration-200 ${input.trim()
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md"
                  : "bg-gray-300 dark:bg-[#303030] text-gray-400 cursor-not-allowed"
                  }`}
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
```

### Step 2: Move the send button

**Cut the send button** (from `{/* Send button */}` to `</button>`)

**Find the closing wrapper div** (the `</div>` right after the send button)

**Paste the send button AFTER the closing wrapper div:**

```typescript
              {imageMode && <div className="flex-1"></div>}
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className={`w-10 h-10 rounded-full p-0 flex items-center justify-center transition-all duration-200 ${input.trim()
                ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-md"
                : "bg-gray-300 dark:bg-[#303030] text-gray-400 cursor-not-allowed"
                }`}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
```

---

## Final Structure

After this change, the form structure will be:

```typescript
<form className={...}>
  
  {/* Textarea - order changes based on mode */}
  <div className={`relative flex-1 ${imageMode ? 'order-first' : ''}`}>
    <textarea ... />
  </div>

  {/* Wrapper - contains + button and image indicator */}
  <div className={`flex items-center space-x-3 ${imageMode ? 'flex-1 order-last' : 'order-first'}`}>
    {/* + button */}
    <div className="relative flex items-center" ref={menuRef}>
      <button>+</button>
      <div>dropdown menu</div>
    </div>

    {/* Image mode indicator */}
    {imageMode && (
      <button>Image indicator</button>
    )}

    {/* Spacer in image mode */}
    {imageMode && <div className="flex-1"></div>}
  </div>  {/* Close wrapper */}

  {/* Send button - OUTSIDE wrapper, sibling to wrapper and textarea */}
  <button type="submit">
    <ArrowUp />
  </button>
  
</form>
```

---

## Result

**Normal mode:**
- Wrapper (+ button): `order-first` → LEFT
- Textarea: default order → MIDDLE (flex-1 makes it expand)
- Send button: default order → RIGHT
- Layout: `[+ button] [textarea---grows---] [send button]`

**Image mode:**
- Form: `flex-col` (vertical)
- Textarea: `order-first` → TOP
- Wrapper: `order-last` → BOTTOM (contains + button, image indicator, spacer, but NOT send button)
- Send button: appears after wrapper in the bottom row
- Layout:
  ```
  [textarea---full width---]
  [+ button] [image indicator] [---spacer---] [send button]
  ```

---

## Summary

**Move the send button:**
1. Cut the send button code (lines ~718-730)
2. Paste it AFTER the wrapper's closing `</div>` tag
3. The send button should be a sibling to the wrapper, not a child

This ensures the send button is independent and appears on the right in normal mode!
