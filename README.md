# Mai API

Backend seguro construido con **Node.js** y **Vercel Serverless Functions** para una tienda de recargas digitales de **Free Fire**.

Recibe los pedidos enviados desde la página web (creada en **Readdy AI**) y los reenvía automáticamente, junto con el comprobante de pago, a un grupo privado de **Telegram** mediante un Bot.

---

## 📦 Estructura del proyecto

```
mai-api/
├── api/
│   └── order.js          # Endpoint POST /api/order
├── lib/
│   └── telegram.js       # Lógica de envío a Telegram (sendPhoto / sendMessage)
├── utils/
│   ├── validator.js      # Validaciones de campos e imagen
│   └── cors.js           # Manejo de CORS
├── package.json
├── vercel.json
├── .gitignore
└── README.md
```

---

## 🛒 Productos soportados

| Producto        | Precio  |
|------------------|---------|
| 110 Diamantes    | S/3.10  |
| 340 Diamantes    | S/9     |
| 570 Diamantes    | S/15    |
| 1100 Diamantes   | S/31    |
| 2300 Diamantes   | S/58    |
| 6000 Diamantes   | S/110   |
| Pase Booyah      | S/6.50  |

El backend valida que el `producto` recibido coincida exactamente (sin distinguir mayúsculas/minúsculas) con uno de estos nombres. Si necesitas agregar o modificar productos, edita el arreglo `PRODUCTOS_VALIDOS` en `utils/validator.js`.

---

## ⚙️ 1. Instalación local

