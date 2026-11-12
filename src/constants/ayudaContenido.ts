// src/constants/ayudaContenido.ts
//
// Contenido de la pantalla de ayuda: tutorial guiado y preguntas frecuentes.
// Para cambiar un texto o agregar un paso/pregunta solo hay que editar este archivo.

export type PasoTutorial = {
  titulo: string;
  texto: string;
  /** Consejos cortos que se muestran como lista debajo del texto. */
  consejos?: string[];
  /** Si existe, se muestra el botón "Ir a esta sección". */
  ruta?: string;
};

export type SeccionTutorial = {
  id: string;
  nombre: string;
  icono: string;
  pasos: PasoTutorial[];
};

export const SECCIONES_TUTORIAL: SeccionTutorial[] = [
  {
    id: "inicio",
    nombre: "Inicio",
    icono: "⌂",
    pasos: [
      {
        titulo: "Tu ubicación en el mapa",
        texto:
          "Al abrir la app, el mapa te ubica automáticamente y arriba aparece tu dirección actual en el panel “Tu ubicación”. Esa dirección se usará como punto de recogida cuando pidas un servicio.",
        consejos: ["Activa el permiso de ubicación del teléfono para que funcione."],
        ruta: "/",
      },
      {
        titulo: "Elige a dónde va tu carga",
        texto:
          "Escribe el destino en el buscador “¿Pa' dónde es?” y elige un resultado. La app traza la ruta en el mapa y te muestra la información del recorrido.",
        consejos: [
          "Si no encuentras el lugar por nombre, prueba con la dirección completa.",
          "Para quitar el destino, usa el botón de limpiar del buscador.",
        ],
        ruta: "/",
      },
      {
        titulo: "Ubicar un punto manualmente",
        texto:
          "Si necesitas un punto exacto, elige la opción de ubicar en el mapa: mueve el mapa hasta dejar el punto donde quieres, revisa la dirección que aparece y toca “Confirmar punto”.",
        ruta: "/",
      },
      {
        titulo: "La barra de navegación",
        texto:
          "Abajo tienes cuatro pestañas: Inicio, Servicios, Solicitudes y Perfil. Puedes tocarlas o arrastrar el dedo sobre la barra para cambiar de una a otra. Un punto rojo en Solicitudes indica que tienes avisos sin ver.",
      },
    ],
  },
  {
    id: "servicios",
    nombre: "Servicios",
    icono: "◇",
    pasos: [
      {
        titulo: "Paso 1: ¿Qué necesitas mover?",
        texto:
          "Elige el tipo de servicio que mejor describe tu carga: Envío (paquetes y cajas), Acarreo (objetos grandes), Trasteo (muebles y electrodomésticos) o Mudanza (hogar completo).",
        ruta: "/servicios",
      },
      {
        titulo: "Paso 2: Ruta del servicio",
        texto:
          "Indica el punto de recogida y el punto de entrega. Puedes escribir dirección y barrio, traer tu ubicación del mapa o marcar el punto exacto directamente en el mapa.",
        consejos: [
          "Los dos puntos son obligatorios para continuar.",
          "Marcar el punto en el mapa evita confusiones con la dirección.",
        ],
        ruta: "/servicios",
      },
      {
        titulo: "Paso 3: ¿Cuándo lo necesitas?",
        texto:
          "Elige “Recogida lo antes posible” para un servicio inmediato, o programa una fecha y hora con “Elegir fecha y hora”.",
        consejos: [
          "Los servicios programados se pueden cancelar con al menos 48 horas de anticipación.",
        ],
        ruta: "/servicios",
      },
      {
        titulo: "Paso 4: Detalles y ayudantes",
        texto:
          "Cuéntanos qué vas a transportar (por ejemplo: 1 nevera, 1 cama doble y 5 cajas). Indica cuántos ayudantes adicionales necesitas, los pisos por escaleras y si el lugar es sin ascensor. Al terminar, envía la solicitud.",
        consejos: [
          "Entre más detalle des, mejor se prepara el transportista.",
          "Verás la confirmación “Servicio solicitado” y podrás seguirlo en Solicitudes.",
        ],
        ruta: "/servicios",
      },
    ],
  },
  {
    id: "solicitudes",
    nombre: "Solicitudes",
    icono: "▤",
    pasos: [
      {
        titulo: "Sigue el estado de tu servicio",
        texto:
          "Aquí aparecen todas tus solicitudes. El estado cambia solo: “Buscando transportista”, “Aceptada” (el transportista va a recoger), “En camino al destino” y finalmente “Finalizado”.",
        consejos: ["Desliza hacia abajo para actualizar la lista."],
        ruta: "/solicitudes",
      },
      {
        titulo: "Contacta a tu transportista",
        texto:
          "Cuando un transportista acepta tu solicitud, verás sus datos en “Tu transportista” y podrás llamarlo desde la misma tarjeta.",
        ruta: "/solicitudes",
      },
      {
        titulo: "Cancelar o eliminar",
        texto:
          "Puedes cancelar una solicitud mientras falten 48 horas o más para el servicio y aún no haya iniciado. Los servicios finalizados o cancelados se pueden eliminar del historial.",
        consejos: ["Eliminar es definitivo y no se puede deshacer."],
        ruta: "/solicitudes",
      },
      {
        titulo: "Califica y reporta problemas",
        texto:
          "Al finalizar el servicio puedes calificar al transportista y a la app, y decir si lo recomendarías. Si tuviste un problema (daño o pérdida, retraso, cobro indebido o mal trato) cuéntanos y revisaremos tu caso.",
        ruta: "/solicitudes",
      },
    ],
  },
  {
    id: "perfil",
    nombre: "Perfil",
    icono: "○",
    pasos: [
      {
        titulo: "Tus datos personales",
        texto:
          "En “Mi perfil” puedes ver y actualizar tus datos, como nombre y teléfono. Mantenerlos al día ayuda a que el transportista pueda contactarte.",
        ruta: "/perfil",
      },
      {
        titulo: "Preferencias",
        texto:
          "Desde Preferencias puedes activar o desactivar las notificaciones de la app.",
        ruta: "/perfil",
      },
      {
        titulo: "Cerrar sesión",
        texto:
          "Al final del perfil está el botón “Cerrar sesión”. La app te pedirá confirmación antes de salir de tu cuenta.",
        ruta: "/perfil",
      },
    ],
  },
  {
    id: "transportista",
    nombre: "Transportista",
    icono: "🚚",
    pasos: [
      {
        titulo: "Activa el modo transportista",
        texto:
          "En tu perfil usa el interruptor “Modo transportista”. La primera vez debes registrar tu vehículo y documentos. Mientras estés en este modo verás solicitudes de transporte en lugar de pedir servicios; puedes volver a modo usuario cuando quieras.",
        ruta: "/perfil",
      },
      {
        titulo: "Registra tu vehículo y documentos",
        texto:
          "Indica tipo de vehículo, placa, marca y modelo, número de licencia de tránsito y la vigencia de tus documentos: SOAT, revisión técnico-mecánica (o márcala como exenta) y licencia de conducción. La póliza de responsabilidad civil es opcional.",
        consejos: [
          "Ninguna vigencia puede superar 1 año desde hoy.",
          "Te avisaremos cuando un documento esté por vencer.",
        ],
        ruta: "/vehiculo",
      },
      {
        titulo: "Espera la aprobación",
        texto:
          "Un administrador revisa tu perfil. Mientras tanto no recibirás pedidos. Si lo rechazan, verás el motivo para que corrijas tus datos y lo vuelvas a enviar.",
      },
      {
        titulo: "Panel del transportista",
        texto:
          "En modo transportista, la pestaña Solicitudes abre tu panel: solicitudes disponibles (también en el mapa, toca un pin para verla), las que ya aceptaste y las que completaste.",
        ruta: "/transportista",
      },
      {
        titulo: "Acepta y realiza el servicio",
        texto:
          "Toca “Aceptar solicitud” para tomarla. Verás la ruta al punto de recogida y el cliente verá que vas en camino. Al llegar al destino confirma la entrega para finalizar el servicio.",
        consejos: [
          "Los servicios inmediatos no se pueden cancelar después de aceptarlos.",
          "Los programados se cancelan solo con 48 horas o más de anticipación.",
        ],
        ruta: "/transportista",
      },
      {
        titulo: "Ayudantes y calificación",
        texto:
          "Indica en tu panel si cuentas con ayudantes para tus servicios. Al finalizar, califica tu experiencia con el cliente.",
        ruta: "/transportista",
      },
    ],
  },
];

