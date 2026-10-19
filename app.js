// ===================================
// CONEXIÓN CON SUPABASE
// ===================================

const base = window.supabase.createClient(
    "https://fnuecmcxdqmzxfapprgx.supabase.co",
    "sb_publishable_S0aY6r66h7mpwDaqU034Pg_KynVS-OA"
);

let usuarioActual = null;
let contactoActual = null;
let perfilActual = null;
let contactosIds = new Set();


// ===================================
// ABRIR Y CERRAR PANTALLAS
// ===================================

function abrir(id) {
    document.getElementById(id).style.display = "block";
}

function cerrar(id) {
    document.getElementById(id).style.display = "none";
}

function ocultarPantallas() {
    const pantallas = [
        "inicio",
        "login",
        "register",
        "home",
        "ChatDiv",
        "contactos",
        "Chat",
        "notice",
        "publicaciones",
        "ajustes"
    ];

    pantallas.forEach(id => cerrar(id));
}


// ===================================
// NAVEGACIÓN
// ===================================

function AbrirRegister() {
    cerrar("inicio");
    cerrar("login");
    abrir("register");
}

function AbrirLogin() {
    cerrar("inicio");
    cerrar("register");
    abrir("login");
}

function volverHome() {
    contactoActual = null;

    ocultarPantallas();
    abrir("home");
}

function BtnNotice() {
    const notice = document.getElementById("notice");

    if (notice.style.display === "block") {
        volverHome();
    } else {
        ocultarPantallas();
        abrir("notice");
    }
}


// ===================================
// CAMBIAR TEMA
// ===================================

function aplicarTema(oscuro) {
    document.getElementById("body").classList.toggle("dark", oscuro);

    document.getElementById("Cambiar").textContent =
        oscuro ? "Modo claro" : "Modo oscuro";
}

function cargarTema() {
    let guardado = null;

    try {
        guardado = localStorage.getItem("tema");
    } catch (e) {}

    aplicarTema(guardado === "oscuro");
}

function Estilo() {
    const oscuro =
        !document.getElementById("body").classList.contains("dark");

    aplicarTema(oscuro);

    try {
        localStorage.setItem("tema", oscuro ? "oscuro" : "claro");
    } catch (e) {}
}


// ===================================
// REGISTRO
// ===================================

async function registrar() {
    const nickname =
        document.getElementById("InputName").value.trim();

    const email =
        document.getElementById("InputEmail").value.trim();

    const password =
        document.getElementById("InputPassword").value;

    const fecha =
        document.getElementById("InputFecha").value;

    if (!nickname || !email || !password || !fecha) {
        alert("Completa todos los campos");
        return;
    }

    if (nickname.length > 30) {
        alert("El nickname es demasiado largo");
        return;
    }

    if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres");
        return;
    }

    // Crear la cuenta en Supabase Auth.
    // El trigger de Supabase creará el perfil automáticamente.

    const { data, error } = await base.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                nickname: nickname,
                fecha: fecha
            }
        }
    });

    if (error) {
        console.error("Error de registro:", error);
        alert("No se pudo registrar: " + error.message);
        return;
    }

    if (data.session && data.user) {
        await mostrarHome(data.user);
    } else {
        alert(
            "Cuenta creada. Revisa tu correo para confirmar " +
            "la cuenta y luego inicia sesión."
        );

        cerrar("register");
        abrir("login");
    }
}


// ===================================
// INICIAR SESIÓN
// ===================================

async function login() {
    const email =
        document.getElementById("InputNombre").value.trim();

    const password =
        document.getElementById("InputContraseña").value;

    if (!email || !password) {
        alert("Escribe tu correo y contraseña");
        return;
    }

    const { data, error } =
        await base.auth.signInWithPassword({
            email: email,
            password: password
        });

    if (error) {
        console.error("Error de login:", error);
        alert("No se pudo iniciar sesión: " + error.message);
        return;
    }

    await mostrarHome(data.user);
}


// ===================================
// NOTIFICACIONES PUSH
// ===================================

// Clave PÚBLICA (la privada va solo en Supabase, nunca aquí)
const VAPID_PUBLIC_KEY = "BNyuxXMh90D5YRJQe52mAGHx7PIINqXtpYVYkZvrSmx8Rd-t20pDCbDDjgXJK985Gtiiq2ir6crPLlcbeozVEtA";

