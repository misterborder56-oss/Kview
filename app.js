// ===================================
// CONEXIÓN CON SUPABASE
// ===================================

const base = window.supabase.createClient(
    "https://fnuecmcxdqmzxfapprgx.supabase.co",
    "sb_publishable_S0aY6r66h7mpwDaqU034Pg_KynVS-OA"
);

let usuarioActual = null;
let contactoActual = null;


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
        "notice"
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
    cerrar("ChatDiv");
    cerrar("notice");
    abrir("home");
}

function BtnNotice() {
    const notice = document.getElementById("notice");

    if (notice.style.display === "block") {
        cerrar("notice");
        abrir("home");
    } else {
        cerrar("home");
        cerrar("ChatDiv");
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
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Error al cargar perfil:", error);
    }

    document.getElementById("user").textContent =
        data?.nickname ||
        user.user_metadata?.nickname ||
        user.email ||
        "Usuario";

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

    ocultarPantallas();
    abrir("inicio");
}


// ===================================
// ABRIR CHATS
// ===================================

async function BtnChat() {
    if (!usuarioActual) {
        alert("Primero inicia sesión");
        return;
    }

    cerrar("home");
    cerrar("notice");
    abrir("ChatDiv");
    abrir("contactos");
    cerrar("Chat");

    await cargarContactos();
}


// ===================================
// CARGAR CONTACTOS
// ===================================

async function cargarContactos() {
    if (!usuarioActual) return;

    const lista = document.getElementById("listaContactos");

    lista.replaceChildren();
    lista.textContent = "Cargando contactos...";

    const { data, error } = await base
        .from("perfiles")
        .select("id, nickname")
        .neq("id", usuarioActual.id)
        .order("nickname");

    if (error) {
        console.error("Error de contactos:", error);
        lista.textContent = "No se pudieron cargar los contactos.";
        return;
    }

    lista.replaceChildren();

    if (!data || data.length === 0) {
        lista.textContent = "Todavía no hay otros usuarios registrados.";
        return;
    }

    data.forEach(contacto => {
        const boton = document.createElement("button");

        boton.textContent = contacto.nickname;
        boton.dataset.inicial =
            Array.from(contacto.nickname)[0]?.toUpperCase() || "?";

        boton.addEventListener("click", () => {
            abrirChatCon(contacto);
        });

        lista.appendChild(boton);
    });
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
        .select("id, sender_id, receiver_id, contenido, creado_en")
        .or(
            `and(sender_id.eq.${usuarioActual.id},receiver_id.eq.${contactoActual.id}),` +
            `and(sender_id.eq.${contactoActual.id},receiver_id.eq.${usuarioActual.id})`
        )
        .order("creado_en", { ascending: true });

    if (error) {
        console.error("Error al cargar mensajes:", error);
        alert("No se pudieron cargar los mensajes.");
        return;
    }

    const contenedor = document.getElementById("mensajes");
    contenedor.replaceChildren();

    for (const mensaje of data || []) {
        const linea = document.createElement("p");

        const esMio = mensaje.sender_id === usuarioActual.id;

        linea.className = esMio ? "mio" : "otro";
        linea.textContent = mensaje.contenido;
        linea.title =
            new Date(mensaje.creado_en).toLocaleString("es");

        contenedor.appendChild(linea);
    }

    contenedor.scrollTop = contenedor.scrollHeight;
}


// ===================================
// ENVIAR MENSAJE
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
        alert("No se pudo enviar el mensaje.");
        return;
    }

    input.value = "";

    await cargarMensajes();
}


// ===================================
// ENVIAR CON LA TECLA ENTER
// ===================================

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("mensajeTexto");

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            enviarMensaje();
        }
    });
});