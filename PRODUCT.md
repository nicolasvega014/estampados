# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fenixis Store is a clothing shop run by the owner's sister. Buyers browse garments and pay online; the seller manages the catalog and orders, including from a phone.

## Product Purpose

Sell the available clothing catalog at fenixis.com.ar. The owner explicitly requested a transition from print customization to a normal clothing shop because the printer is currently unavailable.

## Capabilities and Constraints

- Categories, garment types, sizes, colors, custom colors, prices, photographs and product visibility are managed from the seller panel.
- Each garment can have letter sizes, numerical sizes or seller-defined size labels. Only marked sizes are offered to buyers.
- The homepage product carousel displays the visible catalog, advancing one garment automatically after a reading pause and reversing at each end. Manual arrows, touch scrolling, keyboard navigation and a pause/resume control remain available. Autoplay pauses during interaction, outside the viewport, in a hidden tab and while store overlays are open; reduced motion disables autoplay. The factual announcement strip uses a pausable continuous marquee.
- Search and filters help buyers find garments. The cart supports selected sizes/colors, quantities and promotional codes.
- Payments use the existing Mercado Pago integration. Customers provide email and phone and choose pickup or delivery.
- Pickup is at Bogotá 5191, Ezpeleta, without a surcharge. Shipping defaults to ARS 7,500 for Correo Argentino branch collection or ARS 11,500 for home delivery; it is paid with the garments and coordinated after purchase.
- The seller's Entrega y envíos section edits the pickup address/optional hours, shipping rates and coordination instructions. New orders and confirmation emails retain the accepted delivery details. Coupons discount garments, not shipping.
- Coupons, order details, fulfillment states and confirmation notifications are existing capabilities to preserve.
- Products have an optional percentage discount (0–99) managed in the admin form; the server, catalog, cart and inventory use the same final price. The normal price is struck through only when discounted.
- Admin Pagos edits transfer availability, alias, account holder, receipt WhatsApp, the transfer discount and advertised interest-free installments/minimum. Initial transfer details supplied by the owner: alias fenixis, holder Maximiliano Hinojosa, 20% transfer discount; reuse the existing store WhatsApp. Three interest-free installments are requested but remain hidden until the seller confirms they are enabled in Mercado Pago.
- A transfer creates a pending order with reserved inventory, bank details and totals captured at checkout. The customer sends the receipt via WhatsApp; only a verified admin can confirm actual accreditation. Pending orders retain stock until confirmed/cancelled; interrupted creations are cleaned up automatically. Pending and paid email notifications are distinct.
- Transfer discounts apply to the product sale price and exclude shipping. Additional transfer discounts do not stack with coupons. Advertising installments requires admin confirmation that the exact terms are enabled for Checkout in Mercado Pago; changing the site setting does not configure financing at the provider.
- New customization orders are unavailable. Hide the editor and design management; redirect its old URL to the catalog. Preserve historical orders and their design details, as well as stored design/settings data.
- Use real available product data. Do not invent discounts, shipping promises, stock, customer counts or testimonials.
- Existing Google verification and search metadata must remain valid.

## Brand Commitments

Fenixis Store name and supplied transparent wordmark; Spanish with Argentine voseo. The owner requested a more attractive overall appearance and a rebuilt homepage for this clothing-only stage.

## Evidence on Hand

Existing photographs in public/products, public/brand/fenixis-logo-navbar.png, public/products/catalog.json, and the live Firestore catalog and store settings. Some seller-created products may have no image; use a neutral placeholder without inventing photography.

## Operating Context

Existing React/Vite application, Firebase catalog/authentication, Netlify hosting, Cloudinary media and Mercado Pago payments. Preserve the current services and credentials.
