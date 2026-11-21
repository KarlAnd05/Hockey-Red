/* ==========================================================================
   Lebanon Hockey - shop page
   --------------------------------------------------------------------------
   The catalogue: search, category and sort, paging, and the product cards.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="shop"]');
  if (!root) return;

  const { api, money, escapeHtml } = window.LH;
  const { stockPill, announcePayments } = window.LHStore;

  function initShop(root) {
    /* The honest place to mention it is before a cart is built, so the quieter
       is-info variant goes under the shop hero. */
    announcePayments(root.querySelector('[data-payments-notice]'), { compact: true });

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
              <h2>Nothing matches those filters</h2>
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
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h2>Could not load the store</h2><p>${escapeHtml(error.message)}</p></div>`;
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

  initShop(root);
})();
