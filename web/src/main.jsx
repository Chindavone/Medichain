import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

import { loadConfig } from "./chain.js";

const root = createRoot(document.getElementById("root"));
loadConfig().then(
  () => root.render(<App />),
  () => root.render(<p className="banner" role="alert">ເຊື່ອມຕໍ່ Backend API ບໍ່ໄດ້. ກວດວ່າ server ກຳລັງເຮັດວຽກ ແລ້ວໂຫຼດໜ້ານີ້ຄືນ.</p>),
);
