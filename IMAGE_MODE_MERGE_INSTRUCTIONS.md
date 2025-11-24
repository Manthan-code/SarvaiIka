# Image Mode UI Enhancement - Merge Instructions

Follow these steps to add the image mode indicator feature to your Chat.tsx file.

## Step 1: Add ImagePlus Import (Line 8)

**Find this line (line 8):**
```typescript
import { Copy, Share2, Check, ArrowUp, MoreHorizontal, Trash2 } from 'lucide-react';
```

**Replace with:**
```typescript
import { Copy, Share2, Check, ArrowUp, MoreHorizontal, Trash2, ImagePlus } from 'lucide-react';
```

---

## Step 2: Add imageMode State (After line 44)

**Find these lines (lines 43-46):**
```typescript
  const [showMenu, setShowMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const lastUserInputRef = useRef<string>('');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
```

**Replace with:**
```typescript
  const [showMenu, setShowMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const lastUserInputRef = useRef<string>('');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
```

---

## Step 3: Update "Create Image" Button Click Handler (Around line 671-677)

**Find this code block (around lines 671-677):**
```typescript
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  onClick={() => setShowMenu(false)}
                >
                  🎨 Create Image
                </button>
```

**Replace with:**
```typescript
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                  onClick={() => {
                    setImageMode(true);
                    setShowMenu(false);
                  }}
                >
                  🎨 Create Image
                </button>
```

---

## Step 4: Add Image Mode Indicator Button (After line 679)

**Find this line (line 679):**
```typescript
            </div>
```

**Right after this closing `</div>`, add the following code:**
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
```

---

## Step 5: Update Textarea Placeholder (Around line 688)

**Find this line (around line 688):**
```typescript
                placeholder="Need help? Ask away…"
```

**Replace with:**
```typescript
                placeholder={imageMode ? "Describe the image you want to create..." : "Need help? Ask away…"}
```

---

## Summary of Changes

1. ✅ Import `ImagePlus` icon from lucide-react
2. ✅ Add `imageMode` state variable
3. ✅ Update "Create Image" button to activate image mode
4. ✅ Add image mode indicator button with hover-only border styling
5. ✅ Update placeholder text based on mode

## Result

When you click "🎨 Create Image" from the dropdown:
- An "Image" indicator button will appear next to the + button
- The button shows the ImagePlus icon, "Image" text, and × to close
- Hover shows a border (no background color by default, only on hover)
- The textarea placeholder changes to guide image creation
- Click × to exit image mode

---

**Note:** The two-row layout (input area on top, controls on bottom) would require more extensive restructuring of the form element. If you'd like that feature, let me know and I can provide those additional instructions separately.