export type PreguntaFrecuente = {
  categoria: string;
  pregunta: string;
  respuesta: string;
};

export const CATEGORIAS_FAQ = [
  "Todas",
  "General",
  "Servicios",
  "Cancelaciones",
  "Transportistas",
  "Cuenta",
] as const;

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    categoria: "General",
    pregunta: "¿Qué es Muévelo Ya?",
    respuesta:
      "Es una app que conecta a personas que necesitan mover cosas (envíos, acarreos, trasteos y mudanzas) con transportistas verificados.",
  },
  {
    categoria: "General",
    pregunta: "¿Por qué no aparece mi ubicación en el mapa?",
    respuesta:
      "Revisa que el permiso de ubicación esté activado para la app en los ajustes del teléfono y que el GPS esté encendido. Luego vuelve a abrir la app.",
  },
  {
    categoria: "General",
    pregunta: "¿Cómo busco un destino?",
    respuesta:
      "En Inicio escribe el lugar en el buscador “¿Pa' dónde es?” y elige un resultado. También puedes ubicar el punto exacto moviendo el mapa.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Cómo pido un servicio?",
    respuesta:
      "Ve a la pestaña Servicios y completa los 4 pasos: tipo de carga, ruta, cuándo lo necesitas y detalles con ayudantes. Al final envía la solicitud y síguela en Solicitudes.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Qué diferencia hay entre Envío, Acarreo, Trasteo y Mudanza?",
    respuesta:
      "Envío es para paquetes y cajas, Acarreo para objetos grandes, Trasteo para muebles y electrodomésticos, y Mudanza para el traslado de un hogar completo.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Puedo programar un servicio para otro día?",
    respuesta:
      "Sí. En el paso 3 elige “Elegir fecha y hora” y selecciona cuándo lo necesitas. Si lo necesitas ya, elige “Recogida lo antes posible”.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Para qué sirven los ayudantes, los pisos y el ascensor?",
    respuesta:
      "Son datos para que el transportista sepa cuánto esfuerzo requiere el servicio: cuántas personas adicionales necesitas, cuántos pisos por escaleras hay y si no hay ascensor.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Cómo sé en qué estado va mi servicio?",
    respuesta:
      "En Solicitudes. Verás “Buscando transportista”, “Aceptada”, “En camino al destino” o “Finalizado”. Cuando haya novedades aparece un punto rojo en esa pestaña.",
  },
  {
    categoria: "Servicios",
    pregunta: "¿Cómo califico un servicio o reporto un problema?",
    respuesta:
      "Cuando el servicio finaliza, en Solicitudes toca “Calificar”. Allí puedes valorar al transportista y a la app, y si tuviste un problema (daño o pérdida, retraso, cobro indebido, mal trato u otro) puedes enviar una queja.",
  },
  {
    categoria: "Cancelaciones",
    pregunta: "¿Puedo cancelar una solicitud?",
    respuesta:
      "Sí, siempre que falten 48 horas o más para el servicio y este no haya iniciado. Si ya lo iniciaron, no se puede cancelar.",
  },
  {
    categoria: "Cancelaciones",
    pregunta: "¿Qué pasa con los servicios inmediatos?",
    respuesta:
      "Como se prestan lo antes posible, el transportista no puede cancelarlos una vez los acepta. Para el cliente aplica la misma regla de tiempo mínimo de cancelación.",
  },
  {
    categoria: "Cancelaciones",
    pregunta: "¿Cómo elimino un servicio de mi historial?",
    respuesta:
      "En Solicitudes, los servicios finalizados o cancelados tienen el botón “Eliminar”. Es una acción definitiva.",
  },
  {
    categoria: "Transportistas",
    pregunta: "¿Cómo me convierto en transportista?",
    respuesta:
      "En Perfil activa “Modo transportista” y registra tu vehículo y documentos. Un administrador los revisa y, cuando te aprueba, ya puedes recibir solicitudes.",
  },
  {
    categoria: "Transportistas",
    pregunta: "¿Qué documentos necesito?",
    respuesta:
      "SOAT, revisión técnico-mecánica (si tu vehículo está exento puedes marcarlo), licencia de conducción y número de licencia de tránsito. La póliza de responsabilidad civil es opcional.",
  },
  {
    categoria: "Transportistas",
    pregunta: "¿Por qué no puedo activar el modo transportista?",
    respuesta:
      "Primero debes registrar tu vehículo y esperar la aprobación del administrador. Si tus documentos están vencidos o tu perfil fue rechazado, corrígelos desde la pantalla del vehículo.",
  },
  {
    categoria: "Transportistas",
    pregunta: "¿Cuánto duran las vigencias de los documentos?",
    respuesta:
      "La fecha de vencimiento no puede superar 1 año desde hoy. Te avisamos con anticipación cuando un documento esté por vencer para que lo actualices.",
  },
  {
    categoria: "Transportistas",
    pregunta: "¿Cómo acepto una solicitud?",
    respuesta:
      "En tu panel (o tocando un pin en el mapa) abre la solicitud y toca “Aceptar solicitud”. Verás la ruta al punto de recogida y el cliente sabrá que vas en camino.",
  },
  {
    categoria: "Cuenta",
    pregunta: "¿Cómo recupero mi contraseña?",
    respuesta:
      "En la pantalla de inicio de sesión usa la opción de recuperar contraseña. Te enviaremos un código para que crees una nueva.",
  },
  {
    categoria: "Cuenta",
    pregunta: "¿Cómo cambio entre modo usuario y transportista?",
    respuesta:
      "Desde Perfil, con el interruptor “Modo transportista”. La app recuerda el último modo que usaste en tu cuenta.",
  },
  {
    categoria: "Cuenta",
    pregunta: "¿Cómo cierro sesión?",
    respuesta:
      "Entra a Perfil y toca “Cerrar sesión” al final de la pantalla; confirma cuando la app te lo pida.",
  },
];
