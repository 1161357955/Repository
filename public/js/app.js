/* =========================================================
   Falak Platform – Frontend Application (Arabic SPA)
   ========================================================= */

'use strict';

// ── Utilities ────────────────────────────────────────────
const API = (path, opts = {}) => {
  opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
  return fetch('/api' + path, opts).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطأ في الخادم');
    return data;
  });
};

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function statusBadge(status) {
  const map = {
    active:    ['badge-success', 'نشط'],
    inactive:  ['badge-secondary','غير نشط'],
    pending:   ['badge-warning', 'معلق'],
    paid:      ['badge-success', 'مدفوع'],
    cancelled: ['badge-danger',  'ملغى'],
    overdue:   ['badge-danger',  'متأخر'],
  };
  const [cls, label] = map[status] || ['badge-secondary', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA');
}

// ── Router ────────────────────────────────────────────────
const PAGES = { dashboard: renderDashboard, vendors: renderVendors, beneficiaries: renderBeneficiaries, services: renderServices, billing: renderBilling };
const PAGE_TITLES = { dashboard: 'لوحة التحكم', vendors: 'الموردون', beneficiaries: 'المستفيدون', services: 'الخدمات', billing: 'الفوترة' };
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || page;
  document.getElementById('content').innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>جاري التحميل…</p></div>';
  PAGES[page]();
}