function urlBase64ToUint8Array(texto) {
    const relleno = "=".repeat((4 - (texto.length % 4)) % 4);
    const base64 = (texto + relleno).replace(/-/g, "+").replace(/_/g, "/");
    const crudo = atob(base64);

    return Uint8Array.from(crudo, caracter => caracter.charCodeAt(0));
}

function notificacionesDisponibles() {
    return (
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

// Crea (o reutiliza) la suscripción de este teléfono y la guarda en Supabase
async function suscribirPush() {
    const registro = await navigator.serviceWorker.ready;

    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
        suscripcion = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
    }

    const datos = suscripcion.toJSON();

    const { error } = await base.rpc("registrar_push", {
        p_endpoint: datos.endpoint,
        p_p256dh: datos.keys.p256dh,
        p_auth: datos.keys.auth
    });

    if (error) throw error;
}

// Botón "Activar notificaciones"
async function activarNotificaciones() {
    if (!usuarioActual) {
        alert("Primero inicia sesión");
        return;
    }

    if (!notificacionesDisponibles()) {
        alert("Este navegador no admite notificaciones.");
        return;
    }

    const permiso = await Notification.requestPermission();

    if (permiso !== "granted") {
        alert("No diste permiso. Puedes activarlo en los ajustes del navegador.");
        return;
    }

    try {
        await suscribirPush();
        alert("Notificaciones activadas");
    } catch (error) {
        console.error("Error al activar notificaciones:", error);
        alert("No se pudieron activar las notificaciones.");
    }

    actualizarBotonNotificaciones();
}

// Oculta el botón si ya no hace falta
function actualizarBotonNotificaciones() {
    const boton = document.getElementById("BtnPush");

    if (!boton) return;

    const yaActivas =
        notificacionesDisponibles() && Notification.permission === "granted";

    boton.style.display =
        notificacionesDisponibles() && !yaActivas ? "" : "none";
}

// Al iniciar sesión: si ya había permiso, vuelve a vincular este teléfono a la cuenta
async function sincronizarPush() {
    actualizarBotonNotificaciones();

    if (
        notificacionesDisponibles() &&
        Notification.permission === "granted"
    ) {
        try {
            await suscribirPush();
        } catch (error) {
            console.error("Error al sincronizar push:", error);
        }
    }
}

// Al cerrar sesión: este teléfono deja de recibir avisos de esa cuenta
async function olvidarPush() {
    if (!notificacionesDisponibles()) return;

    try {
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.getSubscription();

        if (suscripcion) {
            await base
                .from("push_suscripciones")
                .delete()
                .eq("endpoint", suscripcion.endpoint);
        }
    } catch (error) {
        console.error("Error al olvidar push:", error);
    }
}


// ===================================
// MOSTRAR LA CUENTA CONECTADA
// ===================================

async function mostrarHome(user) {
    usuarioActual = user;
    contactoActual = null;

    ocultarPantallas();
    abrir("home");

    const { data, error } = await base
        .from("perfiles")
        .select("nickname, avatar_path")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error al cargar perfil:", error);
    }

    perfilActual = {
        nickname:
            data?.nickname ||
            user.user_metadata?.nickname ||
            user.email ||
            "Usuario",
        avatar_path: data?.avatar_path || null
    };

    refrescarPerfilEnPantalla();

    sincronizarPush();
}


// ===================================
// RESTAURAR SESIÓN AL RECARGAR
// ===================================

document.addEventListener("DOMContentLoaded", async () => {
    cargarTema();
    ocultarPantallas();
    abrir("inicio");

    const { data, error } = await base.auth.getSession();

    if (error) {
        console.error("Error de sesión:", error);
        return;
    }

    if (data.session) {
        await mostrarHome(data.session.user);
    }
});


// ===================================
// CERRAR SESIÓN
// ===================================

async function cerrarSesion() {
    if (!confirm("¿Seguro que quieres cerrar sesión?")) return;

    await olvidarPush();

    const { error } = await base.auth.signOut();

    if (error) {
        console.error(error);
        alert("No se pudo cerrar sesión: " + error.message);
        return;
    }

    usuarioActual = null;
    contactoActual = null;
    perfilActual = null;
    contactosIds = new Set();

    ocultarPantallas();
    abrir("inicio");
}


// ===================================
// UTILIDADES
// ===================================

function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);

    if (clase) nodo.className = clase;
    if (texto !== undefined && texto !== null) nodo.textContent = texto;

    return nodo;
}

function inicialDe(nombre) {
    return Array.from(nombre || "?")[0]?.toUpperCase() || "?";
}

