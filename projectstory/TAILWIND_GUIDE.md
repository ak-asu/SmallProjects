# Tailwind CSS 4 Quick Reference for ProjectStory

## Glassmorphism Pattern (Used Throughout)

```tsx
// Standard glass bubble
className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"

// Hover effect
className="hover:scale-110 hover:bg-white/15"

// Active/selected state
className="scale-125 bg-white/20"
```

## Gradient Backgrounds

```tsx
// Main background gradient
className="bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900"

// Bubble color gradients (used in bubbleActions)
'from-purple-400 to-pink-400'    // Genre
'from-blue-400 to-cyan-400'      // Audience
'from-green-400 to-emerald-400'  // Length

// Stage arrow gradients
'from-blue-400 to-cyan-400'
'from-purple-400 to-pink-400'
'from-green-400 to-emerald-400'
'from-yellow-400 to-orange-400'
'from-pink-400 to-rose-400'
'from-indigo-400 to-purple-400'
```

## Opacity Modifiers

Tailwind CSS 4 supports opacity modifiers with `/` syntax:

```tsx
bg-white/10   // 10% opacity
bg-white/20   // 20% opacity
bg-white/30   // 30% opacity
text-white/70 // 70% opacity text
```

## Common Patterns in This Project

### Upload Bubble
```tsx
className="w-48 h-48 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
```

### Category Bubbles (Inner Circle)
```tsx
className="w-36 h-36 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
```

### Option Bubbles (Outer Circle)
```tsx
className="w-28 h-28 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
```

### Stage Arrows (Cycle View)
```tsx
className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
```

### Modal/Overlay
```tsx
className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
```

### Content Card (Stage Information)
```tsx
className="rounded-3xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl"
```

## Tailwind CSS 4 New Features

### Container Queries
```tsx
@container (min-width: 768px) {
  // Responsive styles based on container
}
```

### Native Cascade Layers
Tailwind 4 automatically uses CSS cascade layers for better specificity control.

### Improved Performance
- Faster compilation with Rust engine
- Smaller CSS output
- Better tree-shaking

## Tips

1. **Use opacity modifiers** instead of hex colors with alpha channels
   - ✅ `bg-white/10` 
   - ❌ `bg-[rgba(255,255,255,0.1)]`

2. **Leverage arbitrary values** when needed
   - `w-[${arrowLength}px]` for dynamic sizing

3. **Combine with inline styles** for computed values
   - Use Tailwind for static styles
   - Use inline styles for animations and calculated positions

4. **Glassmorphism formula**
   - `backdrop-blur-xl` (blur effect)
   - `bg-white/10` (semi-transparent background)
   - `border border-white/20` (subtle border)
   - `shadow-2xl` (depth)

## Development Workflow

1. Write JSX with Tailwind classes
2. Vite + PostCSS automatically processes CSS
3. Hot reload updates instantly
4. Build optimizes and purges unused classes

## Customization

Edit `tailwind.config.js` to add custom colors, spacing, etc.:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        'glass': 'rgba(255, 255, 255, 0.1)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
}
```
