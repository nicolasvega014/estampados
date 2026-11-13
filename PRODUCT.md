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
- Search and filters help buyers find garments. The cart supports selected sizes/colors, quantities and promotional codes.
- Payments use the existing Mercado Pago integration. Customers provide email and phone and choose pickup or delivery.
- Coupons, order details, fulfillment states and confirmation notifications are existing capabilities to preserve.
- New customization orders are unavailable. Hide the editor and design management; redirect its old URL to the catalog. Preserve historical orders and their design details, as well as stored design/settings data.
- Use real available product data. Do not invent discounts, shipping promises, stock, customer counts or testimonials.
- Existing Google verification and search metadata must remain valid.

## Brand Commitments

Fenixis Store name and supplied transparent wordmark; Spanish with Argentine voseo. The owner requested a more attractive overall appearance and a rebuilt homepage for this clothing-only stage.

## Evidence on Hand

Existing photographs in public/products, public/brand/fenixis-logo-navbar.png, public/products/catalog.json, and the live Firestore catalog and store settings. Some seller-created products may have no image; use a neutral placeholder without inventing photography.

## Operating Context

Existing React/Vite application, Firebase catalog/authentication, Netlify hosting, Cloudinary media and Mercado Pago payments. Preserve the current services and credentials.
