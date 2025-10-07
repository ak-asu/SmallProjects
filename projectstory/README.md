# ProjectStory - AI Coding Agent Instructions

## Project Overview
ProjectStory is a single-page React + TypeScript + Vite application with a **Frosted Glass UI (Glassmorphism)** theme. It creates an interactive, water-animated interface for processing documents through a multi-agent AI pipeline. The app uses Google's Generative AI (Gemini) to analyze uploaded files and generate dynamic, industry-specific stage-based content.

## Architecture

### Core Component: `water_glass_ui.tsx`
The main component implements a sophisticated **"water bubble" UI metaphor** with two distinct views:
- **Initial View**: File upload → 3 Category bubbles (Genre, Audience, Length) → Option bubbles → Selection
- **Cycle View**: Rotatable wheel with crystal arrows displaying AI-generated stages with detailed content

### UI Design Pattern: Concentric Circle Layout
- **Center**: Initial upload bubble (wiggling/animated surface)
- **Inner Circle (180px radius)**: 3 category bubbles (Genre, Audience, Length) - equidistant placement
- **Outer Circle (320px radius)**: Option bubbles populate dynamically when category is clicked
- All bubbles use glassmorphism: `backdrop-blur-xl bg-white/10 border border-white/20`

### Multi-Agent AI Pipeline (Sequential Execution)
The application follows a **3-agent architecture** using `@google/generative-ai` for document processing:

1. **Agent 1: File Analysis & Vector Embeddings** (`analyzeFileAndCreateEmbeddings`)
   - **Purpose**: Understand uploaded file and create searchable knowledge base
   - **Optimization**: Single API call with full file content (when `analyzeFullFile` is false)
   - Conditionally chunks documents based on `analyzeFullFile` flag (2000-character segments when true)
   - Uses `text-embedding-004` model to create vector embeddings for semantic search
   - Analyzes document type, domain, industry classification, and key themes
   - **Storage**: RAG (Retrieval Augmented Generation) locally in browser state (no backend)
   - Enables context-aware content generation in later stages

2. **Agent 2: Dynamic Stage Plan Creation** (`createStagePlan`)
   - **Purpose**: Generate industry/domain-specific lifecycle stages
   - Creates 5-6 contextual stages based on document analysis (e.g., SDLC for software projects)
   - Considers user preferences (genre/style, audience, length) from bubble selections
   - Returns JSON array with stage metadata: `{name, description, color, weight}`
   - **Weight field**: Determines arrow length in cycle view (0.8-1.5 scale)
   - Falls back to generic stages if JSON parsing fails (error resilience)

3. **Agent 3: Stage Content Generation** (`createStageContent`)
   - **Purpose**: Create detailed, audience-appropriate content for each stage
   - **Optimization**: Single API call generates content for ALL stages simultaneously
   - Retrieves relevant context from vector store (first 3 chunks for performance)
   - Generates content tailored to user selections (genre, audience, length)
   - Returns JSON format with all stage contents in one response
   - Formats output with headers and structured sections for readability
   - Content is industry-specific and directly relates to uploaded document

### Data Flow
```
File Upload → API Key Check → Agent 1 (Analysis + Embeddings) → 
Agent 2 (Stage Planning) → Agent 3 (Content Generation) → 
UI Transition (Initial → Cycle View)
```

## Critical Dependencies
**Installed Dependencies:**
- `@google/generative-ai` - Google Gemini API client
- `lucide-react` - Icon components (Upload, FileText, Eye, Share2, Loader2, etc.)
- `tailwindcss@next` (v4.0.0) - Tailwind CSS 4 with new Rust-based engine
- `@tailwindcss/postcss` (v4.0.0) - Tailwind CSS 4 PostCSS plugin
- `postcss` - CSS processing for Tailwind
- `autoprefixer` - Vendor prefix automation

**Tailwind CSS 4 Setup:**
- Uses `@tailwindcss/postcss` plugin (compatible with Vite 7)
- Configuration in `tailwind.config.js` and `postcss.config.js`
- Import syntax (`@import "tailwindcss"`) in `src/index.css`

## Developer Workflows

### API Key Management
- Users must provide Google AI API key at runtime (modal prompt)
- API key stored in component state (not persisted)
- Get key from: https://aistudio.google.com/app/apikey

## UI Animation System

### Animation Conventions
The UI uses **inline CSS keyframe animations** defined in a `<style>` tag within the component. All animations follow a **water-oriented theme**:
- `wiggle`: Organic bubble movement (border-radius morphing for living water effect)
- `splitOut{0-2}`: Water droplet split animation for 3 category bubbles
- `splitOutOption{0-5}`: Same split animation for option bubbles (reused pattern)
- `splash`: Bubble pop/burst effect when selections are made
- `waterTransition`: Cool water-oriented transition between initial and cycle views
- `ripple`: Pulsing concentric rings on upload button (water ripple effect)

### Position Calculations
- **Category bubbles**: 180px radius, 120° spacing (3 bubbles equidistant on inner circle)
- **Option bubbles**: 320px radius, dynamic angle distribution (outer circle, grouped by category)
- **Stage arrows**: 120px radius, 360°/stageCount spacing (left 1/3rd of cycle view)
- All use polar-to-cartesian coordinate conversion: `{x: cos(angle) * radius, y: sin(angle) * radius}`
- **Active arrow**: Horizontally most right position (click or scroll to rotate)

### State Management Pattern
Complex animation states managed through multiple useState hooks:
- `view`: 'initial' | 'cycle'
- `fileUploaded`, `splitting`, `transitioning`: Animation flags
- `bubbles`, `optionBubbles`: Bubble instances with `popped` and `isAnimating` flags
- Animations triggered via `setTimeout` chains for sequential effects

## Project-Specific Patterns

### Component Structure
- Single monolithic component (644 lines) - **no component decomposition**
- All state, logic, and UI in `WaterBubbleUI` component
- No external state management (Redux, Zustand, etc.)

### Styling Approach
- **Tailwind CSS 4** for utility classes (gradients, backdrop blur, glass morphism)
  - Using PostCSS integration with Vite 7
  - Frosted glass effects: `backdrop-blur-xl bg-white/10 border border-white/20`
  - Gradient backgrounds: `bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900`
- Inline styles for dynamic animations and positioning (calculated at runtime)
- CSS-in-JS via `<style>` tag for keyframe animations
- Color palette: Gradient combinations (`from-{color}-400 to-{color}-400`)
- Opacity modifiers for glassmorphism: `/10`, `/20`, `/30`, `/60`, `/80`

## Integration Points

### Google Generative AI Models
- **Analysis/Content**: `gemini-1.5-flash` (fast, cost-effective for text generation)
- **Embeddings**: `text-embedding-004` (vector generation for RAG)
- **Package**: `@google/generative-ai` (GoogleGenerativeAI client)
- Error handling: Alert-based user feedback (no toast system)

### File Upload System
- Accepts: `.txt`, `.md`, and `image/*` (images)
- Reads via `File.text()` API for text files (client-side processing)
- No server-side upload - client-side processing only
- **Optimization**: `analyzeFullFile` flag controls chunking behavior (default: false = single API call)

## Known Patterns to Preserve

1. **Sequential Agent Execution**: Never parallelize agents - each depends on previous results
2. **Fallback Stage Plan**: Always include default stages if JSON parsing fails
3. **Vector Store Slicing**: Only use first 3 chunks for context (performance constraint)
4. **Animation Delays**: Specific timing patterns (100ms splits, 600ms pops, 1500ms transitions)
5. **Transform-based Positioning**: All bubble positions use `translate(calc(-50% + Xpx), calc(-50% + Ypx))`
