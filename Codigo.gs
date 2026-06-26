// ============================================================
// Codigo.gs — Bar Los Caballos · Subida de fotos a Drive
// Desplegar en script.google.com como Aplicación web:
//   Ejecutar como: yo (tu cuenta)
//   Acceso:        Cualquiera
// ============================================================

const CFG = {
  clave: 'caballos2024',
  carpetas: {
    'Entrantes':             '1qfo18DUlRAz3t-fm9t9MK1XN5PzY9PBz',
    'Ensaladas':             '1O-terLz6YJwU5OZWJP8dBPQTJW1Wmv0E',
    'Revueltos y Tortillas': '1uHwrpJGep6S0OSafZddizQZ1IY2NEvxd',
    'Carnes':                '11qj53AmpqieHV9nCH32TA28X3CoQ04EH',
    'Pescados':              '1uaiXMw0wNNcIpE757i7axgRODWsGe_LY',
    'Freiduría':             '1vwPLgNp52TuQo6sMoCjHgmsIed7lgcI3',
  },
  // Twilio — dejar vacío para desactivar avisos WhatsApp
  twilioSid:   '',
  twilioToken: '',
  twilioFrom:  'whatsapp:+14155238886',
  twilioTo:    'whatsapp:+34642478768',
};

// ------------------------------------------------------------------
// POST: recibe { clave, categoria, plato, foto } con foto en base64
// ------------------------------------------------------------------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.clave !== CFG.clave) {
      return json({ ok: false, error: 'Clave incorrecta' });
    }
    const { categoria, plato, foto } = data;
    const folderId = CFG.carpetas[categoria];
    if (!folderId) return json({ ok: false, error: 'Categoría desconocida: ' + categoria });

    const base64 = foto.replace(/^data:image\/\w+;base64,/, '');
    const blob   = Utilities.newBlob(
      Utilities.base64Decode(base64),
      'image/jpeg',
      sanitize(plato) + '.jpg'
    );

    const folder = DriveApp.getFolderById(folderId);
    // Eliminar versión anterior si existe
    const prev = folder.getFilesByName(sanitize(plato) + '.jpg');
    while (prev.hasNext()) prev.next().setTrashed(true);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    if (CFG.twilioSid && CFG.twilioToken) {
      notificarWhatsApp('✅ Foto subida: ' + plato + ' (' + categoria + ')');
    }

    return json({ ok: true, fileId: file.getId() });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// ------------------------------------------------------------------
// GET ?action=list[&callback=fn]  →  lista de platos que ya tienen foto
// ------------------------------------------------------------------
function doGet(e) {
  const action = (e.parameter.action || '').trim();
  const cb     = (e.parameter.callback || '').trim();

  let result;
  if (action === 'list') {
    result = listarFotos();
  } else {
    result = { ok: false, error: 'Acción no reconocida' };
  }

  const body = JSON.stringify(result);
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------
// Internals
// ------------------------------------------------------------------
function listarFotos() {
  const subidos = {};
  for (const [cat, id] of Object.entries(CFG.carpetas)) {
    const folder = DriveApp.getFolderById(id);
    const files  = folder.getFiles();
    subidos[cat] = [];
    while (files.hasNext()) {
      subidos[cat].push(files.next().getName().replace(/\.jpg$/i, ''));
    }
  }
  return { ok: true, subidos };
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitize(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _,-]/g, '')
    .trim();
}

function notificarWhatsApp(msg) {
  const url     = 'https://api.twilio.com/2010-04-01/Accounts/' + CFG.twilioSid + '/Messages.json';
  const payload = 'From=' + encodeURIComponent(CFG.twilioFrom)
                + '&To='   + encodeURIComponent(CFG.twilioTo)
                + '&Body=' + encodeURIComponent(msg);
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization:  'Basic ' + Utilities.base64Encode(CFG.twilioSid + ':' + CFG.twilioToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    payload,
    muteHttpExceptions: true,
  });
}
