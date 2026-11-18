// Prueba de la rotación de licencias (B-03): genera con el secreto
// vigente (servidor) y con el legado, y valida ambos caminos.
import { generateProLicenseCode } from "../src/lib/proLicenseCore";
import { generateCurrentProLicenseCode, validateAnyProLicenseCode } from "../src/lib/proLicenseServer";

const email = "prueba@cumbre30.cl";

const nuevo = await generateCurrentProLicenseCode(email);
const legado = await generateProLicenseCode(email); // default = legado

const okNuevo = await validateAnyProLicenseCode(email, nuevo);
const okLegado = await validateAnyProLicenseCode(email, legado);
const okFalso = await validateAnyProLicenseCode(email, "C30P-AAAA-BBBB-CCCC-DDDD");
const okOtroCorreo = await validateAnyProLicenseCode("otro@cumbre30.cl", nuevo);

console.log("codigo nuevo:", nuevo);
console.log("codigo legado:", legado);
console.log("valida nuevo:", okNuevo);
console.log("valida legado (grandfathering):", okLegado);
console.log("rechaza codigo inventado:", okFalso === false);
console.log("rechaza otro correo:", okOtroCorreo === false);
if (!okNuevo || !okLegado || okFalso || okOtroCorreo) {
  console.error("FALLO en la validacion de licencias");
  process.exit(1);
}
console.log("LICENCIAS_OK");