function urlPublica(bucket, ruta) {
    return base.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

// Pone la foto de perfil (o la inicial) dentro de un elemento
function pintarAvatar(elemento, nickname, avatarPath) {
    elemento.replaceChildren();

    if (avatarPath) {
        const img = document.createElement("img");

        img.alt = "";
        img.loading = "lazy";
        img.src = urlPublica("avatares", avatarPath);

        img.addEventListener("error", () => {
            elemento.replaceChildren(
                document.createTextNode(inicialDe(nickname))
            );
        });

        elemento.appendChild(img);
    } else {
        elemento.textContent = inicialDe(nickname);
    }
}

function crearAvatar(nickname, avatarPath, clase) {
    const avatar = el("div", "avatar " + (clase || ""));

    pintarAvatar(avatar, nickname, avatarPath);

    return avatar;
}

function fechaCorta(iso) {
    return new Date(iso).toLocaleDateString("es", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function horaCorta(iso) {
    return new Date(iso).toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Convierte los links http(s) de un texto en enlaces pulsables (sin usar innerHTML)
function textoConLinks(contenedor, texto) {
    const regex = /(https?:\/\/[^\s<>"']+)/g;
    let ultimo = 0;

    for (const coincidencia of texto.matchAll(regex)) {
        let url = coincidencia[0];
        const inicio = coincidencia.index;

        const sobrante = url.match(/[.,;:!?)\]]+$/);
        if (sobrante) url = url.slice(0, -sobrante[0].length);

        try {
            new URL(url);
        } catch (e) {
            continue;
        }

        if (inicio > ultimo) {
            contenedor.appendChild(
                document.createTextNode(texto.slice(ultimo, inicio))
            );
        }

        const enlace = document.createElement("a");

        enlace.href = url;
        enlace.textContent = url;
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer nofollow";

        contenedor.appendChild(enlace);

        ultimo = inicio + url.length;
    }

    if (ultimo < texto.length) {
        contenedor.appendChild(
            document.createTextNode(texto.slice(ultimo))
        );
    }
}

// Reduce la imagen antes de subirla (ahorra datos y espacio)
function comprimirImagen(archivo, maxLado, calidad) {
    return new Promise((resolve, reject) => {
        if (!archivo.type.startsWith("image/")) {
            reject(new Error("El archivo no es una imagen"));
            return;
        }

        const LIMITE = 5 * 1024 * 1024;

        // Los GIF se suben tal cual para no perder la animación
        if (archivo.type === "image/gif") {
            if (archivo.size > LIMITE) {
                reject(new Error("La imagen pesa más de 5 MB"));
            } else {
                resolve(archivo);
            }
            return;
        }

        const url = URL.createObjectURL(archivo);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");

            canvas.width = Math.max(1, Math.round(img.width * escala));
            canvas.height = Math.max(1, Math.round(img.height * escala));

            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("No se pudo procesar la imagen"));
                } else if (blob.size > LIMITE) {
                    reject(new Error("La imagen pesa más de 5 MB"));
                } else {
                    resolve(blob);
                }
            }, "image/jpeg", calidad);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("No se pudo leer la imagen"));
        };

        img.src = url;
    });
}

// Sube un archivo a la carpeta del usuario y devuelve su ruta
async function subirImagen(bucket, blob) {
    const extension = blob.type === "image/gif" ? "gif" : "jpg";
    const azar = Math.random().toString(36).slice(2, 8);
    const ruta = `${usuarioActual.id}/${Date.now()}-${azar}.${extension}`;

    const { error } = await base.storage
        .from(bucket)
        .upload(ruta, blob, {
            contentType: blob.type || "image/jpeg",
            cacheControl: "31536000"
        });

    if (error) throw error;

    return ruta;
}

function abrirVisor(url) {
    document.getElementById("visorImg").src = url;
    document.getElementById("visor").style.display = "flex";
}

function cerrarVisor() {
    document.getElementById("visor").style.display = "none";
    document.getElementById("visorImg").removeAttribute("src");
}

function mensajeDeError(error, porDefecto) {
    if (
        error?.code === "42501" ||
        /row-level security/i.test(error?.message || "")
    ) {
        return "No tienes permiso para hacer esto.";
    }

    return porDefecto + (error?.message ? " (" + error.message + ")" : "");
}


// ===================================
// ABRIR CHATS
// ===================================

async function BtnChat() {
    if (!usuarioActual) {
        alert("Primero inicia sesión");
        return;
    }

    ocultarPantallas();
    abrir("ChatDiv");
    abrir("contactos");

    document.getElementById("resultadosBusqueda").replaceChildren();

    await cargarContactos();
}


