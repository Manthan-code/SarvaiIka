# Fix Send Button in Image Mode - Keep it on Bottom Row

## Problem
In image mode:
- Send button appears on a separate line ABOVE the + button
- We need it to be on the SAME bottom row as the + button and image indicator

## Root Cause
The send button is now a sibling to the wrapper div. In image mode with `flex-col`, each sibling becomes a separate row. We need the send button to be part of the bottom row.

---

## Solution: Conditionally Move Send Button Inside Wrapper in Image Mode

We need the send button to be:
- **Normal mode**: Outside wrapper (sibling) → appears on right
- **Image mode**: Inside wrapper (child) → appears in bottom row with + button

### Option: Use conditional rendering

**Find the send button (around line 722):**
```typescript
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

**Replace with:**
```typescript
              {/* Send button - in image mode, inside wrapper for bottom row */}
              {imageMode && (
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
              )}
            </div>

            {/* Send button - in normal mode, outside wrapper for right alignment */}
            {!imageMode && (
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
            )}
```

---

## Explanation

We're rendering the send button twice with conditional logic:

1. **Inside wrapper** (before closing `</div>`): Only shows when `imageMode` is true
   - Becomes part of the bottom row with + button and image indicator
   
2. **Outside wrapper** (after closing `</div>`): Only shows when `imageMode` is false
   - Stays as a sibling, appears on the right in normal mode

---

## Result

**Normal mode (`imageMode = false`):**
- Send button outside wrapper renders
- Send button inside wrapper is hidden
- Layout: `[+ button] [textarea---grows---] [send button]`

**Image mode (`imageMode = true`):**
- Send button inside wrapper renders
- Send button outside wrapper is hidden
- Layout:
  ```
  [textarea---full width---]
  [+ button] [image indicator] [---spacer---] [send button]
  ```

---

## Summary

**Replace the current send button code with TWO conditional send buttons:**

1. **Inside wrapper** (before `</div>`): Shows only in image mode
2. **Outside wrapper** (after `</div>`): Shows only in normal mode

This ensures the send button appears in the correct position for both modes!
