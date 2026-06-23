  function switchTab(btn, contentId) {
    const parent = btn.closest('.screen') || document.body;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(contentId).classList.add('active');
  }

  function togglePromo(el) {
    el.closest('.promo-select').querySelectorAll('.promo-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function setFuel(id, level) {
    const segs = document.getElementById(id).querySelectorAll('.fuel-seg');
    segs.forEach((s, i) => s.classList.toggle('filled', i < level));
  }

  function setRentalType(type) {
    const isMonth = type === 'month';
    document.getElementById('typeDay').style.cssText   = `flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:${isMonth?'transparent':' var(--blue)'};color:${isMonth?'var(--gray)':'#fff'};transition:all .15s`;
    document.getElementById('typeMonth').style.cssText = `flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;background:${isMonth?'#7c3aed':'transparent'};color:${isMonth?'#fff':'var(--gray)'};transition:all .15s`;
  }

  function selectPromoType(n) {
    [1,2,3,4].forEach(i => {
      document.getElementById('pt'+i).classList.toggle('active-type', i===n);
      document.getElementById('promoVal'+i).style.display = i===n ? '' : 'none';
    });
  }

  function previewDetailPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = document.getElementById('detailPhotoImg');
    img.src = url;
    img.style.display = 'block';
    document.getElementById('detailPhotoPlaceholder').style.display = 'none';
  }

  function previewAddPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.getElementById('addbikePhotoImg').src = url;
    document.getElementById('addbikePhotoPreview').style.display = '';
    document.getElementById('addbikeUploadBox').style.display = 'none';
  }

  function clearAddPhoto() {
    document.getElementById('addbikePhotoImg').src = '';
    document.getElementById('addbikePhotoPreview').style.display = 'none';
    document.getElementById('addbikeUploadBox').style.display = '';
  }

  function showSearchResults() {
    document.getElementById('searchResults').style.display = '';
  }

  function setBikeView(mode) {
    const isGrid = mode === 'grid';
    document.getElementById('bike-grid-view').style.display = isGrid ? 'block' : 'none';
    document.getElementById('bike-list-view').style.display = isGrid ? 'none' : 'block';
    document.getElementById('btn-grid-view').style.background = isGrid ? '#1e3a8a' : '#fff';
    document.getElementById('btn-grid-view').style.color = isGrid ? '#fff' : 'var(--gray)';
    document.getElementById('btn-list-view').style.background = isGrid ? '#fff' : '#1e3a8a';
    document.getElementById('btn-list-view').style.color = isGrid ? 'var(--gray)' : '#fff';
  }

  function setJobView(mode) {
    const isOwner = mode === 'owner';
    document.getElementById('viewStaff').style.cssText = isOwner
      ? 'background:transparent;color:#fff;border:none;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer'
      : 'background:#fff;color:#4f46e5;border:none;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer';
    document.getElementById('viewOwner').style.cssText = isOwner
      ? 'background:#fff;color:#4f46e5;border:none;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer'
      : 'background:transparent;color:#fff;border:none;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer';
    document.getElementById('branchFilter').style.display = isOwner ? '' : 'none';
    document.getElementById('ownerBanner').style.display  = isOwner ? '' : 'none';
    document.querySelectorAll('.jbranch').forEach(b => {
      b.style.display = isOwner ? '' : 'none';
    });
  }

  function setBranch(btn, branch) {
    document.querySelectorAll('.branch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sections = document.querySelectorAll('.job-section');
    if (branch === 'all') {
      sections.forEach(s => s.style.display = '');
      return;
    }
    document.querySelectorAll('.jcard').forEach(c => {
      const tag = c.querySelector('.jbranch');
      if (!tag) { c.style.display = ''; return; }
      const branchMap = { patong:'ป่าตอง', kata:'กะตะ', karon:'กะรน' };
      c.style.display = tag.textContent.includes(branchMap[branch]) ? '' : 'none';
    });
  }

  function filterJob(cat) {
    const sections = document.querySelectorAll('.job-section');
    sections.forEach(s => {
      s.style.display = (cat === 'all' || s.dataset.cat === cat) ? '' : 'none';
    });
  }

  function setExtUnit(unit) {
    document.getElementById('ext-day').style.display  = unit === 'day'  ? '' : 'none';
    document.getElementById('ext-hour').style.display = unit === 'hour' ? '' : 'none';
    document.getElementById('extUnit1').classList.toggle('selected', unit === 'day');
    document.getElementById('extUnit2').classList.toggle('selected', unit === 'hour');
  }