// ===================================
// CARGAR CONTACTOS (solo los que agregaste)
// ===================================

async function cargarContactos() {
    if (!usuarioActual) return;

    const lista = document.getElementById("listaContactos");

    lista.replaceChildren();
    lista.appendChild(el("p", "vacio", "Cargando contactos..."));

    const { data, error } = await base
        .from("contactos")
        .select("contacto_id, perfiles!contactos_contacto_fk(nickname, avatar_path)")
        .eq("user_id", usuarioActual.id);

    if (error) {
        console.error("Error de contactos:", error);
        lista.replaceChildren(
            el("p", "vacio", "No se pudieron cargar los contactos.")
        );
        return;
    }

    const contactos = (data || [])
        .map(fila => ({
            id: fila.contacto_id,
            nickname: fila.perfiles?.nickname || "Usuario",
            avatar_path: fila.perfiles?.avatar_path || null
        }))
        .sort((a, b) => a.nickname.localeCompare(b.nickname, "es"));

    contactosIds = new Set(contactos.map(c => c.id));

    lista.replaceChildren();

    if (contactos.length === 0) {
        lista.appendChild(el(
            "p",
            "vacio",
            "Aún no tienes contactos. Busca un nickname arriba para agregar a alguien."
        ));
        return;
    }

    contactos.forEach(contacto => {
        const boton = document.createElement("button");

        boton.appendChild(
            crearAvatar(contacto.nickname, contacto.avatar_path, "peque")
        );
        boton.appendChild(el("span", "", contacto.nickname));

        boton.addEventListener("click", () => {
            abrirChatCon(contacto);
        });

        lista.appendChild(boton);
    });
}


// ===================================
// BUSCAR Y AGREGAR USUARIOS
// ===================================

async function buscarUsuario() {
    const input = document.getElementById("InputBuscar");
    const nickname = input.value.trim();
    const zona = document.getElementById("resultadosBusqueda");

    if (!nickname) {
        alert("Escribe el nickname que quieres buscar");
        return;
    }

    zona.replaceChildren(el("p", "vacio", "Buscando..."));

    const { data, error } = await base.rpc("buscar_usuario", {
        p_nickname: nickname
    });

    if (error) {
        console.error("Error de búsqueda:", error);
        zona.replaceChildren(el("p", "vacio", "No se pudo buscar. Intenta de nuevo."));
        return;
    }

    zona.replaceChildren();

    if (!data || data.length === 0) {
        zona.appendChild(el(
            "p",
            "vacio",
            "No se encontró ningún usuario con ese nickname. Escríbelo tal cual."
        ));
        return;
    }

    data.forEach(usuario => {
        const fila = el("div", "resultado");

        fila.appendChild(crearAvatar(usuario.nickname, usuario.avatar_path, "peque"));
        fila.appendChild(el("span", "", usuario.nickname));

        if (contactosIds.has(usuario.id)) {
            fila.appendChild(el("small", "", "Ya es tu contacto"));
        } else {
            const boton = el("button", "btn uno chico", "Agregar");

            boton.addEventListener("click", () => {
                agregarContacto(usuario.id, boton);
            });

            fila.appendChild(boton);
        }

        zona.appendChild(fila);
    });
}

async function agregarContacto(idContacto, boton) {
    boton.disabled = true;

    const { error } = await base.rpc("agregar_contacto", {
        p_contacto: idContacto
    });

    if (error) {
        console.error("Error al agregar contacto:", error);
        alert("No se pudo agregar el contacto.");
        boton.disabled = false;
        return;
    }

    document.getElementById("InputBuscar").value = "";
    document.getElementById("resultadosBusqueda").replaceChildren();

    await cargarContactos();
}

async function eliminarContacto() {
    if (!usuarioActual || !contactoActual) return;

    if (!confirm("¿Eliminar a " + contactoActual.nickname + " de tus contactos?")) {
        return;
    }

    const { error } = await base
        .from("contactos")
        .delete()
        .eq("user_id", usuarioActual.id)
        .eq("contacto_id", contactoActual.id);

    if (error) {
        console.error("Error al eliminar contacto:", error);
        alert("No se pudo eliminar el contacto.");
        return;
    }

    await ChatSalir();
}


// ===================================
// ABRIR CONVERSACIÓN
// ===================================

