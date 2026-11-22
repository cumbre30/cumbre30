// Calibración empírica de la cadena vertical del motor: ruido GNSS
// vertical (σ=10-15 m típico sin barómetro) sobre terreno plano vs
// histéresis; y una subida real de 50 m con el mismo ruido.
import { resolverMotorConfig, MOTOR_CONFIG_DEFECTO } from "../src/motor/config";
import { MotorMetricas } from "../src/motor/metricas";

function corrida(sigma: number, subidaM: number, h: number, nFixes: number, velKmh = 20) {
  const cfg = resolverMotorConfig({ gainHisteresisM: h });
  const m = new MotorMetricas(cfg, 0);
  let alt = 850;
  let t = 1000;
  const dM = (velKmh / 3.6) * 1; // desplazamiento 1 s
  let semilla = 123456789;
  const rnd = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * (sigma / 1.0); // ~N(0,σ)
  for (let i = 0; i < nFixes; i++) {
    t += 1000;
    if (subidaM > 0 && nFixes > 0) alt += subidaM / nFixes;
    const fix = {
      lat: -33.4 + i * 0.00005,
      lon: -70.65,
      speedMps: velKmh / 3.6,
      accuracyM: 5,
      bearing: null,
      alt: alt + gauss(),
      valt: null,
      t,
      fuente: "nativa" as const,
    };
    m.procesar(fix, velKmh, dM, t);
  }
  return { gain: m.gainM, loss: m.lossM };
}

const defecto = MOTOR_CONFIG_DEFECTO.gainHisteresisM;
console.log("histeresis defecto:", defecto);
for (const sigma of [10, 15]) {
  for (const h of [2, 3, 4, 5, 6]) {
    const plano = corrida(sigma, 0, h, 120);
    const subida = corrida(sigma, 50, h, 120);
    console.log(
      `σ=${sigma} h=${h} · plano gain=${plano.gain.toFixed(1)}m loss=${plano.loss.toFixed(1)}m · subida50 gain=${subida.gain.toFixed(1)}m`
    );
  }
}
