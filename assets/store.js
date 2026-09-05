/* ==========================================================================
   Lebanon Hockey - storefront
   One script for shop, product, cart, checkout, and confirmation pages.
   Each page is detected by a marker element, so nothing runs where it should not.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast, cartChanged, qs } = window.LH;

  const DISCOUNT_KEY = 'lh_discount';

  function storedDiscount() {
    try {
      return sessionStorage.getItem(DISCOUNT_KEY) || '';
    } catch {
      return '';
    }
  }

  function setStoredDiscount(code) {
    try {
      if (code) sessionStorage.setItem(DISCOUNT_KEY, code);
      else sessionStorage.removeItem(DISCOUNT_KEY);
    } catch {
      /* private mode - the code just will not persist between pages */
    }
  }

  function stockPill(stock) {
    if (stock <= 0) return '<span class="stock-pill is-out">Sold out</span>';
    if (stock <= 5) return `<span class="stock-pill is-low">Only ${stock} left</span>`;
    return '<span class="stock-pill">In stock</span>';
  }

  /* ========================================================================
     Shop
     ======================================================================== */
  function initShop(root) {
    const grid = root.querySelector('[data-product-grid]');
    const categoryList = root.querySelector('[data-category-filters]');
    const searchInput = root.querySelector('[data-search]');
    const sortSelect = root.querySelector('[data-sort]');
    const minInput = root.querySelector('[data-min-price]');
    const maxInput = root.querySelector('[data-max-price]');
    const inStockInput = root.querySelector('[data-in-stock]');
    const resultCount = root.querySelector('[data-result-count]');
    const pagination = root.querySelector('[data-pagination]');
    const clearButton = root.querySelector('[data-clear-filters]');
    const filterToggle = root.querySelector('[data-filter-toggle]');
    const filterPanel = root.querySelector('[data-filter-panel]');

    const params = new URLSearchParams(window.location.search);

    const state = {
      search: params.get('search') || '',
      category: params.get('category') || 'all',
      sort: params.get('sort') || 'featured',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      inStock: params.get('inStock') === 'true',
      page: Number(params.get('page')) || 1,
    };

    if (searchInput) searchInput.value = state.search;
    if (sortSelect) sortSelect.value = state.sort;
    if (minInput) minInput.value = state.minPrice;
    if (maxInput) maxInput.value = state.maxPrice;
    if (inStockInput) inStockInput.checked = state.inStock;

    function syncUrl() {
      const next = new URLSearchParams();
      if (state.search) next.set('search', state.search);
      if (state.category && state.category !== 'all') next.set('category', state.category);
      if (state.sort !== 'featured') next.set('sort', state.sort);
      if (state.minPrice) next.set('minPrice', state.minPrice);
      if (state.maxPrice) next.set('maxPrice', state.maxPrice);
      if (state.inStock) next.set('inStock', 'true');
      if (state.page > 1) next.set('page', String(state.page));

      const query = next.toString();
      history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    }

    async function loadCategories() {
      if (!categoryList) return;

      try {
        const data = await api('/api/categories');
        const all = [{ slug: 'all', name: 'All products', productCount: null }].concat(
          data.categories
        );

        categoryList.innerHTML = all
          .map(
            (category) => `
              <button type="button" class="filter-option" data-category="${escapeHtml(category.slug)}"
                      aria-pressed="${category.slug === state.category}">
                <span>${escapeHtml(category.name)}</span>
                ${category.productCount === null ? '' : `<span class="count">${category.productCount}</span>`}
              </button>`
          )
          .join('');
      } catch {
        categoryList.innerHTML = '<p class="result-count">Categories unavailable.</p>';
      }
    }

    function renderPagination(data) {
      if (!pagination) return;

      if (data.pages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      const buttons = [`<button type="button" data-page="${data.page - 1}" ${data.page === 1 ? 'disabled' : ''}>Prev</button>`];

      for (let i = 1; i <= data.pages; i += 1) {
        buttons.push(
          `<button type="button" data-page="${i}" aria-current="${i === data.page}">${i}</button>`
        );
      }

      buttons.push(
        `<button type="button" data-page="${data.page + 1}" ${data.page === data.pages ? 'disabled' : ''}>Next</button>`
      );

      pagination.innerHTML = buttons.join('');
    }

    async function load() {
      if (!grid) return;

      grid.innerHTML =
        '<div class="skeleton-grid">' + '<div class="skeleton"></div>'.repeat(6) + '</div>';

      const query = new URLSearchParams({ page: String(state.page), perPage: '12' });
      if (state.search) query.set('search', state.search);
      if (state.category && state.category !== 'all') query.set('category', state.category);
      if (state.sort) query.set('sort', state.sort);
      if (state.minPrice) query.set('minPrice', state.minPrice);
      if (state.maxPrice) query.set('maxPrice', state.maxPrice);
      if (state.inStock) query.set('inStock', 'true');

      try {
        const data = await api(`/api/products?${query}`);

        if (resultCount) {
          resultCount.textContent =
            data.total === 0
              ? 'No products'
              : `${data.total} product${data.total === 1 ? '' : 's'}`;
        }

        if (!data.products.length) {
          grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
              <h3>Nothing matches those filters</h3>
              <p>Try a different search term, or clear the filters to see the full collection.</p>
              <button type="button" class="button ghost small" data-clear-inline>Clear filters</button>
            </div>`;
        } else {
          grid.innerHTML = data.products
            .map((product) => {
              const badge = product.badge
                ? `<span class="product-badge">${escapeHtml(product.badge)}</span>`
                : product.featured
                  ? '<span class="product-badge is-muted">Featured</span>'
                  : '';

              return `
                <a class="product-card" href="product.html?slug=${encodeURIComponent(product.slug)}">
                  <div class="product-media">
                    ${badge}
                    <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">
                  </div>
                  <div class="product-body">
                    ${product.category ? `<span class="product-category">${escapeHtml(product.category.name)}</span>` : ''}
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <div class="product-foot">
                      <span class="product-price">${money(product.priceCents, data.currency)}</span>
                      ${stockPill(product.stock)}
                    </div>
                  </div>
                </a>`;
            })
            .join('');
        }

        renderPagination(data);
        syncUrl();
      } catch (error) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Could not load the shop</h3><p>${escapeHtml(error.message)}</p></div>`;
      }
    }

    function resetAndLoad() {
      state.page = 1;
      load();
    }

    /* --- Wiring --- */
    let searchTimer;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = searchInput.value.trim();
        resetAndLoad();
      }, 260);
    });

    categoryList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;

      state.category = button.dataset.category;
      categoryList.querySelectorAll('[data-category]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el === button));
      });
      resetAndLoad();
    });

    sortSelect?.addEventListener('change', () => {
      state.sort = sortSelect.value;
      resetAndLoad();
    });

    let priceTimer;
    [minInput, maxInput].forEach((input) => {
      input?.addEventListener('input', () => {
        clearTimeout(priceTimer);
        priceTimer = setTimeout(() => {
          state.minPrice = minInput?.value || '';
          state.maxPrice = maxInput?.value || '';
          resetAndLoad();
        }, 400);
      });
    });

    inStockInput?.addEventListener('change', () => {
      state.inStock = inStockInput.checked;
      resetAndLoad();
    });

    pagination?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      state.page = Number(button.dataset.page);
      load();
      window.scrollTo({ top: root.offsetTop - 90, behavior: 'smooth' });
    });

    function clearFilters() {
      state.search = '';
      state.category = 'all';
      state.sort = 'featured';
      state.minPrice = '';
      state.maxPrice = '';
      state.inStock = false;
      state.page = 1;

      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'featured';
      if (minInput) minInput.value = '';
      if (maxInput) maxInput.value = '';
      if (inStockInput) inStockInput.checked = false;

      categoryList?.querySelectorAll('[data-category]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.category === 'all'));
      });

      load();
    }

    clearButton?.addEventListener('click', clearFilters);
    grid?.addEventListener('click', (event) => {
      if (event.target.closest('[data-clear-inline]')) {
        event.preventDefault();
        clearFilters();
      }
    });

    filterToggle?.addEventListener('click', () => {
      const isHidden = filterPanel.hasAttribute('hidden');
      filterPanel.toggleAttribute('hidden', !isHidden);
      filterToggle.setAttribute('aria-expanded', String(isHidden));
    });

    // Filters start collapsed on narrow screens.
    if (filterPanel && window.matchMedia('(max-width: 1080px)').matches) {
      filterPanel.setAttribute('hidden', '');
      filterToggle?.setAttribute('aria-expanded', 'false');
    }

    loadCategories();
    load();
  }

  /* ========================================================================
     Product detail
     ======================================================================== */
  function initProduct(root) {
    const slug = qs('slug');
    if (!slug) {
      window.location.href = 'shop.html';
      return;
    }

    let selectedVariant = null;
    let product = null;

    async function load() {
      try {
        const data = await api(`/api/products/${encodeURIComponent(slug)}`);
        product = data.product;
        render(data);
      } catch (error) {
        root.innerHTML = `
          <div class="empty-state">
            <h3>Product not found</h3>
            <p>${escapeHtml(error.message)}</p>
            <a class="button primary small" href="shop.html">Back to the shop</a>
          </div>`;
      }
    }

    function render(data) {
      document.title = `${product.name} · Lebanon Hockey`;

      const hasVariants = product.variants.length > 0;
      if (hasVariants) {
        selectedVariant = product.variants.find((v) => v.stock > 0) || null;
      }

      const totalStock = hasVariants
        ? product.variants.reduce((sum, v) => sum + v.stock, 0)
        : product.stock;

      root.innerHTML = `
        <nav class="breadcrumb">
          <a href="index.html">Home</a> /
          <a href="shop.html">Shop</a> /
          ${product.category ? `<a href="shop.html?category=${encodeURIComponent(product.category.slug)}">${escapeHtml(product.category.name)}</a> /` : ''}
          <span aria-current="page">${escapeHtml(product.name)}</span>
        </nav>

        <div class="product-detail">
          <div class="product-gallery">
            <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">
          </div>

          <div class="product-info">
            ${product.category ? `<p class="eyebrow">${escapeHtml(product.category.name)}</p>` : ''}
            <h1>${escapeHtml(product.name)}</h1>
            <p class="price-large" data-price>${money(product.priceCents, data.currency)}</p>
            <p class="description">${escapeHtml(product.description)}</p>

            ${
              hasVariants
                ? `<div class="filter-group">
                     <h3>Size</h3>
                     <div class="variant-grid" data-variants>
                       ${product.variants
                         .map(
                           (variant) => `
                         <button type="button" class="variant-chip" data-variant="${variant.id}"
                                 aria-pressed="${selectedVariant && selectedVariant.id === variant.id}"
                                 ${variant.stock <= 0 ? 'disabled' : ''}>
                           ${escapeHtml(variant.name)}
                         </button>`
                         )
                         .join('')}
                     </div>
                   </div>`
                : ''
            }

            <div class="quantity-row">
              <div class="qty-stepper">
                <button type="button" data-step="-1" aria-label="Decrease quantity">-</button>
                <input type="text" inputmode="numeric" value="1" data-qty aria-label="Quantity">
                <button type="button" data-step="1" aria-label="Increase quantity">+</button>
              </div>
              ${stockPill(totalStock)}
            </div>

            <button type="button" class="button primary block" data-add
                    ${totalStock <= 0 ? 'disabled' : ''}>
              ${totalStock <= 0 ? 'Sold out' : 'Add to cart'}
            </button>

            <div class="product-meta">
              <div><strong>Ships from</strong> Greenfield Park, Quebec</div>
              <div><strong>Supports</strong> Lebanese ice hockey programs</div>
              <div><strong>Payment</strong> Secure card payment via Stripe</div>
            </div>
          </div>
        </div>

        ${
          data.related.length
            ? `<section style="margin-top:var(--s-9)">
                 <h2 style="font-size:26px">You may also like</h2>
                 <div class="product-grid">
                   ${data.related
                     .map(
                       (item) => `
                     <a class="product-card" href="product.html?slug=${encodeURIComponent(item.slug)}">
                       <div class="product-media">
                         <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">
                       </div>
                       <div class="product-body">
                         <h3 class="product-name">${escapeHtml(item.name)}</h3>
                         <div class="product-foot">
                           <span class="product-price">${money(item.priceCents, data.currency)}</span>
                         </div>
                       </div>
                     </a>`
                     )
                     .join('')}
                 </div>
               </section>`
            : ''
        }`;

      wire(data.currency);
    }

    function wire(currency) {
      const qtyInput = root.querySelector('[data-qty]');
      const priceEl = root.querySelector('[data-price]');

      root.querySelector('[data-variants]')?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-variant]');
        if (!chip || chip.disabled) return;

        selectedVariant = product.variants.find((v) => v.id === Number(chip.dataset.variant));

        root.querySelectorAll('[data-variant]').forEach((el) => {
          el.setAttribute('aria-pressed', String(el === chip));
        });

        if (priceEl && selectedVariant) {
          priceEl.textContent = money(
            product.priceCents + selectedVariant.priceDeltaCents,
            currency
          );
        }
      });

      root.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => {
          const next = Math.max(1, Math.min(99, (Number(qtyInput.value) || 1) + Number(button.dataset.step)));
          qtyInput.value = String(next);
        });
      });

      qtyInput?.addEventListener('change', () => {
        qtyInput.value = String(Math.max(1, Math.min(99, Number(qtyInput.value) || 1)));
      });

      root.querySelector('[data-add]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;

        if (product.variants.length && !selectedVariant) {
          toast('Choose a size first.', 'error');
          return;
        }

        button.disabled = true;
        button.textContent = 'Adding...';

        try {
          await api('/api/cart/items', {
            method: 'POST',
            body: {
              slug: product.slug,
              variantId: selectedVariant ? selectedVariant.id : undefined,
              quantity: Number(qtyInput.value) || 1,
            },
          });

          cartChanged();
          toast(`${product.name} added to your cart.`, 'success');
          button.textContent = 'Added';
          setTimeout(() => {
            button.textContent = 'Add to cart';
            button.disabled = false;
          }, 1200);
        } catch (error) {
          toast(error.message, 'error');
          button.textContent = 'Add to cart';
          button.disabled = false;
        }
      });
    }

    load();
  }

  /* ========================================================================
     Cart
     ======================================================================== */
  function renderSummary(host, cart, options) {
    const opts = options || {};
    const remaining = cart.freeShippingThresholdCents - (cart.subtotalCents - cart.discountCents);

    host.innerHTML = `
      <h2>Order summary</h2>

      <div class="summary-rows">
        <div class="summary-row"><span>Subtotal</span><strong>${money(cart.subtotalCents, cart.currency)}</strong></div>
        ${
          cart.discountCents > 0
            ? `<div class="summary-row is-discount"><span>Discount (${escapeHtml(cart.discountCode)})</span><strong>-${money(cart.discountCents, cart.currency)}</strong></div>`
            : ''
        }
        <div class="summary-row"><span>Shipping</span><strong>${cart.shippingCents === 0 ? 'Free' : money(cart.shippingCents, cart.currency)}</strong></div>
        ${cart.taxCents > 0 ? `<div class="summary-row"><span>Tax</span><strong>${money(cart.taxCents, cart.currency)}</strong></div>` : ''}
      </div>

      <div class="summary-total">
        <span>Total</span>
        <strong>${money(cart.totalCents, cart.currency)}</strong>
      </div>

      ${
        cart.count > 0 && remaining > 0
          ? `<p class="shipping-hint">Spend ${money(remaining, cart.currency)} more for free shipping.</p>`
          : ''
      }

      ${
        opts.showDiscount
          ? cart.discountCode
            ? `<div class="discount-applied">
                 <span>Code ${escapeHtml(cart.discountCode)} applied</span>
                 <button type="button" class="link-button" data-remove-discount>Remove</button>
               </div>`
            : `<form class="discount-form" data-discount-form>
                 <input type="text" name="code" placeholder="Discount code" aria-label="Discount code" autocomplete="off">
                 <button type="submit" class="button ghost small">Apply</button>
               </form>`
          : ''
      }

      ${opts.actionHtml || ''}

      <p class="secure-note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        Secure checkout. Card details are handled by Stripe and never touch our servers.
      </p>`;
  }

  function initCart(root) {
    const linesHost = root.querySelector('[data-cart-lines]');
    const summaryHost = root.querySelector('[data-cart-summary]');
    let discount = storedDiscount();

    async function load() {
      try {
        const cart = await api(`/api/cart?discount=${encodeURIComponent(discount)}`);
        render(cart);
      } catch (error) {
        linesHost.innerHTML = `<div class="empty-state"><h3>Could not load your cart</h3><p>${escapeHtml(error.message)}</p></div>`;
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
            <h3>Your cart is empty</h3>
            <p>Browse the official collection and support Lebanese ice hockey.</p>
            <a class="button primary small" href="shop.html">Go to the shop</a>
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
            <h3><a href="product.html?slug=${encodeURIComponent(item.slug)}" style="text-decoration:none">${escapeHtml(item.name)}</a></h3>
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

  /* ========================================================================
     Checkout
     ======================================================================== */
  function initCheckout(root) {
    const form = root.querySelector('[data-checkout-form]');
    const summaryHost = root.querySelector('[data-checkout-summary]');
    const statusEl = root.querySelector('[data-checkout-status]');
    const discount = storedDiscount();

    async function loadSummary() {
      try {
        const cart = await api(`/api/checkout/summary?discount=${encodeURIComponent(discount)}`);

        if (!cart.items.length) {
          window.location.href = 'cart.html';
          return;
        }

        summaryHost.innerHTML = `
          <div class="mini-lines">
            ${cart.items
              .map(
                (item) => `
              <div class="mini-line">
                <img src="${escapeHtml(item.imageUrl)}" alt="">
                <div>
                  <div class="name">${escapeHtml(item.name)}</div>
                  <div class="qty">${item.variantName ? `${escapeHtml(item.variantName)} · ` : ''}Qty ${item.quantity}</div>
                </div>
                <strong>${money(item.lineTotalCents, cart.currency)}</strong>
              </div>`
              )
              .join('')}
          </div>
          <div data-totals></div>`;

        renderSummary(summaryHost.querySelector('[data-totals]'), cart, {});
      } catch (error) {
        summaryHost.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
      }
    }

    // Prefill from the signed-in account where we can.
    window.LH.loadSession().then((data) => {
      if (data && data.user && form) {
        if (!form.email.value) form.email.value = data.user.email || '';
        if (!form.name.value) {
          form.name.value = [data.user.firstName, data.user.lastName].filter(Boolean).join(' ');
        }
      }
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submit = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.discountCode = discount;

      submit.disabled = true;
      submit.textContent = 'Redirecting to payment...';
      if (statusEl) statusEl.textContent = '';

      try {
        const result = await api('/api/checkout', { method: 'POST', body: payload });

        if (result.url) {
          setStoredDiscount('');
          window.location.href = result.url;
          return;
        }

        throw new Error('Payment could not be started.');
      } catch (error) {
        if (statusEl) {
          statusEl.className = 'form-status is-error';
          statusEl.textContent = error.message;
        }
        toast(error.message, 'error');
        submit.disabled = false;
        submit.textContent = 'Pay securely';
      }
    });

    loadSummary();
  }

  /* ========================================================================
     Order confirmation
     ======================================================================== */
  function initConfirmation(root) {
    const orderId = qs('order');
    const sessionId = qs('session');
    let attempts = 0;

    if (!orderId) {
      root.innerHTML = '<div class="empty-state"><h3>No order specified</h3><a class="button primary small" href="shop.html">Back to the shop</a></div>';
      return;
    }

    function renderWaiting() {
      root.innerHTML = `
        <div class="status-icon is-waiting">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>
        </div>
        <h1>Confirming your payment</h1>
        <p style="color:var(--muted)">This usually takes a couple of seconds.</p>`;
    }

    function renderOrder(order) {
      const paid = order.status === 'paid' || order.status === 'fulfilled';

      root.innerHTML = `
        <div class="status-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>
        </div>
        <h1>${paid ? 'Thank you' : 'Order received'}</h1>
        <p style="color:var(--muted);font-size:17px">
          ${paid
            ? `Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed. A receipt is on its way to ${escapeHtml(order.email)}.`
            : `Order <strong>${escapeHtml(order.orderNumber)}</strong> is recorded with status ${escapeHtml(order.status)}.`}
        </p>

        <div class="order-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--s-4)">
            <div>
              <h2 style="margin:0;font-size:19px">${escapeHtml(order.orderNumber)}</h2>
              <p style="margin:4px 0 0;color:var(--muted);font-size:13px">${formatDate(order.createdAt)}</p>
            </div>
            <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>

          <div class="mini-lines">
            ${order.items
              .map(
                (item) => `
              <div class="mini-line" style="grid-template-columns:minmax(0,1fr) auto">
                <div>
                  <div class="name">${escapeHtml(item.name)}</div>
                  <div class="qty">${item.variant ? `${escapeHtml(item.variant)} · ` : ''}Qty ${item.quantity}</div>
                </div>
                <strong>${money(item.lineTotalCents, order.currency)}</strong>
              </div>`
              )
              .join('')}
          </div>

          <div class="summary-rows" style="border:0;padding-top:var(--s-4)">
            <div class="summary-row"><span>Subtotal</span><strong>${money(order.subtotalCents, order.currency)}</strong></div>
            ${order.discountCents > 0 ? `<div class="summary-row is-discount"><span>Discount</span><strong>-${money(order.discountCents, order.currency)}</strong></div>` : ''}
            <div class="summary-row"><span>Shipping</span><strong>${order.shippingCents === 0 ? 'Free' : money(order.shippingCents, order.currency)}</strong></div>
          </div>

          <div class="summary-total" style="margin-top:var(--s-4);padding-top:var(--s-4);border-top:1px solid var(--line)">
            <span>Total</span><strong>${money(order.totalCents, order.currency)}</strong>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:var(--s-5)">
            ${paid ? `<a class="button primary small" href="/api/orders/${order.id}/invoice${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}">Download invoice</a>` : ''}
            <a class="button ghost small" href="account.html">Your orders</a>
            <a class="button ghost small" href="shop.html">Keep shopping</a>
          </div>
        </div>`;

      cartChanged();
    }

    async function poll() {
      attempts += 1;

      try {
        const url = `/api/checkout/status/${encodeURIComponent(orderId)}${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}`;
        const data = await api(url);

        if (data.order.status === 'pending' && attempts < 10) {
          setTimeout(poll, 1500);
          return;
        }

        renderOrder(data.order);
      } catch (error) {
        root.innerHTML = `<div class="empty-state"><h3>Could not load that order</h3><p>${escapeHtml(error.message)}</p><a class="button primary small" href="shop.html">Back to the shop</a></div>`;
      }
    }

    renderWaiting();
    poll();
  }

  /* ========================================================================
     Dispatch
     ======================================================================== */
  const pages = {
    shop: initShop,
    product: initProduct,
    cart: initCart,
    checkout: initCheckout,
    confirmation: initConfirmation,
  };

  Object.keys(pages).forEach((name) => {
    const root = document.querySelector(`[data-page="${name}"]`);
    if (root) pages[name](root);
  });
})();