async function abrirChatCon(contacto) {
    contactoActual = contacto;

    cerrar("contactos");
    abrir("Chat");

    document.getElementById("nombreContacto").textContent =
        contacto.nickname;

    pintarAvatar(
        document.getElementById("avatarContacto"),
        contacto.nickname,
        contacto.avatar_path
    );

    document.getElementById("mensajes").replaceChildren();

    await cargarMensajes();
}


// ===================================
// VOLVER A CONTACTOS
// ===================================

async function ChatSalir() {
    contactoActual = null;

    cerrar("Chat");
    abrir("contactos");

    await cargarContactos();
}


// ===================================
// CARGAR MENSAJES PRIVADOS
// ===================================

async function cargarMensajes() {
    if (!usuarioActual || !contactoActual) return;

    const { data, error } = await base
        .from("mensajes")
        .select("id, sender_id, receiver_id, contenido, tipo, imagen_path, creado_en")
        .or(
            `and(sender_id.eq.${usuarioActual.id},receiver_id.eq.${contactoActual.id}),` +
            `and(sender_id.eq.${contactoActual.id},receiver_id.eq.${usuarioActual.id})`
        )
        .order("creado_en", { ascending: false })
        .limit(200);

    if (error) {
        console.error("Error al cargar mensajes:", error);
        alert("No se pudieron cargar los mensajes.");
        return;
    }

    const mensajes = (data || []).reverse();

    // Las imágenes del chat son privadas: se piden con enlaces temporales
    const rutas = mensajes
        .filter(m => m.imagen_path)
        .map(m => m.imagen_path);

    const urls = {};

    if (rutas.length > 0) {
        const { data: firmadas, error: errorUrls } = await base.storage
            .from("chat")
            .createSignedUrls(rutas, 3600);

        if (errorUrls) {
            console.error("Error en imágenes del chat:", errorUrls);
        } else {
            (firmadas || []).forEach(f => {
                if (f.signedUrl) urls[f.path] = f.signedUrl;
            });
        }
    }

    const contenedor = document.getElementById("mensajes");
    contenedor.replaceChildren();

    for (const mensaje of mensajes) {
        const esMio = mensaje.sender_id === usuarioActual.id;
        const burbuja = el("div", "burbuja " + (esMio ? "mio" : "otro"));

        if (mensaje.imagen_path) {
            const url = urls[mensaje.imagen_path];

            if (url) {
                const img = el("img");

                img.src = url;
                img.alt = "Imagen enviada";
                img.loading = "lazy";
                img.addEventListener("click", () => abrirVisor(url));

                burbuja.appendChild(img);
            } else {
                burbuja.appendChild(el("p", "", "Imagen no disponible"));
            }
        }

        if (mensaje.contenido) {
            const texto = el("p");

            textoConLinks(texto, mensaje.contenido);
            burbuja.appendChild(texto);
        }

        burbuja.appendChild(el("small", "", horaCorta(mensaje.creado_en)));

        burbuja.title = new Date(mensaje.creado_en).toLocaleString("es");

        contenedor.appendChild(burbuja);
    }

    contenedor.scrollTop = contenedor.scrollHeight;
}


// ===================================
// ENVIAR MENSAJE DE TEXTO (y links)
// ===================================

async function enviarMensaje() {
    if (!usuarioActual || !contactoActual) {
        alert("Selecciona un contacto primero");
        return;
    }

    const input = document.getElementById("mensajeTexto");
    const contenido = input.value.trim();

    if (!contenido) return;

    if (contenido.length > 5000) {
        alert("El mensaje es demasiado largo");
        return;
    }

    const boton = document.querySelector("#Chat .enviar");
    boton.disabled = true;

    const { error } = await base
        .from("mensajes")
        .insert({
            sender_id: usuarioActual.id,
            receiver_id: contactoActual.id,
            contenido: contenido
        });

    boton.disabled = false;

    if (error) {
        console.error("Error al enviar mensaje:", error);
        alert(
            error.code === "42501"
                ? "No puedes enviarle mensajes a este usuario (ya no es tu contacto)."
                : "No se pudo enviar el mensaje."
        );
        return;
    }

    input.value = "";

    await cargarMensajes();
}


// ===================================
// ENVIAR IMAGEN POR EL CHAT
// ===================================

