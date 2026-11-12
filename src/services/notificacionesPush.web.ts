// src/services/notificacionesPush.web.ts
//
// En web no hay notificaciones push: siguen funcionando los avisos dentro de
// la app (punto rojo y alertas). Misma interfaz que notificacionesPush.ts.
type Estado = { soportado: boolean; activo: boolean; sinPermiso: boolean };

const ESTADO: Estado = { soportado: false, activo: false, sinPermiso: false };

export async function iniciarPush(_uid: string | null) {}

export async function cambiarPushActivo(_activo: boolean): Promise<boolean> {
  return false;
}

export async function quitarDispositivoPush() {}

export function escucharToquesNotificacion(_abrir: (ruta: string) => void) {
  return () => {};
}

export function usePush(): Estado {
  return ESTADO;
}
