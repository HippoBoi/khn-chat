# Correr el proyecto

1. **React Chat** (puerto 8000):

   ```bash
   cd react-chat
   npm install
   npm run dev
   ```

2. **Backend** (es el mismo de las instrucciones):

   ```bash
   cd backend
   npm install
   npm start
   ```

# Chat realtime con Socket.io

Prueba técnica Finmarkets: crear un chat con realtime utilizando Socket.io.

### React Chat

El chat con React se conecta con el backend Socket.io utilizando un hook (useSocket) y escucha eventos connect, disconnect y message.

Cuando el usuario envía un mensaje se emite llamando socket.emit(mensaje). Socket.io se encarga luego de entregarle el mensaje a los demás usuarios que estén suscritos al evento message

Los mensajes se guardan en localStorage, entonces cuando el usuario reinicia la página siguen ahí.

### Zustand

La app con React usa Zustand para el manejo de estado porque tiene buen rendimiento (aunque la app es tán simple que no importa realmente) es la que más me gusta y con la que más tengo experiencia.

### Avatar de usuario

Ya que la prueba consta únicamente de frontend, opté por hacer un sistema simple de Avatar de usuario que cada uno puede elegir y se muestra antes de su nombre de usuario en el chat.

El sistema funciona así:
El usuario elige una de las imágenes disponibles, y en el store se guarda el index del avatar qu se escogió. Cuando el usuario manda un mensaje, en el mensaje se envia también el index de su avatar, entonces cuando el mensaje llegue a la otra persona se puede leer el index del avatar y mostrar la imágen que corresponda en pantalla.

Interfaz del mensaje:

```typescript
interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  profilePictureIndex: number;
  profilePictureUrl?: string | null;
}
```

this project is a lesson to just use laravel instead