async function enviarImagenChat() {
    const input = document.getElementById("InputImagenChat");
    const archivo = input.files[0];

    input.value = "";

    if (!archivo) return;

    if (!usuarioActual || !contactoActual) {
        alert("Selecciona un contacto primero");
        return;
    }

    const botonImagen = document.getElementById("BtnImagenChat");
    const botonEnviar = document.querySelector("#Chat .enviar");

    botonImagen.disabled = true;
    botonEnviar.disabled = true;

    let ruta = null;

    try {
        const blob = await comprimirImagen(archivo, 1600, 0.82);

        ruta = await subirImagen("chat", blob);

        const campo = document.getElementById("mensajeTexto");
        const pie = campo.value.trim() || null;

        const { error } = await base
            .from("mensajes")
            .insert({
                sender_id: usuarioActual.id,
                receiver_id: contactoActual.id,
                contenido: pie,
                tipo: "imagen",
                imagen_path: ruta
            });

        if (error) throw error;

        campo.value = "";

        await cargarMensajes();
    } catch (error) {
        console.error("Error al enviar imagen:", error);

        alert(
            error?.code === "42501"
                ? "No puedes enviarle mensajes a este usuario (ya no es tu contacto)."
                : mensajeDeError(error, "No se pudo enviar la imagen.")
        );

        if (ruta) {
            base.storage.from("chat").remove([ruta]);
        }
    } finally {
        botonImagen.disabled = false;
        botonEnviar.disabled = false;
    }
}


// ===================================
// PUBLICACIONES
// ===================================

async function AbrirPublicaciones() {
    if (!usuarioActual) {
        alert("Primero inicia sesión");
        return;
    }

    ocultarPantallas();
    abrir("publicaciones");

    await cargarPublicaciones();
}

function vistaPreviaPub() {
    const archivo = document.getElementById("PubImagen").files[0];
    const vista = document.getElementById("PubVista");

    vista.replaceChildren();

    if (!archivo) return;

    const img = el("img");
    const url = URL.createObjectURL(archivo);

    img.alt = "Vista previa";
    img.addEventListener("load", () => URL.revokeObjectURL(url));
    img.src = url;

    vista.appendChild(img);
}

async function publicar() {
    const campoTitulo = document.getElementById("PubTitulo");
    const campoImagen = document.getElementById("PubImagen");

    const titulo = campoTitulo.value.trim();
    const archivo = campoImagen.files[0];

    if (!titulo) {
        alert("Escribe un título");
        return;
    }

    if (!archivo) {
        alert("Elige una imagen");
        return;
    }

    const boton = document.getElementById("BtnPublicar");

    boton.disabled = true;
    boton.textContent = "Publicando...";

    let ruta = null;

    try {
        const blob = await comprimirImagen(archivo, 1600, 0.82);

        ruta = await subirImagen("publicaciones", blob);

        const { error } = await base
            .from("publicaciones")
            .insert({ titulo: titulo, imagen_path: ruta });

        if (error) throw error;

        campoTitulo.value = "";
        campoImagen.value = "";
        document.getElementById("PubVista").replaceChildren();

        await cargarPublicaciones();
    } catch (error) {
        console.error("Error al publicar:", error);
        alert(mensajeDeError(error, "No se pudo publicar."));

        if (ruta) {
            base.storage.from("publicaciones").remove([ruta]);
        }
    } finally {
        boton.disabled = false;
        boton.textContent = "Publicar";
    }
}

async function cargarPublicaciones() {
    const lista = document.getElementById("listaPublicaciones");

    lista.replaceChildren(el("p", "vacio", "Cargando publicaciones..."));

    const { data, error } = await base
        .from("publicaciones")
        .select(
            "id, titulo, imagen_path, creado_en, user_id, " +
            "perfiles(nickname, avatar_path), comentarios(count)"
        )
        .order("creado_en", { ascending: false })
        .limit(30);

    if (error) {
        console.error("Error al cargar publicaciones:", error);
        lista.replaceChildren(
            el("p", "vacio", "No se pudieron cargar las publicaciones.")
        );
        return;
    }

    lista.replaceChildren();

    if (!data || data.length === 0) {
        lista.appendChild(el(
            "p",
            "vacio",
            "Todavía no hay publicaciones. ¡Sé el primero!"
        ));
        return;
    }

    data.forEach(publicacion => {
        lista.appendChild(crearTarjetaPublicacion(publicacion));
    });
}

