---
name: "Fenixis Store"
description: "Shared homepage and catalog style; preserved checkout and seller visual system."
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
  home-line: "#e9e3dd"
  home-footer: "#f5f0eb"
  home-hover: "#f5eeea"
  home-announcement-ink: "#513b36"
  home-category-ink: "#51463e"
  home-footer-ink: "#5e5148"
  home-placeholder-ink: "#a19184"
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
  home-display:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "clamp(30px, 3.4vw, 48px)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-.035em"
  home-display-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "31px"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-.03em"
  home-headline:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "clamp(26px, 2.2vw, 34px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.025em"
  home-headline-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-.025em"
  home-title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  home-title-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  home-navigation:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
  home-label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "12px"
  home-small-label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "10px"
  home-announcement-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "11px"
  home-action:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    fontWeight: 600
  home-price:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "16px"
  home-price-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "15px"
  home-category-title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "18px"
  home-category-title-mobile:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "15px"
  home-info-title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "17px"
    fontWeight: 500
    letterSpacing: "0"
  home-info-body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "13px"
    lineHeight: 1.7
  home-footer-body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
rounded:
  home-photo: "0"
  home-control: "3px"
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
  home-gutter-desktop: "40px"
  home-gutter-intermediate: "28px"
  home-gutter-mobile: "18px"
  home-card-gap: "20px"
  home-card-gap-mobile: "14px"
  home-section: "64px"
  home-section-mobile: "38px"
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
  home-button-primary:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.home-control}"
    padding: "12px 22px"
  home-button-primary-mobile:
    typography: "{typography.home-action}"
  home-button-add:
    backgroundColor: "{colors.white}"
    textColor: "{colors.wine}"
    rounded: "{rounded.home-control}"
    padding: "8px 12px"
    width: "100%"
  home-button-all:
    textColor: "{colors.wine}"
    typography: "{typography.home-action}"
    rounded: "{rounded.home-control}"
    padding: "12px 26px"
  home-carousel-control:
    backgroundColor: "{colors.white}"
    textColor: "{colors.wine}"
    rounded: "{rounded.home-control}"
    size: "40px"
  home-carousel-control-mobile:
    size: "44px"
  home-navigation:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.home-navigation}"
  home-product-photo:
    backgroundColor: "{colors.photo-ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.home-photo}"
  home-campaign-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "25px 36px"
  home-campaign-copy-mobile:
    backgroundColor: "{colors.paper}"
    padding: "26px 18px 28px"
  home-footer:
    backgroundColor: "{colors.home-footer}"
    textColor: "{colors.ink}"
---

# Design System: Fenixis Store

## Overview

**Creative North Star: "A warm clothing storefront"**

Fenixis Store uses a warm, photo-led clothing storefront: white and pale ivory surfaces, brown-black typography and a restrained wine accent. The homepage and catalog use the supplied centered wordmark, compact DM Sans text, white headers and rectangular garment photography.

The seller area uses the same palette in a denser working layout. The shared `fashion-boutique` theme applies to `/` and `/productos/`; campaign and carousel layout remain specific to the homepage. Checkout and seller styles retain their established scope. This document records the implemented interface, rather than introducing a new brand promise or merchandising policy.

**Key Characteristics:**

- White homepage and catalog canvas and headers with a light warm footer.
- Compact DM Sans hierarchy in both storefront routes; legacy serif styling is retained only in other existing surfaces.
- Real garment photography in portrait frames.
- Flat surfaces and fine borders; rectangular homepage photos and minimally rounded controls.
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

- **Paper:** the catalog canvas, homepage supporting panels and incumbent cart/dialog surfaces; the home shell overrides its local paper property with white.
- **Surface:** search/select controls, category pills and the cart footer.
- **Warm panel:** help content, quiet notices and empty-state surfaces.
- **Photo ground:** garment frames and their neutral fallback.
- **Ink:** primary text and the homepage wordmark; dark header/footer backgrounds remain catalog-specific.
- **Muted:** descriptions, product metadata and secondary instructions.
- **Line and field line:** section dividers and control outlines.
- **Selected surface and selected ink:** the active catalog type filter.
- **White:** text on strong action fills, plus the homepage canvas, header and outlined controls.
- **Home line:** quiet homepage header, category and section dividers.
- **Home footer and home hover:** the light homepage footer and cart-hover/scrollbar ground.
- **Home announcement, category and footer ink:** compact homepage text on the corresponding light surfaces.
- **Home placeholder ink:** the supplied wordmark mask in the empty campaign fallback.

### Named Rules

**The Route Scope Rule.** White headers, compact type and minimally rounded controls are shared by the homepage and catalog. Keep campaign layouts, administration and checkout styles separately scoped.

## Typography

**Display and body:** DM Sans. **Emphasis:** Playfair Display with a Georgia/serif fallback.

