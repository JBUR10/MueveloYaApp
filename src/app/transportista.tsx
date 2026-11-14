// src/app/transportista.tsx
// Pestaña "Solicitudes" del modo transportista: solo las listas
// (Disponibles, Aceptadas e Historial). El mapa está en la pestaña Inicio.
import PanelTransportista from "../components/transportista/PanelTransportista";

export default function TransportistaScreen() {
  return <PanelTransportista vista="lista" />;
}