// ── Dashboard ─────────────────────────────────────────────
async function renderDashboard() {
  const c = document.getElementById('content');
  try {
    const stats = await API('/invoices/stats/summary');
    const recentInvoices = await API('/invoices');
    const displayed = recentInvoices.slice(0, 5);

    const rows = displayed.map(inv => `
      <tr>
        <td>${inv.invoice_number}</td>
        <td>${inv.beneficiary_name}</td>
        <td>${fmtMoney(inv.total_amount)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>${fmtDate(inv.issue_date)}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty-state"><p>لا توجد فواتير بعد</p></td></tr>`;

    c.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue">  <div class="stat-icon">🏭</div><div class="stat-value">${stats.vendorCount}</div><div class="stat-label">الموردون</div></div>
        <div class="stat-card teal">  <div class="stat-icon">👥</div><div class="stat-value">${stats.beneficiaryCount}</div><div class="stat-label">المستفيدون</div></div>
        <div class="stat-card purple"><div class="stat-icon">⚙️</div><div class="stat-value">${stats.serviceCount}</div><div class="stat-label">الخدمات</div></div>
        <div class="stat-card orange"><div class="stat-icon">🧾</div><div class="stat-value">${stats.invoiceCount}</div><div class="stat-label">الفواتير</div></div>
        <div class="stat-card green"> <div class="stat-icon">💰</div><div class="stat-value">${fmtMoney(stats.totalRevenue)}</div><div class="stat-label">الإيرادات المحصّلة</div></div>
        <div class="stat-card red">   <div class="stat-icon">⏳</div><div class="stat-value">${fmtMoney(stats.pendingAmount)}</div><div class="stat-label">مبالغ معلقة</div></div>
      </div>
      <div class="section-card">
        <div class="section-header"><h2>آخر الفواتير</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>رقم الفاتورة</th><th>المستفيد</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    c.innerHTML = `<p style="color:red">خطأ: ${e.message}</p>`;
  }
}

// ── Vendors ───────────────────────────────────────────────
async function renderVendors() {
  const c = document.getElementById('content');
  try {
    const vendors = await API('/vendors');
    const rows = vendors.map(v => `
      <tr>
        <td>${v.id}</td>
        <td>${v.name}</td>
        <td>${v.category || '—'}</td>
        <td>${v.phone || '—'}</td>
        <td>${v.email || '—'}</td>
        <td>${statusBadge(v.status)}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editVendor(${v.id})">✏️ تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVendor(${v.id})">🗑️ حذف</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏭</div><p>لا يوجد موردون</p></div></td></tr>`;

    c.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <h2>قائمة الموردين</h2>
          <button class="btn btn-primary" onclick="newVendor()">+ إضافة مورد</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>الاسم</th><th>الفئة</th><th>الهاتف</th><th>البريد</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { c.innerHTML = `<p style="color:red">خطأ: ${e.message}</p>`; }
}

function vendorForm(v = {}) {
  return `
    <form id="vendorForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">الاسم *</label>
          <input class="form-control" name="name" value="${v.name||''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">الفئة</label>
          <input class="form-control" name="category" value="${v.category||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">الهاتف</label>
          <input class="form-control" name="phone" value="${v.phone||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">البريد الإلكتروني</label>
          <input class="form-control" name="email" type="email" value="${v.email||''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">العنوان</label>
        <input class="form-control" name="address" value="${v.address||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" name="status">
          <option value="active" ${v.status==='active'||!v.status?'selected':''}>نشط</option>
          <option value="inactive" ${v.status==='inactive'?'selected':''}>غير نشط</option>
        </select>
      </div>
    </form>`;
}

function newVendor() {
  openModal('إضافة مورد جديد', vendorForm() + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveVendor()">حفظ</button>
    </div>`);
}

async function editVendor(id) {
  const v = await API(`/vendors/${id}`);
  openModal('تعديل المورد', vendorForm(v) + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveVendor(${id})">حفظ</button>
    </div>`);
}

async function saveVendor(id) {
  const form = document.getElementById('vendorForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  try {
    if (id) await API(`/vendors/${id}`, { method: 'PUT', body: data });
    else await API('/vendors', { method: 'POST', body: data });
    closeModal(); showToast('تم الحفظ بنجاح'); renderVendors();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteVendor(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
  try {
    await API(`/vendors/${id}`, { method: 'DELETE' });
    showToast('تم الحذف بنجاح'); renderVendors();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Beneficiaries ─────────────────────────────────────────
async function renderBeneficiaries() {
  const c = document.getElementById('content');
  try {
    const rows = (await API('/beneficiaries')).map(b => `
      <tr>
        <td>${b.id}</td>
        <td>${b.name}</td>
        <td>${b.type || '—'}</td>
        <td>${b.phone || '—'}</td>
        <td>${b.email || '—'}</td>
        <td>${statusBadge(b.status)}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editBeneficiary(${b.id})">✏️ تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBeneficiary(${b.id})">🗑️ حذف</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><p>لا يوجد مستفيدون</p></div></td></tr>`;

    c.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <h2>قائمة المستفيدين</h2>
          <button class="btn btn-primary" onclick="newBeneficiary()">+ إضافة مستفيد</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>الاسم</th><th>النوع</th><th>الهاتف</th><th>البريد</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { c.innerHTML = `<p style="color:red">خطأ: ${e.message}</p>`; }
}

function beneficiaryForm(b = {}) {
  return `
    <form id="beneficiaryForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">الاسم *</label>
          <input class="form-control" name="name" value="${b.name||''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">النوع</label>
          <input class="form-control" name="type" value="${b.type||''}" placeholder="مثال: شركة، فرد" />
        </div>
        <div class="form-group">
          <label class="form-label">الهاتف</label>
          <input class="form-control" name="phone" value="${b.phone||''}" />
        </div>
        <div class="form-group">
          <label class="form-label">البريد الإلكتروني</label>
          <input class="form-control" name="email" type="email" value="${b.email||''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">العنوان</label>
        <input class="form-control" name="address" value="${b.address||''}" />
      </div>
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" name="status">
          <option value="active" ${b.status==='active'||!b.status?'selected':''}>نشط</option>
          <option value="inactive" ${b.status==='inactive'?'selected':''}>غير نشط</option>
        </select>
      </div>
    </form>`;
}

function newBeneficiary() {
  openModal('إضافة مستفيد جديد', beneficiaryForm() + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveBeneficiary()">حفظ</button>
    </div>`);
}

async function editBeneficiary(id) {
  const b = await API(`/beneficiaries/${id}`);
  openModal('تعديل المستفيد', beneficiaryForm(b) + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveBeneficiary(${id})">حفظ</button>
    </div>`);
}

async function saveBeneficiary(id) {
  const form = document.getElementById('beneficiaryForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  try {
    if (id) await API(`/beneficiaries/${id}`, { method: 'PUT', body: data });
    else await API('/beneficiaries', { method: 'POST', body: data });
    closeModal(); showToast('تم الحفظ بنجاح'); renderBeneficiaries();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteBeneficiary(id) {
  if (!confirm('هل أنت متأكد من حذف هذا المستفيد؟')) return;
  try {
    await API(`/beneficiaries/${id}`, { method: 'DELETE' });
    showToast('تم الحذف بنجاح'); renderBeneficiaries();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Services ──────────────────────────────────────────────
async function renderServices() {
  const c = document.getElementById('content');
  try {
    const rows = (await API('/services')).map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.name}</td>
        <td>${s.vendor_name}</td>
        <td>${fmtMoney(s.unit_price)} / ${s.unit||'وحدة'}</td>
        <td>${statusBadge(s.status)}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editService(${s.id})">✏️ تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">🗑️ حذف</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚙️</div><p>لا توجد خدمات</p></div></td></tr>`;

    c.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <h2>قائمة الخدمات</h2>
          <button class="btn btn-primary" onclick="newService()">+ إضافة خدمة</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>الخدمة</th><th>المورد</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { c.innerHTML = `<p style="color:red">خطأ: ${e.message}</p>`; }
}

async function serviceForm(s = {}) {
  const vendors = await API('/vendors');
  const vendorOptions = vendors.map(v =>
    `<option value="${v.id}" ${s.vendor_id==v.id?'selected':''}>${v.name}</option>`
  ).join('');

  return `
    <form id="serviceForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">اسم الخدمة *</label>
          <input class="form-control" name="name" value="${s.name||''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">المورد *</label>
          <select class="form-control" name="vendor_id" required>
            <option value="">-- اختر مورداً --</option>
            ${vendorOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">سعر الوحدة</label>
          <input class="form-control" name="unit_price" type="number" step="0.01" min="0" value="${s.unit_price||0}" />
        </div>
        <div class="form-group">
          <label class="form-label">وحدة القياس</label>
          <input class="form-control" name="unit" value="${s.unit||''}" placeholder="مثال: ساعة، قطعة، شهر" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">الوصف</label>
        <textarea class="form-control" name="description" rows="2">${s.description||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">الحالة</label>
        <select class="form-control" name="status">
          <option value="active" ${s.status==='active'||!s.status?'selected':''}>نشط</option>
          <option value="inactive" ${s.status==='inactive'?'selected':''}>غير نشط</option>
        </select>
      </div>
    </form>`;
}

async function newService() {
  openModal('إضافة خدمة جديدة', (await serviceForm()) + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveService()">حفظ</button>
    </div>`);
}

async function editService(id) {
  const s = await API(`/services/${id}`);
  openModal('تعديل الخدمة', (await serviceForm(s)) + `
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveService(${id})">حفظ</button>
    </div>`);
}

async function saveService(id) {
  const form = document.getElementById('serviceForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  try {
    if (id) await API(`/services/${id}`, { method: 'PUT', body: data });
    else await API('/services', { method: 'POST', body: data });
    closeModal(); showToast('تم الحفظ بنجاح'); renderServices();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteService(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
  try {
    await API(`/services/${id}`, { method: 'DELETE' });
    showToast('تم الحذف بنجاح'); renderServices();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Billing ───────────────────────────────────────────────
async function renderBilling() {
  const c = document.getElementById('content');
  try {
    const rows = (await API('/invoices')).map(inv => `
      <tr>
        <td>${inv.invoice_number}</td>
        <td>${inv.beneficiary_name}</td>
        <td>${fmtMoney(inv.total_amount)}</td>
        <td>${statusBadge(inv.status)}</td>
        <td>${fmtDate(inv.issue_date)}</td>
        <td>${fmtDate(inv.due_date)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewInvoice(${inv.id})">👁 عرض</button>
          <button class="btn btn-sm btn-success" onclick="markPaid(${inv.id})" ${inv.status==='paid'?'disabled':''}>✅ مدفوع</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${inv.id})">🗑️</button>
        </td>
      </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🧾</div><p>لا توجد فواتير</p></div></td></tr>`;

    c.innerHTML = `
      <div class="section-card">
        <div class="section-header">
          <h2>الفواتير</h2>
          <button class="btn btn-primary" onclick="newInvoice()">+ إنشاء فاتورة</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>رقم الفاتورة</th><th>المستفيد</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>تاريخ الاستحقاق</th><th>إجراءات</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch(e) { c.innerHTML = `<p style="color:red">خطأ: ${e.message}</p>`; }
}

async function viewInvoice(id) {
  const inv = await API(`/invoices/${id}`);
  const itemsRows = inv.items.map(item => `
    <tr>
      <td>${item.service_name}</td>
      <td>${item.quantity}</td>
      <td>${fmtMoney(item.unit_price)}</td>
      <td class="item-total">${fmtMoney(item.total)}</td>
    </tr>`).join('');

  openModal(`فاتورة رقم ${inv.invoice_number}`, `
    <p><strong>المستفيد:</strong> ${inv.beneficiary_name}</p>
    <p><strong>التاريخ:</strong> ${fmtDate(inv.issue_date)} | <strong>الاستحقاق:</strong> ${fmtDate(inv.due_date)}</p>
    <p><strong>الحالة:</strong> ${statusBadge(inv.status)}</p>
    ${inv.notes ? `<p><strong>ملاحظات:</strong> ${inv.notes}</p>` : ''}
    <br/>
    <table class="items-table">
      <thead><tr><th>الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot><tr><td colspan="3"><strong>الإجمالي</strong></td><td class="item-total"><strong>${fmtMoney(inv.total_amount)}</strong></td></tr></tfoot>
    </table>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
    </div>`);
}

async function markPaid(id) {
  try {
    await API(`/invoices/${id}/status`, { method: 'PATCH', body: { status: 'paid' } });
    showToast('تم تحديث حالة الفاتورة إلى مدفوع'); renderBilling();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteInvoice(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
  try {
    await API(`/invoices/${id}`, { method: 'DELETE' });
    showToast('تم الحذف بنجاح'); renderBilling();
  } catch(e) { showToast(e.message, 'error'); }
}

// Invoice item counter and cached services for current invoice form
let itemCount = 0;
let _invoiceServices = [];

async function newInvoice() {
  itemCount = 0;
  const [beneficiaries, services] = await Promise.all([API('/beneficiaries'), API('/services')]);
  _invoiceServices = services;

  const bOpts = beneficiaries.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  const sOpts = _invoiceServices.map(s => `<option value="${s.id}" data-price="${s.unit_price}">${s.name} (${s.vendor_name})</option>`).join('');

  openModal('إنشاء فاتورة جديدة', `
    <form id="invoiceForm">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">المستفيد *</label>
          <select class="form-control" name="beneficiary_id" required>
            <option value="">-- اختر مستفيداً --</option>
            ${bOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">تاريخ الاستحقاق</label>
          <input class="form-control" name="due_date" type="date" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظات</label>
        <textarea class="form-control" name="notes" rows="2"></textarea>
      </div>
      <div class="section-header" style="padding:0;margin-bottom:10px">
        <strong>بنود الفاتورة</strong>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addInvoiceItem()">+ إضافة بند</button>
      </div>
      <div id="invoiceItems"></div>
    </form>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveInvoice()">حفظ الفاتورة</button>
    </div>`);

  addInvoiceItem();
}

function addInvoiceItem() {
  const sOpts = _invoiceServices.map(s => `<option value="${s.id}" data-price="${s.unit_price}">${s.name} (${s.vendor_name})</option>`).join('');
  const idx = itemCount++;
  const container = document.getElementById('invoiceItems');
  const div = document.createElement('div');
  div.id = `item-${idx}`;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <select class="form-control" name="items[${idx}][service_id]" onchange="updateItemPrice(this,${idx})" required>
      <option value="">-- الخدمة --</option>
      ${sOpts}
    </select>
    <input class="form-control" name="items[${idx}][quantity]" type="number" step="0.01" min="0.01" placeholder="الكمية" value="1" required />
    <input class="form-control" name="items[${idx}][unit_price]" id="price-${idx}" type="number" step="0.01" min="0" placeholder="السعر" value="0" />
    <button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('item-${idx}').remove()">✕</button>`;
  container.appendChild(div);
}

function updateItemPrice(sel, idx) {
  const opt = sel.options[sel.selectedIndex];
  const price = opt ? opt.dataset.price || 0 : 0;
  document.getElementById(`price-${idx}`).value = price;
}

async function saveInvoice() {
  const form = document.getElementById('invoiceForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const fd = new FormData(form);
  const data = { beneficiary_id: fd.get('beneficiary_id'), due_date: fd.get('due_date'), notes: fd.get('notes'), items: [] };

  // Gather items
  let i = 0;
  while (fd.has(`items[${i}][service_id]`)) {
    data.items.push({
      service_id: fd.get(`items[${i}][service_id]`),
      quantity: fd.get(`items[${i}][quantity]`),
      unit_price: fd.get(`items[${i}][unit_price]`),
    });
    i++;
  }

  if (data.items.length === 0) { showToast('أضف بنداً واحداً على الأقل', 'error'); return; }

  try {
    await API('/invoices', { method: 'POST', body: data });
    closeModal(); showToast('تم إنشاء الفاتورة بنجاح'); renderBilling();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Bootstrap ─────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigate(link.dataset.page);
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

navigate('dashboard');