DM Sans carries navigation, garment details, forms and major headings. The homepage uses DM Sans throughout its campaign, shopping information and footer. The catalog uses the same sans-serif hierarchy; Playfair Display remains only in selected legacy supporting phrases, not as a replacement for functional UI labels. The legacy admin order metadata also retains small DM Mono text.

- **Display/headline:** preserved base stylesheet scales. The former offset homepage hero is no longer rendered at `/`; current home headings use the explicit home display/headline roles.
- **Emphasis:** inherits the surrounding size and uses italic styling.
- **Title:** garment names, with a smaller mobile treatment.
- **Body:** supporting text and product descriptions; larger introductory paragraphs use looser leading.
- **Label/action:** compact controls and form labels. Prices and counts use tabular numerals.

The catalog title has its own observed scale, and small-screen typography is deliberately resized rather than scaled uniformly.

Homepage roles are intentionally compact: the campaign and centered section titles use the responsive home display/headline scales; product titles use the home title roles. Product prices use the home price roles, previous prices and transfer text use the navigation size, and transfer text switches to the label size on mobile. Category tiles and shopping information have their own title roles. Campaign labels and discount flags use the label role on desktop and small-label role on mobile; only the announcement uses its 11px mobile role. The footer introduction is normal sans serif. These scoped sizes are deliberate; they do not replace the catalog type ramp.

## Layout

The homepage container is centered with a maximum width of 1680px and the home gutter roles. Its campaign cancels those side gutters: two equal photo columns, a 6px separation, a 400px minimum height and a height capped by `min(680px, 70vw)`. Photos use `object-fit: cover` and a 50%/42% crop. A centered, warm copy panel overlays the bottom of the photographs; the former unequal, offset hero is not the current homepage layout. Product photography retains a 4:5 frame.

The homepage header has a 98px identity row and a 48px centered navigation row. Search sits left, the supplied wordmark is centered, and the cart sits right. A horizontally scrollable garment-type row follows the campaign. Product carousels show four cards on desktop, three at 1100px and two at 760px, using the home card-gap roles. Category tiles use up to four real catalog photographs in 4:4.3 frames; their grid becomes two columns at 1100px. Shopping information uses three columns.

At 760px the homepage header becomes one 88px row with a menu toggle, search, centered logo and cart. The campaign keeps two photo columns with a 3px gap, uses `92vw` height capped at 470px, and moves the copy below the photographs onto paper. Photo crops shift to 50%/35%. The product carousels remain horizontally scrollable with two visible cards; shopping information stacks. Homepage content uses 18px gutters, distinct from the catalog's 20px gutters.

The catalog shares the centered 1680px storefront container and 40px desktop gutters. A 190px filter column sits beside four product columns from 1400px, three down to 1101px, and two at 1100px and below. Mobile uses full-width search, a menu toggle and collapsible filters, retaining two product columns.

The seller workspace uses a 228px side navigation and a flexible content area. Its form grids simplify at 1050px and stack at 760px; navigation becomes horizontally scrollable on phones. Mobile form text is 16px.

Spacing ranges from compact metadata gaps to broad section separation. Preserve hierarchy by using the existing spacing roles instead of giving every component identical padding. The cart is at most 540px wide, scrolls as one surface and keeps its dark header sticky. Product options fit within the viewport and allow internal scrolling.

## Elevation & Depth

Most store and seller surfaces are flat. Color changes, thin outlines and image crops define groups. Product cards and homepage campaign panels have no enclosing shadow; photography and information remain separate. Shadows are structural exceptions for overlays, expanded mobile menus and the floating homepage help action.

The existing cart drawer casts a leftward shadow (`-16px 0 45px rgba(0,0,0,.12)`). The shared white mobile navigation uses `0 12px 20px #29241f18` on both storefront routes. The homepage help action uses `0 5px 16px #29241f26`. The seller order drawer retains its own structural shadow. Full values and motion extensions are in the sidecar.

## Shapes

The homepage uses square photographic frames and copy panels, with the home control radius on its campaign action, add controls, carousel arrows, all-products link and promotion panels. Its garment-type navigation is plain text; its cart trigger has no visible border. These shapes are scoped to `/`.

The incumbent catalog and seller controls keep modest rounded corners; catalog portrait photographs have softer corners, with larger rounding on panels and the product dialog. The retained category-pill primitive and catalog cart trigger use pill outlines. Color swatches, several close controls and the floating homepage help action are circular. Fine borders distinguish controls from the warm canvas.

## Components

### Buttons

The primary storefront action is a wine fill with white text, moderate rounding and a 50px minimum height. Hover deepens the fill and moves it upward by 2px. Outlined add controls fill with wine on hover. Payment keeps its established blue identity. Seller actions use the same wine family without hover movement.

The homepage campaign action overrides that base with the home radius/padding and a 46px minimum height (45px on mobile). Homepage add controls are full-width with a 44px minimum height. The all-products link has a 46px minimum height. Carousel arrows are 40px squares on desktop and at least 44px squares on mobile; disabled arrows retain the inherited reduced-opacity treatment.

