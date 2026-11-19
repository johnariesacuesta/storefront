const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const ORDERS_FILE = path.join(ROOT, "data", "orders.jsonl");

const products = [
  {
    id: "ceramic-mug",
    name: "Everyday Ceramic Mug",
    category: "Kitchen",
    description: "A comfortable, handmade-feel mug for your morning ritual.",
    price: 2400,
    color: "#e9c9b2",
    icon: "☕",
    badge: "Bestseller"
  },
  {
    id: "linen-throw",
    name: "Soft Linen Throw",
    category: "Living",
    description: "Lightweight, breathable texture for slow afternoons.",
    price: 6800,
    color: "#d9dfd0",
    icon: "🧶",
    badge: "Natural linen"
  },
  {
    id: "glass-vase",
    name: "Sculpted Glass Vase",
    category: "Living",
    description: "A softly sculptural shape, lovely with or without flowers.",
    price: 4200,
    color: "#d5e0dc",
    icon: "🌷",
    badge: "Small-batch"
  },
  {
    id: "soy-candle",
    name: "Quiet Morning Candle",
    category: "Wellness",
    description: "A gentle blend of cedar, citrus, and warm amber.",
    price: 3200,
    color: "#eadfbd",
    icon: "🕯️",
    badge: "Plant-based"
  },
  {
    id: "wood-tray",
    name: "Oak Catchall Tray",
    category: "Living",
    description: "A tidy little landing place for keys and everyday things.",
    price: 3600,
    color: "#dfc7a8",
    icon: "🪵",
    badge: "Made to last"
  },
  {
    id: "cotton-towels",
    name: "Waffle Cotton Towels",
    category: "Bath",
    description: "A soft, quick-drying pair woven from pure cotton.",
    price: 5200,
    color: "#d8dce8",
    icon: "🫧",
    badge: "2-piece set"
  }
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (body.length > 16_384) {
        settled = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        body = "";
      }
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function validateOrder(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Please provide your contact details and cart." };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (name.length < 2 || name.length > 100) {
    return { error: "Name must be between 2 and 100 characters." };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 10) {
    return { error: "Your cart must contain between 1 and 10 different items." };
  }

  const items = [];
  const seen = new Set();
  for (const item of body.items) {
    const product = products.find((entry) => entry.id === item?.productId);
    const quantity = item?.quantity;
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return { error: "One or more cart items are invalid." };
    }
    if (seen.has(product.id)) {
      return { error: "Duplicate cart items are not allowed." };
    }
    seen.add(product.id);
    items.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price
    });
  }

  return {
    order: {
      id: `NS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      name,
      email,
      items,
      total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      createdAt: new Date().toISOString()
    }
  };
}

async function serveStatic(pathname, method, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL path." });
    return;
  }
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const content = await fs.promises.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": content.length,
      "X-Content-Type-Options": "nosniff"
    });
    response.end(method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Page not found." });
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api/products" && request.method === "GET") {
      sendJson(response, 200, { products });
      return;
    }

    if (url.pathname === "/api/orders" && request.method === "POST") {
      let body;
      try {
        body = await readJson(request);
      } catch (error) {
        if (error.status) {
          sendJson(response, error.status, { error: error.message });
          return;
        }
        throw error;
      }
      const result = validateOrder(body);
      if (result.error) {
        sendJson(response, 400, { error: result.error });
        return;
      }

      await fs.promises.mkdir(path.dirname(ORDERS_FILE), { recursive: true });
      await fs.promises.appendFile(ORDERS_FILE, `${JSON.stringify(result.order)}\n`, "utf8");
      sendJson(response, 201, { order: result.order });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "API endpoint not found." });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(url.pathname, request.method, response);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Something went wrong. Please try again." });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Northstar Storefront is running at http://localhost:${PORT}`);
});
