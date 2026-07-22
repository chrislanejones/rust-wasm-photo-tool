# React Compiler rule violations — baseline @ 5621471

## CANDIDATES TO FIX (refs / static-components / preserve-manual-memoization)

### app/src/app/AppShell.tsx
  766 [preserve-manual-memoization] Compilation Skipped: Existing memoization could not be preserved

React Compiler has skipped optimizing this c
  913 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  915 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/app/session/useImageSession.ts
  141 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/components/DevTestsPane.tsx
  44 [static-components] Error: Cannot create components during render

Components created during render will reset their state each ti
  49 [static-components] Error: Cannot create components during render

Components created during render will reset their state each ti

### app/src/components/ImageMetaPanel.tsx
  159 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/features/canvas/ImageGuidesOverlay.tsx
  48 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  52 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/features/canvas/PenOverlay.tsx
  129 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  131 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  133 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/features/tools/settings/AISettings.tsx
  103 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  103 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/features/tools/settings/ResizeSettings.tsx
  222 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  223 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  224 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/features/tools/settings/TextSettings.tsx
  128 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  128 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/hooks/useBrushPreview.ts
  29 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  31 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  31 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  31 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  32 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  32 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/hooks/useDrawingTools.ts
  140 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  144 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  146 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  158 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  159 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  216 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  219 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/hooks/useRedStampTool.ts
  56 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/hooks/useStampTeardown.ts
  36 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 

### app/src/hooks/useTextTool.ts
  97 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  99 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  714 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 
  714 [refs] Error: Cannot access refs during render

React refs are values that are not needed for rendering. Refs should 


TOTAL fix-candidates: 38

## FLAG ONLY — DO NOT FIX (set-state-in-effect / purity)

### app/src/components/CanvasResize.tsx
  42 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/components/CelebrationDialog.tsx
  71 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  72 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  77 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  78 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  79 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  80 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  81 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  82 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct
  83 [purity] Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure funct

### app/src/components/ColorSwatchGrid.tsx
  40 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 
  51 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/components/ImageMetaPanel.tsx
  188 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 
  206 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/components/ResourceMonitor.tsx
  175 [purity] Error: Cannot call impure function during render

`Date.now` is an impure function. Calling an impure function

### app/src/components/SubscriptionButton.tsx
  172 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/canvas/CompareSlider.tsx
  31 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/canvas/GridThumbnails.tsx
  77 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/canvas/PenOverlay.tsx
  176 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/commandPalette/CommandPalette.tsx
  140 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/gallery/GalleryBar.tsx
  100 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/features/tools/settings/ResizeSettings.tsx
  153 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/hooks/useAIJob.ts
  63 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/hooks/useDiagnostics.ts
  203 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 
  212 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 
  241 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 
  269 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 

### app/src/hooks/useIdleTimeout.ts
  28 [set-state-in-effect] Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to 


TOTAL flag-only: 28