function crearTarjetaPublicacion(pub) {
    const tarjeta = el("article", "pub");
    const nickname = pub.perfiles?.nickname || "Usuario";

    // Cabecera: autor y fecha
    const cabecera = el("div", "pub-cab");

    cabecera.appendChild(
        crearAvatar(nickname, pub.perfiles?.avatar_path, "peque")
    );

    const info = el("div", "pub-info");

    info.appendChild(el("strong", "", nickname));
    info.appendChild(el("small", "", fechaCorta(pub.creado_en)));
    cabecera.appendChild(info);

    if (pub.user_id === usuarioActual.id) {
        const borrar = el("button", "link link-peligro", "Eliminar");

        borrar.addEventListener("click", () => {
            eliminarPublicacion(pub, tarjeta);
        });

        cabecera.appendChild(borrar);
    }

    tarjeta.appendChild(cabecera);

    // Título e imagen
    tarjeta.appendChild(el("h3", "pub-titulo", pub.titulo));

    const urlImagen = urlPublica("publicaciones", pub.imagen_path);
    const img = el("img", "pub-img");

    img.src = urlImagen;
    img.alt = pub.titulo;
    img.loading = "lazy";
    img.addEventListener("click", () => abrirVisor(urlImagen));

    tarjeta.appendChild(img);

    // Comentarios
    let total = pub.comentarios?.[0]?.count ?? 0;

    const pie = el("div", "pub-pie");
    const botonComentarios = el("button", "link", "Comentarios (" + total + ")");

    pie.appendChild(botonComentarios);
    tarjeta.appendChild(pie);

    const zona = el("div", "comentarios");
    const listaComentarios = el("div");
    const fila = el("div", "div comentario-nuevo");

    const campo = el("input", "input");

    campo.type = "text";
    campo.placeholder = "Escribe un comentario...";
    campo.maxLength = 500;
    campo.autocomplete = "off";

    const enviar = el("button", "btn uno chico", "Enviar");

    fila.appendChild(campo);
    fila.appendChild(enviar);

    zona.appendChild(listaComentarios);
    zona.appendChild(fila);
    tarjeta.appendChild(zona);

    const actualizarTotal = n => {
        total = n;
        botonComentarios.textContent = "Comentarios (" + total + ")";
    };

    let cargados = false;

    botonComentarios.addEventListener("click", async () => {
        zona.classList.toggle("abierto");

        if (zona.classList.contains("abierto") && !cargados) {
            cargados = true;
            await cargarComentarios(pub, listaComentarios, actualizarTotal);
        }
    });

    const comentar = async () => {
        const texto = campo.value.trim();

        if (!texto) return;

        enviar.disabled = true;

        const { error } = await base
            .from("comentarios")
            .insert({ publicacion_id: pub.id, texto: texto });

        enviar.disabled = false;

        if (error) {
            console.error("Error al comentar:", error);
            alert(mensajeDeError(error, "No se pudo comentar."));
            return;
        }

        campo.value = "";

        await cargarComentarios(pub, listaComentarios, actualizarTotal);
    };

    enviar.addEventListener("click", comentar);

    campo.addEventListener("keydown", evento => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            comentar();
        }
    });

    return tarjeta;
}

async function cargarComentarios(pub, lista, actualizarTotal) {
    const { data, error } = await base
        .from("comentarios")
        .select("id, texto, creado_en, user_id, perfiles(nickname, avatar_path)")
        .eq("publicacion_id", pub.id)
        .order("creado_en", { ascending: true });

    if (error) {
        console.error("Error al cargar comentarios:", error);
        lista.replaceChildren(
            el("p", "vacio", "No se pudieron cargar los comentarios.")
        );
        return;
    }

    lista.replaceChildren();

    if (!data || data.length === 0) {
        lista.appendChild(el("p", "vacio", "Sé el primero en comentar."));
    }

    (data || []).forEach(comentario => {
        const nickname = comentario.perfiles?.nickname || "Usuario";
        const fila = el("div", "comentario");

        fila.appendChild(
            crearAvatar(nickname, comentario.perfiles?.avatar_path, "peque")
        );

        const cuerpo = el("div", "comentario-cuerpo");
        const texto = el("span");

        cuerpo.appendChild(el("strong", "", nickname));
        textoConLinks(texto, comentario.texto);
        cuerpo.appendChild(texto);

        // Puede borrar: el autor del comentario o el dueño de la publicación
        if (
            comentario.user_id === usuarioActual.id ||
            pub.user_id === usuarioActual.id
        ) {
            const borrar = el("button", "link link-peligro", "Eliminar");

            borrar.addEventListener("click", async () => {
                const { error: errorBorrar } = await base
                    .from("comentarios")
                    .delete()
                    .eq("id", comentario.id);

                if (errorBorrar) {
                    console.error("Error al borrar comentario:", errorBorrar);
                    alert("No se pudo eliminar el comentario.");
                    return;
                }

                await cargarComentarios(pub, lista, actualizarTotal);
            });

            cuerpo.appendChild(borrar);
        }

        fila.appendChild(cuerpo);
        lista.appendChild(fila);
    });

    actualizarTotal((data || []).length);
}

