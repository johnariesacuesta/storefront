# Northstar Storefront

A small full-stack storefront with a responsive frontend and a Node.js backend. It uses only Node.js built-ins, so no dependency installation is needed.

## Run locally

1. Install Node.js 18 or newer.
2. From this folder, run `npm start`.
3. Open [http://localhost:3000](http://localhost:3000).

Set the `PORT` environment variable to use a different port.

## Backend

- `GET /api/products` returns the product catalog.
- `POST /api/orders` validates customer details and cart quantities, calculates prices on the server, and stores each accepted order as a JSON line in `data/orders.jsonl`.

The order file is created the first time an order is placed. This is a demo storefront; connect a payment provider and a production database before accepting real payments.
