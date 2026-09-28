#!/usr/bin/env node
/**
 * Crea (o cambia) la cuenta del usuario único.
 *
 *   node server/create-user.js                      # interactivo
 *   CURSOS_USER=jesus CURSOS_PASSWORD=secreto node server/create-user.js
 *
 * El login por HTTP nunca crea cuentas a propósito: así, alguien que descubra
 * un servidor recién desplegado no puede quedarse con él. La cuenta se
 * configura aquí, por SSH.
 */
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hasAccount, initAuth, saveAccount } from './auth.js';

// Igual que el servidor: auth.json lleva el hash de la contraseña y solo debe
// poder leerlo el dueño de los datos.
process.umask(0o077);

/** Pregunta escribiendo de verdad, para que la contraseña no acabe en el historial. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error('Sin TTY: usa CURSOS_USER y CURSOS_PASSWORD.'));
      return;
    }

    process.stdout.write(question);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };

    const onData = (char) => {
      if (char === '\u0003' || char === '\u0004') {
        cleanup();
        process.stdout.write('\nCancelado.\n');
        process.exit(130);
      }
      if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      if (char >= ' ') value += char; // ignora secuencias de control
    };

    stdin.on('data', onData);
  });
}

async function resolveCredentials() {
  const envUser = process.env.CURSOS_USER;
  const envPassword = process.env.CURSOS_PASSWORD;

  if (envUser || envPassword) {
    if (!envUser || !envPassword) {
      throw new Error('Define CURSOS_USER y CURSOS_PASSWORD, o ninguno de los dos.');
    }
    return { username: envUser.trim(), password: envPassword };
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const username = (await rl.question('Usuario: ')).trim();
  rl.close();

  if (!username) throw new Error('El usuario no puede estar vacío.');

  const password = await promptHidden('Contraseña: ');
  const confirm = await promptHidden('Repite la contraseña: ');
  if (password !== confirm) throw new Error('Las contraseñas no coinciden.');

  return { username, password };
}

async function main() {
  await initAuth();

  const { username, password } = await resolveCredentials();

  if (username.length === 0) throw new Error('El usuario no puede estar vacío.');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

  const previous = hasAccount() ? 'cuenta anterior reemplazada' : 'cuenta creada';
  const account = await saveAccount(username, password);

  const dataDir = process.env.CURSOS_DATA_DIR || join(import.meta.dirname, 'data');
  await chmod(join(dataDir, 'auth.json'), 0o600).catch(() => {});
  await chmod(dataDir, 0o700).catch(() => {});

  console.log(`Listo: ${previous} para "${account.username}".`);
  console.log('Las sesiones ya abiertas siguen siendo válidas hasta que caduquen.');
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
