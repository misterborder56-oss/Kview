// Service worker: guarda la "carcasa" de la app para que abra rápido y sin conexión.
// Supabase (login, contactos, mensajes) siempre va por internet.
const VERSION = "proyect-v1";
const ARCHIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", evento => {
    evento.waitUntil(
        caches.open(VERSION).then(cache => cache.addAll(ARCHIVOS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", evento => {
    evento.waitUntil(
        caches.keys().then(nombres =>
            Promise.all(
                nombres
                    .filter(nombre => nombre !== VERSION)
                    .map(nombre => caches.delete(nombre))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", evento => {
    const url = new URL(evento.request.url);

    // Solo archivos propios; todo lo demás (Supabase, fuentes) va directo a la red
    if (evento.request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    // Primero la red (así ves cambios nuevos); si no hay internet, la copia guardada
    evento.respondWith(
        fetch(evento.request)
            .then(respuesta => {
                const copia = respuesta.clone();
                caches.open(VERSION).then(cache => cache.put(evento.request, copia));
                return respuesta;
            })
            .catch(() => caches.match(evento.request))
    );
});
