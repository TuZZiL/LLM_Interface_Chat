---
name: Obsidian Intelligence
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#bcff5f'
  on-secondary: '#203600'
  secondary-container: '#95e400'
  on-secondary-container: '#3d6200'
  tertiary: '#fff5de'
  on-tertiary: '#3b2f00'
  tertiary-container: '#fed639'
  on-tertiary-container: '#715d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#a8f928'
  secondary-fixed-dim: '#8fdb00'
  on-secondary-fixed: '#112000'
  on-secondary-fixed-variant: '#314f00'
  tertiary-fixed: '#ffe179'
  tertiary-fixed-dim: '#eac324'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#554500'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-main:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 20px
  stack-lg: 40px
---

## Brand & Style

This design system is built for a high-performance AI environment where focus and clarity are paramount. The personality is disciplined, intellectual, and technologically advanced. It rejects the "neon-soaked" tropes of typical AI interfaces in favor of a **Minimalist-Glassmorphic** hybrid that feels like a precision instrument.

The emotional response should be one of quiet confidence. By utilizing deep, monochromatic layers and high-contrast typography, the interface recedes into the background, allowing the AI's output to remain the focal point. Subtle glows and translucency provide just enough depth to signify a modern, cutting-edge platform without sacrificing the "premium dark" aesthetic.

## Colors

The palette is strictly anchored in a "void" aesthetic. The base layer is a near-pure black to ensure OLED depth and maximum focus. 

- **Neutral Tiers:** Progresses from `background_base` (#050505) to `surface_slate` (#1C1E21). Use slate only for floating panels or interactive surfaces.
- **Accents:** 
    - **Electric Cyan (#00F0FF):** Reserved for primary actions (Start, Deploy) and active AI processing states.
    - **Lime Green (#ADFF2F):** Reserved for system health, success confirmations, and "Ready" indicators.
- **Contrast:** Typography must never dip below #E0E0E0 to maintain readability against the dark backgrounds.

## Typography

This design system uses a dual-font strategy to balance technical precision with readability. 

**Space Grotesk** is used for headlines and labels to provide a geometric, futuristic edge. Use uppercase styling for labels to evoke a "terminal" feel. 
**Manrope** handles all long-form AI responses and body text, chosen for its balanced proportions and excellent legibility at small sizes. 

Maintain high contrast: use pure white (#FFFFFF) for headlines and off-white (#E0E0E0) for body text to reduce eye strain while preserving sharpness.

## Layout & Spacing

The layout follows a **Fixed Grid** model for the central console to ensure code blocks and AI chat threads remain at an optimal reading width (max-width 960px), while sidebar utilities are pinned to the edges.

A 4px baseline rhythm governs all internal spacing. Elements are grouped using generous "breathing room" to maintain the restrained, premium feel. Use `stack-lg` to separate distinct logical sections of the AI workflow, and `stack-sm` for related metadata.

## Elevation & Depth

Depth is conveyed through **Glassmorphism** and light-based hierarchy rather than traditional shadows.

- **The Base:** The lowest level is a solid #050505.
- **Glass Layers:** Floating panels use a 60% opacity fill of #121214 with a `backdrop-filter: blur(20px)`. 
- **The Glow:** Instead of drop shadows, active elements or focused cards utilize a 1px inner border (stroke) with a 5% primary color opacity and a very soft 4px outer "bloom" of the primary accent color.
- **Tonal Layering:** Use increasingly lighter shades of charcoal to indicate stacking, rather than increasing shadow size.

## Shapes

The shape language is "Soft" (0.25rem - 0.75rem) to maintain a professional, architectural feel. 

- **Standard Elements:** Buttons and input fields use a 4px (0.25rem) radius for a sharp, technical look.
- **Containers:** Main console cards and modal windows use an 8px (0.5rem) radius to soften the overall composition.
- **Exceptions:** Status pips and user avatars are the only elements permitted to be fully circular.

## Components

- **Buttons:** Primary buttons use a ghost style with a 1px electric cyan border and a subtle cyan outer glow. Text is always uppercase Space Grotesk. Secondary buttons are charcoal with white text.
- **Input Fields:** Dark charcoal backgrounds (#0A0A0B) with a 1px slate border. On focus, the border transitions to cyan with a soft 2px bloom.
- **Cards:** Defined by a 1px semi-transparent slate border. No solid background unless they are "floating" over other content, in which case they adopt the glassmorphic blur.
- **Status Indicators:** Small 8px circles. Use Lime Green for "System Online" or "Task Complete." Use Electric Cyan for "AI Thinking" or "Processing."
- **Scrollbars:** Custom slim-line scrollbars in slate gray, appearing only on hover to maintain the clean aesthetic.
- **Code Blocks:** Deep black background with a 1px border. Syntax highlighting should use a monochromatic slate palette with cyan for key variables.