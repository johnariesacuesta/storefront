const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const grid = document.querySelector("#product-grid");
const cartItems = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const drawerCount = document.querySelector("#drawer-count");
const cartTotal = document.querySelector("#cart-total");
const form = document.querySelector("#checkout-form");
const formMessage = document.querySelector("#form-message");
const checkoutButton = document.querySelector("#checkout-button");
const toast = document.querySelector("#toast");
const productCount = document.querySelector("#product-count");
const cart = new Map();
let products = [];
let toastTimer;

function formatPrice(cents) {
  return currency.format(cents / 100);
}

function renderProducts() {
  productCount.textContent = `${products.length} thoughtful finds`;
  grid.innerHTML = products.map((product) => `
    <article class="product-card">
      <div class="product-art" style="background:${product.color}">
        <span class="product-badge">${product.badge}</span>
        <span class="product-icon" aria-hidden="true">${product.icon}</span>
        <button class="quick-add" type="button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button>
      </div>
      <div class="product-info"><h3>${product.name}</h3><strong>${formatPrice(product.price)}</strong></div>
      <p class="product-description">${product.description}</p>
    </article>
  `).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function updateCart() {
  const totalItems = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  const totalPrice = [...cart.entries()].reduce((sum, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return sum + (product ? product.price * quantity : 0);
  }, 0);

  cartCount.textContent = totalItems;
  drawerCount.textContent = totalItems ? `(${totalItems})` : "";
  cartTotal.textContent = formatPrice(totalPrice);

  if (cart.size === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your bag is taking a little breather. Add something lovely.</p>';
  } else {
    cartItems.innerHTML = [...cart.entries()].map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      if (!product) return "";
      return `
        <article class="cart-line">
          <div class="cart-thumb" style="background:${product.color}" aria-hidden="true">${product.icon}</div>
          <div>
            <h3>${product.name}</h3>
            <span class="cart-line-price">${formatPrice(product.price)}</span>
            <div class="quantity-control" aria-label="Quantity for ${product.name}">
              <button type="button" data-change="-1" data-id="${id}" aria-label="Remove one ${product.name}">−</button>
              <span>${quantity}</span>
              <button type="button" data-change="1" data-id="${id}" aria-label="Add one ${product.name}">+</button>
            </div>
          </div>
          <button class="remove-item" type="button" data-remove="${id}" aria-label="Remove ${product.name}">×</button>
        </article>
      `;
    }).join("");
  }
  checkoutButton.disabled = cart.size === 0;
}

function setCartOpen(isOpen) {
  document.body.classList.toggle("cart-open", isOpen);
  document.querySelector("#cart-drawer").setAttribute("aria-hidden", String(!isOpen));
  if (isOpen) document.querySelector("#customer-name").focus();
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Products could not be loaded.");
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error("The product list is unavailable.");
    products = data.products;
    renderProducts();
    updateCart();
  } catch (error) {
    grid.innerHTML = `<p class="error-message">${error.message} Please refresh to try again.</p>`;
    productCount.textContent = "Please try again";
  }
}

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.add);
  if (!product) return;
  cart.set(product.id, Math.min(20, (cart.get(product.id) || 0) + 1));
  updateCart();
  showToast(`${product.name} added to your bag`);
});

cartItems.addEventListener("click", (event) => {
  const changeButton = event.target.closest("[data-change]");
  const removeButton = event.target.closest("[data-remove]");
  if (changeButton) {
    const id = changeButton.dataset.id;
    const nextQuantity = (cart.get(id) || 0) + Number(changeButton.dataset.change);
    if (nextQuantity < 1) cart.delete(id);
    else cart.set(id, Math.min(20, nextQuantity));
  } else if (removeButton) {
    cart.delete(removeButton.dataset.remove);
  }
  updateCart();
});

document.querySelector("#cart-open").addEventListener("click", () => setCartOpen(true));
document.querySelector("#cart-close").addEventListener("click", () => setCartOpen(false));
document.querySelector("#drawer-backdrop").addEventListener("click", () => setCartOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setCartOpen(false);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.classList.remove("success");
  if (!cart.size) return;

  checkoutButton.disabled = true;
  checkoutButton.textContent = "Placing your order…";
  const formData = new FormData(form);
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        items: [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity }))
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your order could not be placed.");

    cart.clear();
    form.reset();
    updateCart();
    formMessage.textContent = `Thank you! Order ${result.order.id} is confirmed.`;
    formMessage.classList.add("success");
  } catch (error) {
    formMessage.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    checkoutButton.textContent = "Place your order ↗";
    checkoutButton.disabled = cart.size === 0;
  }
});

loadProducts();
