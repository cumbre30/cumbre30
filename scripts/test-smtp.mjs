// Prueba cuál cuenta Gmail acepta la contraseña de aplicación (uso único).
import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

const pass = readFileSync("/tmp/gmail-pass", "utf8").replace(/\s+/g, "");
const candidates = process.argv.slice(2);

for (const user of candidates) {
  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  try {
    await t.verify();
    console.log("OK →", user);
  } catch (e) {
    console.log("FALLO →", user, "-", String(e?.message ?? e).slice(0, 90));
  }
}
