---
name: "Fenixis Store"
description: "Implemented visual system for the clothing storefront and seller area."
colors:
  wine: "#783d49"
  wine-hover: "#60303b"
  ink: "#29241f"
  paper: "#faf7f2"
  surface: "#fffdfa"
  warm-panel: "#eee6df"
  photo-ground: "#eee8e1"
  muted: "#70645b"
  line: "#ddd4ca"
  field-line: "#c9bcb1"
  accent-line: "#b88791"
  selected-surface: "#eee0e0"
  selected-ink: "#65323e"
  focus: "#a85f70"
  white: "#fff"
  payment: "#007caf"
  payment-hover: "#00618b"
typography:
  display:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "clamp(52px, 5.8vw, 84px)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-.04em"
  headline:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "clamp(32px, 3.1vw, 46px)"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-.035em"
  emphasis:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontWeight: 500
  title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-.02em"
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "12px"
    fontWeight: 500
  action:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
    fontWeight: 600
rounded:
  compact: "6px"
  control: "7px"
  small-panel: "8px"
  photo: "12px"
  panel: "14px"
  dialog: "16px"
  pill: "30px"
  circle: "50%"
spacing:
  tight: "8px"
  compact: "12px"
  regular: "16px"
  gutter-mobile: "20px"
  comfortable: "24px"
  group: "32px"
  section-mobile: "48px"
  gutter-desktop: "50px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.wine-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.wine}"
    rounded: "{rounded.compact}"
    padding: "8px 12px"
  button-outline-hover:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.white}"
  button-payment:
    backgroundColor: "{colors.payment}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
  button-payment-hover:
    backgroundColor: "{colors.payment-hover}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 40px 12px 45px"
    height: "50px"
  navigation:
    backgroundColor: "{colors.ink}"
    textColor: "#ede1d8"
  category-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
  product-photo:
    backgroundColor: "{colors.photo-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.photo}"
  option-selected:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.white}"
    rounded: "{rounded.compact}"
    padding: "10px 14px"
---

# Design System: Fenixis Store

## Overview

**Creative North Star: "A warm clothing storefront"**

Fenixis Store uses a warm, photo-led clothing storefront: pale ivory surfaces, brown-black typography and a restrained wine accent. Large plain-language headings pair a clean sans serif with italic serif emphasis, while real garment photographs carry the visual character.

The seller area uses the same palette in a denser working layout. This document records the implemented interface, rather than introducing a new brand promise or merchandising policy.

**Key Characteristics:**

- Warm ivory canvas with dark header and footer.
- DM Sans hierarchy with selective Playfair Display italic emphasis.
- Real garment photography in portrait frames.
- Flat surfaces, fine borders and gently rounded controls.
- Responsive browsing and readable mobile forms.

## Colors

Wine supplies the main action color; ivory, warm neutrals and brown-black make the garment photographs easy to scan. The frontmatter is the normative token list.

### Primary

- **Wine:** store calls to action, add controls, selected product options and seller actions.
- **Wine hover:** the deeper storefront button state. Seller buttons have a closely related existing hover shade.
- **Accent line and focus:** outlined actions and visible keyboard focus.

### Secondary

- **Payment blue:** the existing Mercado Pago checkout action only; its darker variant is the hover state.

### Neutral

- **Paper:** the storefront canvas and cart/dialog surfaces.
- **Surface:** search/select controls, category pills and the cart footer.
- **Warm panel:** help content, quiet notices and empty-state surfaces.
- **Photo ground:** garment frames and their neutral fallback.
- **Ink:** primary text, header and footer.
- **Muted:** descriptions, product metadata and secondary instructions.
- **Line and field line:** section dividers and control outlines.
- **Selected surface and selected ink:** the active catalog type filter.
- **White:** text on strong action fills.

## Typography

**Display and body:** DM Sans. **Emphasis:** Playfair Display with a Georgia/serif fallback.

DM Sans carries navigation, garment details, forms and major headings. Playfair Display appears as italic emphasis inside display copy and selected supporting phrases, not as a replacement for functional UI labels. The legacy admin order metadata also retains small DM Mono text.

- **Display:** responsive homepage headline; preserve its compact tracking and generous scale.
- **Headline:** section titles and supporting storefront headings.
- **Emphasis:** inherits the surrounding size and uses italic styling.
- **Title:** garment names, with a smaller mobile treatment.
- **Body:** supporting text and product descriptions; larger introductory paragraphs use looser leading.
- **Label/action:** compact controls and form labels. Prices and counts use tabular numerals.

