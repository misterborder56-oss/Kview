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

    i
