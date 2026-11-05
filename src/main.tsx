import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// O app abre pelo cache do service worker (funciona offline), então quem abre o
// link vê primeiro a versão guardada. Quando a versão nova termina de instalar,
// a página recarrega sozinha — sem precisar de Ctrl+Shift+R.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