async function eliminarPublicacion(pub, tarjeta) {
    if (!confirm("¿Eliminar esta publicación?")) return;

    const { error } = await base
        .from("publicaciones")
        .delete()
        .eq("id", pub.id);

    if (error) {
        console.error("Error al eliminar publicación:", error);
        alert("No se pudo eliminar la publicación.");
        return;
    }

    base.storage.from("publicaciones").remove([pub.imagen_path]);

    tarjeta.remove();
}


// ===================================
// AJUSTES: FOTO DE PERFIL Y NICKNAME
// ===================================

function AbrirAjustes() {
    if (!usuarioActual || !perfilActual) {
        alert("Primero inicia sesión");
        return;
    }

    ocultarPantallas();
    abrir("ajustes");

    refrescarPerfilEnPantalla();

    document.getElementById("InputNickname").value = perfilActual.nickname;
}

// Actualiza la foto y el nombre donde se muestran
function refrescarPerfilEnPantalla() {
    pintarAvatar(
        document.getElementById("avatarHome"),
        perfilActual.nickname,
        perfilActual.avatar_path
    );

    pintarAvatar(
        document.getElementById("ajustesAvatar"),
        perfilActual.nickname,
        perfilActual.avatar_path
    );

    document.getElementById("user").textContent = perfilActual.nickname;

    document.getElementById("BtnQuitarAvatar").style.display =
        perfilActual.avatar_path ? "" : "none";
}

// Guarda un cambio en mi perfil y confirma que de verdad se aplicó
async function actualizarPerfil(cambios) {
    const { data, error } = await base
        .from("perfiles")
        .update(cambios)
        .eq("id", usuarioActual.id)
        .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
        throw new Error("No se pudo actualizar el perfil (revisa las políticas de Supabase)");
    }
}

async function cambiarAvatar() {
    const input = document.getElementById("InputAvatar");
    const archivo = input.files[0];

    input.value = "";

    if (!archivo) return;

    let ruta = null;

    try {
        const blob = await comprimirImagen(archivo, 400, 0.85);

        ruta = await subirImagen("avatares", blob);

        await actualizarPerfil({ avatar_path: ruta });

        const anterior = perfilActual.avatar_path;

        perfilActual.avatar_path = ruta;

        if (anterior) {
            base.storage.from("avatares").remove([anterior]);
        }

        refrescarPerfilEnPantalla();
    } catch (error) {
        console.error("Error al cambiar foto:", error);
        alert(mensajeDeError(error, "No se pudo cambiar la foto."));

        if (ruta) {
            base.storage.from("avatares").remove([ruta]);
        }
    }
}

async function quitarAvatar() {
    if (!perfilActual?.avatar_path) return;

    if (!confirm("¿Quitar tu foto de perfil?")) return;

    try {
        await actualizarPerfil({ avatar_path: null });

        base.storage.from("avatares").remove([perfilActual.avatar_path]);

        perfilActual.avatar_path = null;

        refrescarPerfilEnPantalla();
    } catch (error) {
        console.error("Error al quitar foto:", error);
        alert(mensajeDeError(error, "No se pudo quitar la foto."));
    }
}

async function guardarNickname() {
    const nuevo = document.getElementById("InputNickname").value.trim();

    if (!nuevo) {
        alert("El nickname no puede estar vacío");
        return;
    }

    if (nuevo.length > 30) {
        alert("El nickname es demasiado largo");
        return;
    }

    if (nuevo === perfilActual.nickname) return;

    try {
        await actualizarPerfil({ nickname: nuevo });

        perfilActual.nickname = nuevo;

        refrescarPerfilEnPantalla();

        alert("Nickname actualizado");
    } catch (error) {
        console.error("Error al cambiar nickname:", error);

        alert(
            error?.code === "23505"
                ? "Ese nickname ya está en uso."
                : mensajeDeError(error, "No se pudo cambiar el nickname.")
        );
    }
}


// ===================================
// ENTER PARA ENVIAR
// ===================================

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("mensajeTexto")
        .addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                enviarMensaje();
            }
        });

    document
        .getElementById("InputBuscar")
        .addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                buscarUsuario();
            }
        });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") cerrarVisor();
    });
});