### Requisitos previos
- [Node.js](https://nodejs.org/) versión 18 o superior.
- Una cuenta en [Vercel](https://vercel.com/).
- [Vercel CLI](https://vercel.com/docs/cli) (opcional, para probar en local): `npm i -g vercel`.

### Pasos

1. Descarga o clona el proyecto en tu computadora.
2. Abre una terminal dentro de la carpeta `mai-api`.
3. Instala las dependencias:

```bash
npm install
```

4. Crea un archivo `.env` en la raíz del proyecto (solo para pruebas locales, **nunca lo subas a GitHub**) con las variables de entorno explicadas en el paso 4 de este README:

```
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
```

5. Levanta el servidor local con Vercel CLI:

```bash
vercel dev
```

La API quedará disponible en `http://localhost:3000/api/order`.

---

## ☁️ 2. Subir el proyecto a GitHub

1. Crea un nuevo repositorio en GitHub (por ejemplo `mai-api`).
2. Dentro de la carpeta `mai-api`, inicializa git y sube el proyecto:

```bash
git init
git add .
git commit -m "Primer commit: Mai API"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mai-api.git
git push -u origin main
```

> El archivo `.gitignore` ya está configurado para que `node_modules/`, `.env` y `.vercel` **no se suban** al repositorio.

---

## 🚀 3. Desplegar en Vercel

### Opción A: Desde el dashboard de Vercel (recomendado)

1. Ingresa a [vercel.com](https://vercel.com/) e inicia sesión.
2. Haz clic en **"Add New..." → "Project"**.
3. Selecciona el repositorio `mai-api` que subiste a GitHub.
4. Vercel detectará automáticamente que es un proyecto Node.js con funciones serverless. No necesitas cambiar el "Build Command" ni el "Output Directory".
5. Antes de desplegar, agrega las variables de entorno (ver siguiente sección).
6. Haz clic en **"Deploy"**.
7. Al finalizar, Vercel te entregará una URL pública, por ejemplo:

```
https://mai-api.vercel.app
```

Tu endpoint final será:

```
https://mai-api.vercel.app/api/order
```

### Opción B: Desde la terminal con Vercel CLI

```bash
vercel login
vercel --prod
```

---

## 🔑 4. Configurar las variables de entorno

Necesitas crear un Bot de Telegram y obtener el ID del grupo privado donde llegarán los pedidos.

### 4.1 Crear el Bot de Telegram

1. Abre Telegram y busca a **@BotFather**.
2. Envía el comando `/newbot` y sigue las instrucciones (nombre y username del bot).
3. BotFather te entregará un **token**, algo como:
   `123456789:AAExampleTokenNoUsarEsteValorReal`
4. Guarda ese valor: será tu variable `TELEGRAM_BOT_TOKEN`.

### 4.2 Obtener el Chat ID del grupo privado

1. Crea un grupo privado en Telegram (o usa uno existente).
2. Agrega tu Bot al grupo como miembro.
3. Envía cualquier mensaje en el grupo.
4. Visita en tu navegador (reemplazando `TU_TOKEN`):

```
https://api.telegram.org/botTU_TOKEN/getUpdates
```

5. Busca en la respuesta JSON el campo `"chat":{"id": -1001234567890, ...}`. Ese número (incluyendo el signo `-` si lo tiene) es tu `TELEGRAM_CHAT_ID`.

### 4.3 Configurar las variables en Vercel

1. Dentro de tu proyecto en Vercel, ve a **Settings → Environment Variables**.
2. Agrega:

| Nombre                | Valor                              | Entornos                         |
|------------------------|-------------------------------------|-----------------------------------|
| `TELEGRAM_BOT_TOKEN`  | El token entregado por BotFather   | Production, Preview, Development |
| `TELEGRAM_CHAT_ID`    | El ID del grupo obtenido en 4.2    | Production, Preview, Development |

3. Guarda los cambios y vuelve a desplegar el proyecto (**Deployments → ⋯ → Redeploy**) para que tome las nuevas variables.

> ⚠️ **Nunca** escribas el token directamente en el código ni lo subas a GitHub. El código siempre lo lee desde `process.env`.

---

## 🌐 5. Conectar la API con Readdy AI

En la página creada en Readdy AI, el formulario de compra debe enviar una petición `POST` de tipo `multipart/form-data` (no JSON, porque incluye un archivo) al endpoint:

```
https://mai-api.vercel.app/api/order
```

### Campos que debe enviar el formulario

| Campo         | Tipo     | Obligatorio | Descripción                                   |
|----------------|----------|-------------|------------------------------------------------|
| `producto`    | texto    | Sí          | Nombre exacto del producto (ej: `570 Diamantes`) |
| `precio`      | texto    | Sí          | Precio mostrado al cliente (ej: `S/15`)        |
| `jugador`     | texto    | Sí          | Nombre del jugador                             |
| `idJugador`   | texto    | Sí          | ID del jugador (solo letras y números)         |
| `comprobante` | archivo  | Sí          | Imagen del comprobante (jpg, jpeg o png, máx. 5 MB) |

### Ejemplo de envío en JavaScript (código que puede usarse dentro de Readdy AI)

```javascript
async function enviarPedido(datos) {
  const formData = new FormData();
  formData.append('producto', datos.producto);
  formData.append('precio', datos.precio);
  formData.append('jugador', datos.jugador);
  formData.append('idJugador', datos.idJugador);
  formData.append('comprobante', datos.archivoComprobante); // input type="file"

  const response = await fetch('https://mai-api.vercel.app/api/order', {
    method: 'POST',
    body: formData,
  });

  const resultado = await response.json();

  if (resultado.success) {
    console.log('Pedido enviado:', resultado.orderId);
  } else {
    console.error('Error:', resultado.error);
  }
}
```

No es necesario configurar cabeceras `Content-Type` manualmente: el navegador las genera automáticamente al usar `FormData`.

---

## 🧪 6. Probar con Postman

1. Abre Postman y crea una nueva petición.
2. Método: **POST**.
3. URL:

```
https://mai-api.vercel.app/api/order
```

(o `http://localhost:3000/api/order` si estás probando en local con `vercel dev`).

4. Ve a la pestaña **Body** y selecciona **form-data**.
5. Agrega las siguientes claves:

| Key           | Type  | Value                          |
|----------------|-------|---------------------------------|
| `producto`    | Text  | `570 Diamantes`                |
| `precio`      | Text  | `S/15`                          |
| `jugador`     | Text  | `MaiPlayer`                     |
| `idJugador`   | Text  | `123456789`                     |
| `comprobante` | File  | (selecciona una imagen jpg/png) |

6. Haz clic en **Send**.
7. Si todo está correcto, recibirás una respuesta como esta:

```json
{
  "success": true,
  "message": "Pedido enviado correctamente.",
  "orderId": "MAI-A1B2C3D4"
}
```

Y el pedido, junto con la imagen del comprobante, aparecerá automáticamente en el grupo de Telegram configurado.

### Respuestas de error comunes

| Código HTTP | Causa                                              |
|-------------|-----------------------------------------------------|
| 400         | Falta un campo obligatorio, producto inválido, imagen inválida o demasiado pesada |
| 405         | Se intentó usar un método distinto a POST (ej. GET) |
| 500         | Error interno (por ejemplo, variables de entorno de Telegram no configuradas) |

---

## 🔒 Seguridad implementada

- ✅ CORS habilitado y controlado desde `utils/cors.js`.
- ✅ Solo se acepta el método `POST` (cualquier otro método recibe `405`).
- ✅ Validación estricta de `Content-Type` (`multipart/form-data`).
- ✅ Validación de todos los campos de texto (obligatorios, longitud máxima/mínima, formato del ID).
- ✅ Validación del producto contra una lista blanca de productos permitidos.
- ✅ Validación del comprobante: solo `jpg`, `jpeg`, `png`, máximo 5 MB.
- ✅ Manejo de errores con `try/catch` en todos los flujos.
- ✅ Respuestas siempre en formato JSON con códigos HTTP correctos.
- ✅ El token del Bot y el Chat ID nunca están escritos en el código: se leen desde variables de entorno.
- ✅ Generación de ID de pedido único con UUID (`MAI-XXXXXXXX`), evitando colisiones entre pedidos.
- ✅ Limpieza automática de archivos temporales tras cada petición.

---

## 🛠️ Tecnologías utilizadas

- Node.js (ES Modules)
- Vercel Serverless Functions
- [axios](https://www.npmjs.com/package/axios) — peticiones HTTP hacia la API de Telegram
- [form-data](https://www.npmjs.com/package/form-data) — construcción de multipart/form-data para `sendPhoto`
- [formidable](https://www.npmjs.com/package/formidable) — parseo del formulario multipart entrante (incluida la imagen)
- [uuid](https://www.npmjs.com/package/uuid) — generación de identificadores únicos de pedido

---

## 📄 Licencia

MIT