The catalog title has its own observed scale, and small-screen typography is deliberately resized rather than scaled uniformly.

## Layout

The storefront main container is centered with a maximum width of 1440px and 50px desktop side padding. The homepage opens with two unequal columns: copy beside a pair of offset portrait photographs. Product photography uses a 4:5 frame with `object-fit: cover`.

Featured products use four columns on desktop. The catalog places a 190px filter column beside a three-column product grid. The intermediate layout adapts at 1100px; the primary mobile breakpoint is 760px. Mobile uses 20px page gutters, a stacked hero, two product columns, full-width search, a menu toggle and collapsible filters.

The seller workspace uses a 228px side navigation and a flexible content area. Its form grids simplify at 1050px and stack at 760px; navigation becomes horizontally scrollable on phones. Mobile form text is 16px.

Spacing ranges from compact metadata gaps to broad section separation. Preserve hierarchy by using the existing spacing roles instead of giving every component identical padding. The cart is at most 540px wide, scrolls as one surface and keeps its dark header sticky. Product options fit within the viewport and allow internal scrolling.

## Elevation & Depth

Most store and seller surfaces are flat. Color changes, thin outlines and image crops define groups. Product cards have no enclosing shadow; photography and information remain separate. Shadows are structural exceptions for overlays and the expanded mobile menu.

The existing cart drawer casts a leftward shadow (`-16px 0 45px rgba(0,0,0,.12)`). The expanded mobile navigation uses a small downward shadow (`0 14px 22px #29241f22`). The seller order drawer retains its own structural shadow. Full values and motion extensions are in the sidecar.

## Shapes

Controls use modest rounded corners; portrait photographs have softer corners, with larger rounding on panels and the product dialog. Category links and the cart trigger use pill outlines. Color swatches and several close controls are circular. Fine borders distinguish controls from the warm canvas.

## Components

### Buttons

The primary storefront action is a wine fill with white text, moderate rounding and a 50px minimum height. Hover deepens the fill and moves it upward by 2px. Outlined add controls fill with wine on hover. Payment keeps its established blue identity. Seller actions use the same wine family without hover movement.

Disabled storefront buttons reduce opacity and show an unavailable cursor. Focus is visibly outlined; storefront controls use a 3px outline with 4px offset, while seller controls use a 2px wine outline with 3px offset.

### Chips and product options

Category navigation uses outlined ivory pills with an arrow. Catalog filters use a pale selected background and darker wine text. Size/color selection controls use a solid wine selected state. Do not confuse garment color swatches with interface accent colors.

### Cards and photography

Garment cards lead with actual catalog photography in portrait frames, followed by type/collection, title, available variants, price and an explicit add action. Hover gently enlarges the image; the supplementary photo action also appears on keyboard focus. Mobile hides this overlay while keeping the explicit add control.

Missing photographs use the implemented neutral Fenixis placeholder. Seller cards use bordered white surfaces with rounded corners and compact actions.

### Inputs and fields

Search and selects use light warm surfaces, fine warm-gray borders and dark text. Search has a leading icon. Placeholders remain readable; labels stay visible above fields. Cart and mobile form text is large enough for comfortable entry. Product dialogs keep the title and close action inside the padded surface.

### Navigation

The dark header displays the supplied wordmark, plain-language navigation, search and a cart count. The active link uses a pale underline. On mobile, the menu expands beneath the header and the cart remains immediately accessible. The footer repeats the dark grounding surface with clear contact and store links.

### Motion and accessible states

Button state transitions are short; photo zooms are slower and subtle. The hero photograph group has a single reveal when reduced motion is not requested. Reduced-motion mode disables storefront animation, transitions and smooth scrolling. Sidecar snippets show implemented focus and hover behavior; they are visual samples, not a replacement for application interaction logic.

## Do's and Don'ts

### Do:

- **Do** reuse the supplied Fenixis wordmark and actual catalog photographs.
- **Do** keep garment names, prices, sizes and colors readable outside the photograph.
- **Do** use the wine accent for store actions and selected options; reserve payment blue for checkout.
- **Do** keep keyboard focus visible and honor reduced-motion preferences.
- **Do** use a neutral branded placeholder when a catalog photograph is missing.

### Don't:

- **Don't** fabricate photographs, stock claims, discounts, testimonials or delivery promises.
- **Don't** require hover to discover the product title, price or add action.
- **Don't** replace the supplied wordmark with a text approximation.
- **Don't** introduce customization controls into new clothing orders.
