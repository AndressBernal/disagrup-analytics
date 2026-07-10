/* =============================================
   DISAGRUP ANALYTICS — LÓGICA DE LA APP
   
   COSAS QUE PUEDES CAMBIAR AQUÍ:
   1. URLs de las páginas de Power BI
   2. Usuario y contraseña del administrador
   3. URL del Google Sheet
   ============================================= */

/* ---- 1. URLs DE LAS PÁGINAS DE POWER BI ----
   Reemplaza cada URL con el link de tu página publicada.
   La clave izquierda es el nombre que aparece en las pestañas.
   Puedes agregar más páginas si las necesitas. */
var PAGES = {
  "INVENTARIO":
    "https://app.powerbi.com/view?r=eyJrIjoiMDljNTU2NDgtYzJjMC00NDEwLTgwMTgtMTIyNjAxOTVhYjVkIiwidCI6Ijg0YTRmNDEzLTE2ZjYtNDQ0MC04NTFkLTIxMzQxZjhkYzc3ZSIsImMiOjR9",

  "ANALISIS VENTAS 2":
    "https://app.powerbi.com/view?r=eyJrIjoiMDljNTU2NDgtYzJjMC00NDEwLTgwMTgtMTIyNjAxOTVhYjVkIiwidCI6Ijg0YTRmNDEzLTE2ZjYtNDQ0MC04NTFkLTIxMzQxZjhkYzc3ZSIsImMiOjR9",

  "ANALISIS SOBRESTOCK":
    "https://app.powerbi.com/groups/me/reports/c9144773-aad6-46d8-8962-d8254b397a19/2ea691cd79bc22fbf42f?experience=power-bi"
};

/* ---- 2. USUARIO ADMINISTRADOR ----
   Este usuario siempre funciona sin necesidad de internet.
   Cambia el usuario y la contraseña aquí. */
var ADMIN_USER = {
  usuario:  "andres",
  pass:     "adminAndres*",
  nombre:   "Administrador",
  cargo:    "Admin",
  paginas:  ["INVENTARIO", "ANALISIS VENTAS 2", "ANALISIS SOBRESTOCK"],
  esAdmin:  true
};

/* ---- 3. URL DEL GOOGLE SHEET ----
   Este es el link CSV de tu hoja de usuarios.
   Solo cámbialo si cambias de Sheet. */
var SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQd32CRCdJw05naxlGlg9VpD4KZNimHmpapl9kqQ-oTH7Iu4tA-AaShaooUzp0Yit4yQrbG1eFyV1pY/pub?output=csv";

/* =============================================
   NO MODIFIQUES DEBAJO DE ESTA LÍNEA
   (a menos que sepas JavaScript)
   ============================================= */

var sheetUsers  = [];
var localUsers  = [];
var currentUser = null;

// Cargar usuarios locales guardados en este navegador
try {
  var saved = localStorage.getItem('disagrup_local_users');
  if (saved) localUsers = JSON.parse(saved);
} catch(e) {}

function saveLocalUsers() {
  try { localStorage.setItem('disagrup_local_users', JSON.stringify(localUsers)); } catch(e) {}
}

/* -- Navegación entre pantallas -- */
function show(id) {
  ['screen-login','screen-pbi','screen-admin'].forEach(function(s) {
    var el = document.getElementById(s);
    el.style.display = 'none';
  });
  var target = document.getElementById(id);
  target.style.display = 'flex';
  target.style.flexDirection = id === 'screen-login' ? '' : 'column';
}

/* -- Leer Google Sheet y convertir CSV a lista de usuarios -- */
function fetchSheetUsers(callback) {
  fetch(SHEET_URL)
    .then(function(r) { return r.text(); })
    .then(function(csv) {
      var lines = csv.split('\n').filter(function(l) { return l.trim(); });
      if (lines.length < 2) { callback(null, []); return; }

      var headers = lines[0].split(',').map(function(h) {
        return h.trim().toLowerCase().replace(/\r/g,'');
      });

      var users = [];
      for (var i = 1; i < lines.length; i++) {
        var cols = lines[i].split(',').map(function(c) { return c.trim().replace(/\r/g,''); });
        if (!cols[0]) continue;
        var row = {};
        headers.forEach(function(h, idx) { row[h] = cols[idx] || ''; });

        if ((row['activo'] || '').toUpperCase() === 'SI') {
          users.push({
            usuario: row['usuario'],
            pass:    row['contrasena'],
            nombre:  row['nombre'],
            cargo:   row['cargo'],
            paginas: (row['paginas'] || '').split('|').map(function(p) { return p.trim(); }).filter(Boolean),
            esAdmin: false,
            origen:  'sheet'
          });
        }
      }
      sheetUsers = users;
      callback(null, users);
    })
    .catch(function(err) { callback(err); });
}

