/* ==========================================================================
   Lebanon Hockey - cart page
   --------------------------------------------------------------------------
   Quantities, removals, the discount code, and the running total.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="cart"]');
  if (!root) return;

  const { api, money, escapeHtml, toast, cartChanged, qs } = window.LH;
  const { storedDiscount, setStoredDiscount, announcePayments, renderSummary } = window.LHStore;

  function initCart(root) {
    const linesHost = root.querySelector('[data-cart-lines]');
    const summaryHost = root.querySelector('[data-cart-summary]');
    let discount = storedDiscount();

    // Say it here, before anyone is sent to fill in a shipping address.
    announcePayments(root.querySelector('[data-payments-notice]'));

    async function load() {
      try {
        const cart = await api(`/api/cart?discount=${encodeURIComponent(discount)}`);
        render(cart);
      } catch (error) {
        linesHost.innerHTML = `<div class="empty-state"><h2>Could not load your cart</h2><p>${escapeHtml(error.message)}</p></div>`;
      }
    }

    function render(cart) {
      // A code that stopped being valid should not silently linger.
      if (cart.discountError) {
        discount = '';
        setStoredDiscount('');
        toast(cart.discountError, 'error');
      }

      if (!cart.items.length) {
        linesHost.innerHTML = `
          <div class="empty-state">
            <h2>Your cart is empty</h2>
            <p>Browse the official collection and support Lebanese ice hockey.</p>
            <a class="button primary small" href="shop.html">Go to the store</a>
          </div>`;
        if (summaryHost) summaryHost.innerHTML = '';
        cartChanged();
        return;
      }

      linesHost.innerHTML = cart.items
        .map(
          (item) => `
        <article class="cart-line" data-item="${item.id}">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">
          <div>
            <h2><a href="product.html?slug=${encodeURIComponent(item.slug)}" style="text-decoration:none">${escapeHtml(item.name)}</a></h2>
            ${item.variantName ? `<p class="variant">Size ${escapeHtml(item.variantName)}</p>` : ''}
            <p class="unit">${money(item.unitPriceCents, cart.currency)} each</p>
          </div>
          <div class="cart-line-actions">
            <div class="qty-stepper">
              <button type="button" data-qty-step="-1" aria-label="Decrease quantity">-</button>
              <input type="text" inputmode="numeric" value="${item.quantity}" data-qty-input aria-label="Quantity for ${escapeHtml(item.name)}">
              <button type="button" data-qty-step="1" aria-label="Increase quantity">+</button>
            </div>
            <span class="line-total">${money(item.lineTotalCents, cart.currency)}</span>
            <button type="button" class="link-button" data-remove>Remove</button>
          </div>
          ${item.inStock ? '' : '<p class="out-of-stock-note">Not enough stock - reduce the quantity to continue.</p>'}
        </article>`
        )
        .join('');

      if (summaryHost) {
        renderSummary(summaryHost, cart, {
          showDiscount: true,
          actionHtml: `<a class="button primary block" href="checkout.html">Checkout</a>
                       <a class="button ghost block small" href="shop.html">Continue shopping</a>`,
        });
      }

      cartChanged();
    }

    async function update(itemId, quantity) {
      try {
        const cart = await api(`/api/cart/items/${itemId}`, {
          method: 'PATCH',
          body: { quantity, discount },
        });
        render(cart);
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    linesHost?.addEventListener('click', async (event) => {
      const line = event.target.closest('[data-item]');
      if (!line) return;
      const itemId = Number(line.dataset.item);

      if (event.target.closest('[data-remove]')) {
        try {
          const cart = await api(`/api/cart/items/${itemId}`, { method: 'DELETE' });
          render(cart);
          toast('Removed from cart.');
        } catch (error) {
          toast(error.message, 'error');
        }
        return;
      }

      const step = event.target.closest('[data-qty-step]');
      if (step) {
        const input = line.querySelector('[data-qty-input]');
        const next = Math.max(0, Math.min(99, (Number(input.value) || 1) + Number(step.dataset.qtyStep)));
        update(itemId, next);
      }
    });

    linesHost?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-qty-input]');
      if (!input) return;
      const line = input.closest('[data-item]');
      update(Number(line.dataset.item), Math.max(0, Math.min(99, Number(input.value) || 0)));
    });

    summaryHost?.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-discount-form]');
      if (!form) return;
      event.preventDefault();

      const code = form.code.value.trim();
      if (!code) return;

      try {
        const cart = await api('/api/cart/discount', { method: 'POST', body: { code } });
        discount = cart.discountCode;
        setStoredDiscount(discount);
        render(cart);
        toast(`Code ${discount} applied.`, 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    summaryHost?.addEventListener('click', async (event) => {
      if (!event.target.closest('[data-remove-discount]')) return;
      discount = '';
      setStoredDiscount('');
      load();
    });

    if (qs('cancelled')) {
      toast('Checkout cancelled. Your cart is still here.');
    }

    load();
  }

  initCart(root);
})();