Disabled storefront buttons reduce opacity and show an unavailable cursor. Focus is visibly outlined; storefront controls use a 3px outline with 4px offset, while seller controls use a 2px wine outline with 3px offset.

### Chips and product options

The retained category primitive uses outlined ivory pills with an arrow; the current homepage instead uses horizontally scrollable text links with a wine all-products link and underlined hover state. Catalog filters use a pale selected background and darker wine text. Size/color selection controls use a solid wine selected state. Do not confuse garment color swatches with interface accent colors.

### Cards and photography

Garment cards lead with actual catalog photography in portrait frames, followed by title, available variants, price and an explicit add action. The catalog also shows type/collection; the home hides that metadata, stacks price above a full-width add action, and places genuine discount flags on the photograph. Hover gently enlarges the image; the supplementary photo action also appears on keyboard focus. Mobile hides this overlay while keeping the explicit add control.

Missing photographs use the implemented neutral Fenixis placeholder. Seller cards use bordered white surfaces with rounded corners and compact actions.

Homepage campaign and category photography comes from visible, in-stock catalog entries. A one-photo campaign expands to one column; no-photo state uses the supplied wordmark mask on a neutral ground. Category tiles appear only when more than one photographed type is available. The sale carousel is conditional on actual product discounts. Existing seller promotions and configured payment/delivery information determine the remaining home content; no invented commercial claims or reference-site assets belong in these components.

### Product carousel

The homepage collection and conditional sale row use the same Motion-powered carousel. After a 4.2s reading pause, it advances one garment in .85s with a smooth deceleration; at either end it reverses direction without jumping back across the catalog. Visible-range status, disabled boundary arrows, horizontal touch scrolling and scroll snapping accompany keyboard Left/Right/Home/End controls. Each arrow advances a visible page in .55s. A matching pause/resume button sits before the arrows. Mouse hover pauses temporarily; manual navigation, focus on garments and touch/wheel interaction pause until explicitly resumed. Titles, variants, normal/sale prices, transfer savings and explicit add actions remain outside the photo. Automatic movement is not announced through a live region.

### Inputs and fields

Search and selects use light warm surfaces, fine warm-gray borders and dark text. Search has a leading icon. Placeholders remain readable; labels stay visible above fields. Cart and mobile form text is large enough for comfortable entry. Product dialogs keep the title and close action inside the padded surface.

The seller's Franja superior form uses a static pale preview, numbered message fields with character counts, outlined add controls and the shared wine save action. Editing or adding messages switches to custom copy; restoring automatic copy follows the current payment settings. Its visibility toggle hides the strip on both storefront routes without discarding the saved text.

### Navigation

The homepage header is white with the supplied wordmark rendered in ink, plain-language centered navigation, search and a wine cart count. Its active link uses wine text and underline. On mobile, the white menu expands beneath the header and the cart remains accessible. The light warm footer uses dark headings, muted links and sans-serif supporting copy. A circular wine WhatsApp action floats above the bottom edge.

The catalog uses the same white header, centered wordmark, wine active-link underline, search, cart count and warm footer as the homepage. Its mobile menu expands beneath the header. The same editable announcement messages appear on both routes.

### Motion and accessible states

Button state transitions are short; photo zooms are slower and subtle. The homepage campaign image hover uses a .65s eased transition and a 1.025 scale; category images use .4s and the same scale. The former hero-reveal declaration remains in the base stylesheet but does not animate the new home campaign. The shared 44px announcement strip repeats seller-edited messages or automatic payment and delivery messages in a seamless 32px/s Motion marquee, with a 44px pause/resume control. Repeated visual text is hidden from assistive technology; a single readable summary remains. Both automatic sequences stop offscreen, in hidden tabs and while the cart, product dialog or menu is open. Reduced-motion mode shows a static wrapping announcement and leaves carousel navigation immediate and manual. Sidecar snippets show implemented focus and hover behavior; they are visual samples, not a replacement for application interaction logic.

## Do's and Don'ts

### Do:

- **Do** reuse the supplied Fenixis wordmark and actual catalog photographs.
- **Do** keep garment names, prices, sizes and colors readable outside the photograph.
- **Do** use the wine accent for store actions and selected options; reserve payment blue for checkout.
- **Do** keep keyboard focus visible and honor reduced-motion preferences.
- **Do** use a neutral branded placeholder when a catalog photograph is missing.
- **Do** share the boutique style between the homepage and catalog while preserving administration and checkout styles.
- **Do** use existing Fenixis catalog photography; the reference informs layout only.

### Don't:

- **Don't** fabricate photographs, stock claims, discounts, testimonials or delivery promises.
- **Don't** require hover to discover the product title, price or add action.
- **Don't** replace the supplied wordmark with a text approximation.
- **Don't** introduce customization controls into new clothing orders.
- **Don't** reuse the former offset hero, dark chrome or rounded-photo rules as the current homepage specification.