/* -- Login -- */
function doLogin() {
  var u    = document.getElementById('inp-user').value.trim();
  var p    = document.getElementById('inp-pass').value;
  var err  = document.getElementById('login-err');
  var load = document.getElementById('load-msg');
  var btn  = document.getElementById('btn-login');

  err.style.display  = 'none';
  load.style.display = 'block';
  btn.disabled       = true;

  // Verificar admin (sin red)
  if (u === ADMIN_USER.usuario && p === ADMIN_USER.pass) {
    load.style.display = 'none';
    btn.disabled = false;
    currentUser = ADMIN_USER;
    show('screen-admin');
    renderUserList();
    renderNewPagesChecks();
    return;
  }

  // Verificar usuarios locales (sin red)
  var localFound = localUsers.find(function(x) { return x.usuario === u && x.pass === p; });
  if (localFound) {
    load.style.display = 'none';
    btn.disabled = false;
    enterPBI(localFound);
    return;
  }

  // Buscar en Google Sheet
  fetchSheetUsers(function(fetchErr, users) {
    load.style.display = 'none';
    btn.disabled = false;
    if (fetchErr) {
      var cached = sheetUsers.find(function(x) { return x.usuario === u && x.pass === p; });
      if (cached) { enterPBI(cached); return; }
      err.textContent = '⚠️ Sin conexión. Verifica tu internet e intenta de nuevo.';
      err.style.display = 'block';
      return;
    }
    var found = users.find(function(x) { return x.usuario === u && x.pass === p; });
    if (!found) {
      err.textContent = '❌ Usuario o contraseña incorrectos';
      err.style.display = 'block';
      return;
    }
    enterPBI(found);
  });
}

/* -- Entrar al visor de Power BI -- */
function enterPBI(user) {
  currentUser = user;
  show('screen-pbi');

  var badge = document.getElementById('pbi-badge');
  badge.textContent = user.cargo;
  badge.className = 'topbar-badge ' + getBadgeClass(user.cargo);
  document.getElementById('pbi-nombre').textContent = user.nombre;
  renderTabs(user.paginas);
}

/* -- Logout -- */
function doLogout() {
  currentUser = null;
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  document.getElementById('login-err').style.display = 'none';
  show('screen-login');
}

