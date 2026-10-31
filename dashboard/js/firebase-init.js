// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
window.hcFbInit = function(apiKey, dbUrl){ if(!firebase.apps.length) firebase.initializeApp({ apiKey: apiKey, authDomain: 'dashboard-a07d4.firebaseapp.com', databaseURL: dbUrl || 'https://dashboard-a07d4-default-rtdb.firebaseio.com' }); return firebase.app(); };