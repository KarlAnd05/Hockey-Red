/* ==========================================================================
   Lebanon Hockey admin - Products
   --------------------------------------------------------------------------
   The catalogue: products, their variants, prices and stock.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, centsFromInput, guard } = window.LHAdmin;

  async function initProducts() {
    const host = document.querySelector('[data-products]');
    const searchInput = document.querySelector('[data-product-search]');
    let categories = [];

    async function load() {
      const search = searchInput?.value.trim() || '';
      host.innerHTML = '<div class="admin-loading">Loading products...</div>';

      const [data, cats] = await Promise.all([
        api(`/api/admin/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api('/api/admin/categories'),
      ]);

      categories = cats.categories;

      if (!data.products.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No products</h3><p>Add your first product to get started.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead>
            <tr>
              <th></th><th>Product</th><th>Category</th>
              <th class="num">Price</th><th class="num">Stock</th>
              <th>Sizes</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${data.products
              .map(
                (p) => `
              <tr data-product="${p.id}">
                <td><img class="thumb" src="${escapeHtml(p.imageUrl)}" alt=""></td>
                <td>
                  <div class="cell-strong">${escapeHtml(p.name)}</div>
                  <div class="cell-muted">${escapeHtml(p.slug)}</div>
                </td>
                <td class="cell-muted">${escapeHtml(p.categoryName || '-')}</td>
                <td class="num cell-strong">${money(p.priceCents, data.currency)}</td>
                <td class="num">${p.stock}</td>
                <td class="cell-muted">${p.variants.length ? p.variants.map((v) => escapeHtml(v.name)).join(', ') : '-'}</td>
                <td>
                  <button type="button" class="toggle-pill ${p.active ? 'on' : 'off'}" data-toggle-active>
                    ${p.active ? 'Active' : 'Hidden'}
                  </button>
                </td>
                <td>
                  <div class="actions">
                    <button type="button" class="mini-button" data-edit>Edit</button>
                    <button type="button" class="mini-button danger" data-delete>Delete</button>
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;

      host.dataset.cache = JSON.stringify(data.products);
    }

    function productForm(product) {
      const isNew = !product;
      const p = product || {
        name: '',
        slug: '',
        description: '',
        priceCents: 0,
        stock: 0,
        imageUrl: '',
        badge: '',
        categoryId: null,
        active: true,
        featured: false,
        variants: [],
      };

      const modal = openModal(
        isNew ? 'New product' : `Edit ${p.name}`,
        `<form data-product-form>
          <label>Name<input type="text" name="name" value="${escapeHtml(p.name)}" required></label>
          <label>Description<textarea name="description" rows="3">${escapeHtml(p.description)}</textarea></label>

          <div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Price (${escapeHtml((window.LH.session?.currency || 'cad').toUpperCase())})
              <input type="text" name="price" value="${(p.priceCents / 100).toFixed(2)}" required>
            </label>
            <label>Stock<input type="number" name="stock" min="0" value="${p.stock}"></label>
          </div>

          <div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Category
              <select name="categoryId">
                <option value="">Uncategorised</option>
                ${categories
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Badge<input type="text" name="badge" value="${escapeHtml(p.badge)}" placeholder="New, Signature..."></label>
          </div>

          <label>Image URL
            <input type="text" name="imageUrl" value="${escapeHtml(p.imageUrl)}" placeholder="/assets/photo.jpg">
          </label>

          <div style="display:flex;gap:20px">
            <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
              <input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Active
            </label>
            <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
              <input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Featured
            </label>
          </div>

          ${
            isNew
              ? ''
              : `<div>
                   <label style="margin-bottom:8px">Sizes / variants</label>
                   <div class="variant-editor" data-variant-editor>
                     ${p.variants
                       .map(
                         (v) => `
                       <div class="variant-editor-row" data-variant="${v.id}">
                         <input type="text" value="${escapeHtml(v.name)}" data-variant-name aria-label="Variant name">
                         <input type="number" value="${v.stock}" min="0" data-variant-stock aria-label="Variant stock">
                         <button type="button" class="mini-button danger" data-variant-delete>Remove</button>
                       </div>`
                       )
                       .join('')}
                   </div>
                   <div class="variant-editor-row" style="margin-top:8px">
                     <input type="text" placeholder="Add size (e.g. XL)" data-new-variant-name aria-label="New variant name">
                     <input type="number" placeholder="Stock" min="0" value="0" data-new-variant-stock aria-label="New variant stock">
                     <button type="button" class="mini-button solid" data-variant-add>Add</button>
                   </div>
                 </div>`
          }
        </form>`,
        `<button type="button" class="mini-button" data-modal-close>Cancel</button>
         <button type="submit" form="" class="mini-button solid" data-save>Save product</button>`
      );

      const form = modal.querySelector('[data-product-form]');

      /* --- Variants --- */
      modal.querySelector('[data-variant-add]')?.addEventListener('click', () =>
        guard(async () => {
          const name = modal.querySelector('[data-new-variant-name]').value.trim();
          const stock = Number(modal.querySelector('[data-new-variant-stock]').value) || 0;
          if (!name) return;

          await api(`/api/admin/products/${p.id}/variants`, {
            method: 'POST',
            body: { name, stock },
          });
          toast('Size added.', 'success');
          closeModal();
          await load();
        })
      );

      modal.querySelector('[data-variant-editor]')?.addEventListener('click', (event) => {
        const row = event.target.closest('[data-variant]');
        if (!row || !event.target.closest('[data-variant-delete]')) return;

        guard(async () => {
          await api(`/api/admin/variants/${row.dataset.variant}`, { method: 'DELETE' });
          row.remove();
          toast('Size removed.');
        });
      });

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const values = Object.fromEntries(new FormData(form).entries());

          const body = {
            name: values.name,
            description: values.description,
            priceCents: centsFromInput(values.price),
            stock: Number(values.stock) || 0,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            imageUrl: values.imageUrl,
            badge: values.badge,
            active: form.active.checked,
            featured: form.featured.checked,
          };

          if (!body.name.trim()) throw new Error('A product name is required.');

          // Persist any inline variant edits alongside the product itself.
          if (!isNew) {
            const rows = modal.querySelectorAll('[data-variant]');
            for (const row of rows) {
              await api(`/api/admin/variants/${row.dataset.variant}`, {
                method: 'PATCH',
                body: {
                  name: row.querySelector('[data-variant-name]').value,
                  stock: Number(row.querySelector('[data-variant-stock]').value) || 0,
                },
              });
            }
          }

          if (isNew) {
            await api('/api/admin/products', { method: 'POST', body });
            toast('Product created.', 'success');
          } else {
            await api(`/api/admin/products/${p.id}`, { method: 'PATCH', body });
            toast('Product saved.', 'success');
          }

          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-product]')?.addEventListener('click', () => productForm(null));

    let searchTimer;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => guard(load), 260);
    });

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-product]');
      if (!row) return;

      const products = JSON.parse(host.dataset.cache || '[]');
      const product = products.find((p) => p.id === Number(row.dataset.product));
      if (!product) return;

      if (event.target.closest('[data-edit]')) {
        productForm(product);
        return;
      }

      if (event.target.closest('[data-toggle-active]')) {
        guard(async () => {
          await api(`/api/admin/products/${product.id}`, {
            method: 'PATCH',
            body: { active: !product.active },
          });
          await load();
        });
        return;
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete product',
          `<div class="modal-body">
             <p>Delete <strong>${escapeHtml(product.name)}</strong>?</p>
             <p class="cell-muted">If it appears on any past order it will be hidden from the store instead of removed, so order history and invoices stay intact.</p>
           </div>`,
          `<button type="button" class="mini-button" data-modal-close>Cancel</button>
           <button type="button" class="mini-button danger" data-confirm-delete>Delete</button>`
        );

        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            const result = await api(`/api/admin/products/${product.id}`, { method: 'DELETE' });
            closeModal();
            toast(result.archived ? 'Product hidden (it has order history).' : 'Product deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initProducts);
})();
