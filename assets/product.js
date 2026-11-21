/* ==========================================================================
   Lebanon Hockey - product page
   --------------------------------------------------------------------------
   One product: its gallery, its variants, the jersey size guide, and the
   add-to-cart button.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="product"]');
  if (!root) return;

  const { api, money, escapeHtml, toast, cartChanged, qs } = window.LH;
  const { stockPill } = window.LHStore;

  /* ========================================================================
     Jersey size guide
     ------------------------------------------------------------------------
     Transcribed from the federation's supplier sheet (CSG Custom Vintage
     Jersey). All measurements in inches.

     On the page rather than only in the PDF because this is the last thing a
     buyer checks before paying, usually on a phone, and all sales are final -
     asking them to download a two-page PDF to find out whether they are a
     Medium is how you sell somebody the wrong jersey.

     Two quirks are the supplier's own and are reproduced exactly rather than
     "corrected": Chest and Bottom Front carry the same figures, and so do
     Front Length and Back Length. Guessing at what they meant on a chart that
     cannot be returned against would be worse than printing what they sent.
     ======================================================================== */
  const JERSEY_SIZES = {
    youth: {
      label: 'Youth sizes',
      columns: ['Small', 'Medium', 'Large', 'X-Large', 'Goalie'],
      rows: [
        ['Chest', '19', '20', '21', '22', '24'],
        ['Bottom front', '19', '20', '21', '22', '24'],
        ['Front circumference', '38', '40', '42', '44', '48'],
        ['Front length', '22', '23½', '25', '26½', '28'],
        ['Back length (from centre back)', '22', '23½', '25', '26½', '28'],
        ['Arm length', '25', '26½', '28', '29½', '27½'],
        ['Upper arm', '8½', '9', '9½', '10', '13'],
        ['Cuff opening', '5¼', '5½', '5¾', '6', '7'],
      ],
    },
    adult: {
      label: 'Adult sizes',
      columns: ['Small', 'Medium', 'Large', 'X-Large', 'XX-Large', 'XXL Goalie'],
      rows: [
        ['Chest', '24', '25', '27', '29', '31', '31'],
        ['Bottom front', '24', '25', '27', '29', '31', '31'],
        ['Front circumference', '48', '50', '54', '58', '62', '62'],
        ['Front length', '30', '31', '32', '33', '34', '34'],
        ['Back length (from centre back)', '30', '31', '32', '33', '34', '34'],
        ['Arm length', '31', '32', '33½', '35', '36½', '34'],
        ['Upper arm', '11', '11½', '12', '12½', '13', '14½'],
        ['Cuff opening', '6¼', '6½', '6¾', '7', '7¼', '8'],
      ],
    },
  };

  function sizeTable(group) {
    return `
            <h4>${escapeHtml(group.label)}</h4>
            <div class="table-scroll">
              <table class="roster-table size-table">
                <thead>
                  <tr>
                    <th scope="col">Measurement</th>
                    ${group.columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${group.rows
                    .map(
                      (row) => `
                  <tr>
                    <th scope="row" class="size-measure">${escapeHtml(row[0])}</th>
                    ${row
                      .slice(1)
                      .map(
                        (v, i) =>
                          `<td data-label="${escapeHtml(group.columns[i])}">${escapeHtml(v)}&Prime;</td>`
                      )
                      .join('')}
                  </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`;
  }

  function sizeGuide() {
    return `<div class="sizing-note">
              <h3>Check your size before you order</h3>
              <p>All sales are final, so sizing is worth a minute. These are made-to-order jerseys and fit looser than a regular shirt &mdash; most people take their usual size. Measurements are in inches.</p>
              ${sizeTable(JERSEY_SIZES.youth)}
              ${sizeTable(JERSEY_SIZES.adult)}
              <p class="sizing-actions">
                <a class="button ghost small" href="/assets/lihf-jersey-sizing.pdf" target="_blank" rel="noopener">Download the full specification (PDF)</a>
              </p>
              <p class="sizing-help">Still unsure, or buying for someone else? Email <a href="mailto:sales@lebanonhockey.com?subject=Sizing%20question">sales@lebanonhockey.com</a> before ordering.</p>
            </div>`;
  }

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
            <h1>Product not found</h1>
            <p>${escapeHtml(error.message)}</p>
            <a class="button primary small" href="shop.html">Back to the store</a>
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

      /* Sizing advice belongs on garments, not on a puck or a keychain. The
         variant names are the sizes, so their presence is the test. */
      const hasSizes = product.variants.some((v) => /^(XS|S|M|L|XL|XXL|\d+)$/i.test(String(v.name).trim()));

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
              /* Jerseys are cut and printed per order, so the no-exchange rule
                 has to be in front of the buyer before they pick a size. */
              product.category && product.category.slug === 'jerseys'
                ? `<p class="description"><strong>Custom made to order:</strong> once a jersey is
                   ordered it cannot be exchanged for another colour or size.</p>`
                : ''
            }

            ${
              hasVariants
                ? `<div class="filter-group">
                     <h2>Size</h2>
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

            ${
              hasSizes
                ? sizeGuide()
                : ''
            }

            <div class="product-meta">
              <div><strong>Ships from</strong> Greenfield Park, Quebec</div>
              <div><strong>Delivery</strong> Made to order, usually 2&ndash;3 weeks before it ships</div>
              <div><strong>Supports</strong> Lebanese ice hockey programs</div>
              <div><strong>Returns</strong> All sales final &mdash; faulty or incorrect items always replaced</div>
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

  initProduct(root);
})();
