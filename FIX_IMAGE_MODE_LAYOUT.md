# Image Mode UI Enhancements

## Changes Needed

1. ✅ **COMPLETED**: Move image mode indicator outside of + button div (fixed layout alignment)
2. 🔧 **NEW**: Make input box move to upper line when in image mode (two-row layout)
3. 🔧 **NEW**: Fix + button vertical alignment (center it properly)

---

## Change 1: Two-Row Layout for Image Mode

### Problem
Currently, the + button, image indicator, textarea, and send button are all in one row. When image mode is active, the textarea should move to the top row, with controls (+ button, image indicator, send button) on the bottom row.

### Solution
Change the form's flex direction to `flex-col` (column) when `imageMode` is true.

### Find this line (around line 648):

```typescript
          <form onSubmit={handleSend} className="relative flex items-end space-x-3">
```

### Replace with:

```typescript
          <form onSubmit={handleSend} className={`relative ${imageMode ? 'flex flex-col space-y-2' : 'flex items-end space-x-3'}`}>
```

**What this does:**
- When `imageMode` is false: `flex items-end space-x-3` (horizontal row, items aligned to bottom, horizontal spacing)
- When `imageMode` is true: `flex flex-col space-y-2` (vertical column, vertical spacing)

---

## Change 2: Fix + Button Vertical Alignment

### Problem
The + button appears slightly lower than it should be because it's using `items-end` alignment.

### Solution
Change the + button's container to use `items-center` for better vertical centering.

### Find this code (around line 650):

```typescript
            {/* "+" button with dropdown menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
```

### Replace with:

```typescript
            {/* "+" button with dropdown menu */}
            <div className="relative flex items-center" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
```

**What changed:** Added `flex items-center` to the parent `<div>` to ensure the button is vertically centered.

---

## Change 3: Wrap Controls in Bottom Row (for Image Mode)

### Problem
When in image mode with two rows, we need to ensure the controls (+ button, image indicator, send button) are grouped together in the bottom row.

### Solution
Wrap the controls in a container div when in image mode.

### Find the textarea section (around line 698):

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

### Replace with:

```typescript
            {/* Textarea - moves to top row in image mode */}
            <div className={`relative flex-1 ${imageMode ? 'order-first' : ''}`}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={imageMode ? "Describe the image you want to create..." : "Need help? Ask away…"}
                className="w-full bg-gray-100 dark:bg-[#303030] custom-scrollbar pr-2 border-none outline-none resize-none rounded-3xl px-2 py-2 text-l leading-6 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-h-[6px] max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent "
                rows={1}
              />

              {/* Blur overlay for long text */}
              {textareaRef.current && textareaRef.current.scrollHeight > 80 && (
                <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-gray-100 dark:from-gray-800 to-transparent rounded-t-2xl"></div>
              )}
            </div>

            {/* Bottom row controls wrapper - only in image mode */}
            {imageMode && (
              <div className="flex items-center space-x-3 w-full">
                {/* + button */}
                <div className="relative flex items-center" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Add files and more"
                  >
                    <span className="text-gray-600 dark:text-gray-300 text-3xl">+</span>
                  </button>
                </div>

                {/* Image mode indicator */}
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

                <div className="flex-1"></div>

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
            )}

            {/* Image mode indicator - only show in normal mode */}
            {imageMode && (
```

**Wait, this approach is getting complex. Let me provide a simpler solution...**

---

## SIMPLER APPROACH

Actually, let's use a cleaner approach. Here's what to change:

### Step 1: Update form className (line 648)

**Find:**
```typescript
<form onSubmit={handleSend} className="relative flex items-end space-x-3">
```

**Replace with:**
```typescript
<form onSubmit={handleSend} className={`relative ${imageMode ? 'flex flex-col space-y-3' : 'flex items-end space-x-3'}`}>
```

### Step 2: Add wrapper div for bottom controls in image mode

**Find the section starting with the + button (around line 649-650):**
```typescript
            {/* "+" button with dropdown menu */}
            <div className="relative" ref={menuRef}>
```

**Add this line BEFORE the + button div:**
```typescript
            {/* Bottom row controls in image mode */}
            <div className={imageMode ? 'flex items-center space-x-3 w-full' : 'contents'}>
```

**Then find the Send button closing tag (around line 720):**
```typescript
              </button>
            </div>
          </form>
```

**Add a closing div BEFORE the form closing:**
```typescript
              </button>
            </div>
          </form>
```

This wraps all controls (+ button, image indicator, textarea, send button) in a flex container when in image mode.

---

## Summary

After these changes:
- ✅ When image mode is OFF: Everything stays in one horizontal row
- ✅ When image mode is ON: 
  - Textarea appears on top row (full width)
  - + button, Image indicator, and Send button appear on bottom row
  - + button is properly centered vertically