/* -- Renderizar pestañas del reporte -- */
function renderTabs(paginas) {
  var tabs = document.getElementById('page-tabs');
  tabs.innerHTML = paginas.map(function(p, i) {
    return '<div class="page-tab' + (i === 0 ? ' active' : '') +
           '" onclick="selectPage(\'' + p.replace(/'/g,"\\'") + '\',this)">' + p + '</div>';
  }).join('');
  if (paginas.length > 0) selectPage(paginas[0], tabs.firstChild);
}

/* -- Seleccionar página del reporte -- */
function selectPage(name, el) {
  document.querySelectorAll('.page-tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  var url = PAGES[name];
  var c   = document.getElementById('pbi-container');
  if (url && url.trim() !== '') {
    c.innerHTML = '<iframe class="pbi-frame" src="' + url + '" allowfullscreen></iframe>';
  } else {
    c.innerHTML = '<div class="no-url-msg">' +
      '<span style="font-size:40px">📄</span>' +
      '<p style="font-size:15px;color:#555;font-weight:500">' + name + '</p>' +
      '<small>URL no configurada. Actualiza el archivo app.js.</small>' +
      '</div>';
  }
}

/* -- Badge según cargo -- */
function getBadgeClass(cargo) {
  if (cargo === 'Admin')     return 'badge-adm';
  if (cargo === 'Marketing') return 'badge-mkt';
  if (cargo === 'Logística') return 'badge-log';
  return 'badge-other';
}

/* -- Sincronizar y mostrar usuarios desde el Sheet -- */
function syncUsers() {
  var list = document.getElementById('user-list');
  list.innerHTML = '<p style="color:#888;font-size:13px">🔄 Cargando desde Google Sheet...</p>';
  fetchSheetUsers(function(err) {
    if (err) {
      list.innerHTML = '<p style="color:#d63031;font-size:13px">❌ Error de conexión. Verifica tu internet.</p>';
      return;
    }
    renderUserList();
  });
}

/* -- Renderizar lista de usuarios -- */
function renderUserList() {
  var list = document.getElementById('user-list');
  var all  = sheetUsers.concat(localUsers);

  if (all.length === 0) {
    list.innerHTML = '<p style="color:#aaa;font-size:13px;padding:12px 0">No hay usuarios. Agrégalos en el Google Sheet y sincroniza.</p>';
    return;
  }

  list.innerHTML = all.map(function(u, i) {
    var isLocal  = u.origen !== 'sheet';
    var badgeCls = getBadgeClass(u.cargo);
    var delBtn   = isLocal
      ? '<button class="btn-del" onclick="delLocalUser(' + i + ')">🗑 Eliminar</button>'
      : '<span style="font-size:11px;color:#bbb;white-space:nowrap">Google Sheet</span>';

    return '<div class="user-row">' +
      '<div style="flex:1;min-width:0">' +
        '<div class="user-name">' + u.nombre +
          ' <span class="topbar-badge ' + badgeCls + '">' + u.cargo + '</span>' +
          (isLocal ? ' <span style="font-size:10px;color:#aaa">(local)</span>' : '') +
        '</div>' +
        '<div class="user-uname">@' + u.usuario + '</div>' +
      '</div>' +
      '<div style="flex:1.5">' +
        (u.paginas || []).map(function(p) { return '<span class="page-chip">' + p + '</span>'; }).join('') +
      '</div>' +
      delBtn +
    '</div>';
  }).join('');
}

/* -- Eliminar usuario local -- */
function delLocalUser(idx) {
  var localIdx = idx - sheetUsers.length;
  if (localIdx >= 0 && confirm('¿Eliminar el usuario "' + localUsers[localIdx].nombre + '"?')) {
    localUsers.splice(localIdx, 1);
    saveLocalUsers();
    renderUserList();
  }
}

/* -- Generar checkboxes de páginas en el formulario -- */
function renderNewPagesChecks() {
  var container = document.getElementById('new-pages-checks');
  container.innerHTML = Object.keys(PAGES).map(function(p) {
    return '<label class="chk-label" onclick="toggleChk(this)">' +
      '<input type="checkbox" value="' + p + '"> ' + p +
    '</label>';
  }).join('');
}

function toggleChk(lbl) {
  setTimeout(function() {
    lbl.classList.toggle('checked', lbl.querySelector('input').checked);
  }, 0);
}

/* -- Agregar usuario local -- */
function addLocalUser() {
  var nombre  = document.getElementById('new-nombre').value.trim();
  var usuario = document.getElementById('new-user').value.trim();
  var pass    = document.getElementById('new-pass').value;
  var cargo   = document.getElementById('new-cargo').value;
  var paginas = Array.from(document.querySelectorAll('#new-pages-checks input:checked'))
                     .map(function(x) { return x.value; });
  var err = document.getElementById('add-err');

  if (!nombre || !usuario || !pass || paginas.length === 0) {
    err.style.display = 'block'; return;
  }
  if ([ADMIN_USER].concat(sheetUsers).concat(localUsers).find(function(u) { return u.usuario === usuario; })) {
    err.textContent = '⚠️ Ese nombre de usuario ya existe';
    err.style.display = 'block'; return;
  }

  err.style.display = 'none';
  localUsers.push({ usuario: usuario, pass: pass, nombre: nombre, cargo: cargo, paginas: paginas, esAdmin: false, origen: 'local' });
  saveLocalUsers();

  document.getElementById('new-nombre').value = '';
  document.getElementById('new-user').value   = '';
  document.getElementById('new-pass').value   = '';
  document.querySelectorAll('#new-pages-checks input').forEach(function(x) {
    x.checked = false;
    x.parentElement.classList.remove('checked');
  });

  switchTab('usuarios', document.querySelector('.tab-btn'));
  renderUserList();
  alert('✅ Usuario "' + nombre + '" agregado.\n\nPara que funcione en todos los computadores, agrégalo también en el Google Sheet.');
}

/* -- Cambiar tab del admin -- */
function switchTab(tab, el) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  document.getElementById('panel-usuarios').style.display = tab === 'usuarios' ? 'block' : 'none';
  document.getElementById('panel-agregar').style.display  = tab === 'agregar'  ? 'block' : 'none';
}

/* -- Permitir Enter en los campos de login -- */
document.getElementById('inp-pass').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
document.getElementById('inp-user').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

/* -- Inicializar pantalla de login -- */
show('screen-login');
