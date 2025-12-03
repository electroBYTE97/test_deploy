// --- Dependencias necesarias para el servidor ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise'); // Usamos mysql2 con promesas para operaciones asíncronas

// Inicialización de Express y Servidor HTTP
const app = express();
const server = http.createServer(app);

// --- Configuración de Socket.io ---
// Render requiere que especifiques la configuración de CORS para aceptar conexiones
// desde cualquier origen (el dominio de tu Marketplace, incluso si es una IP local)
const io = new Server(server, {
    cors: {
        origin: "*", // Acepta conexiones desde cualquier URL (como el dominio de ProfeeHost)
        methods: ["GET", "POST"]
    }
});

// --- Configuración de Conexión a Base de Datos MySQL (ProfeeHost) ---
// Render te permite definir Variables de Entorno (Environment Variables)
// para ocultar datos sensibles. Usaremos estas variables para conectarnos
// a tu base de datos en ProfeeHost.

// Importante: Debes definir estas variables en el panel de configuración de Render
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',          // Ejemplo: 'mysql.profeehost.com'
    user: process.env.DB_USER || 'root',              // Ejemplo: 'user123'
    password: process.env.DB_PASSWORD || 'password',    // Ejemplo: 'TuClaveSecreta'
    database: process.env.DB_NAME || 'marketplace_db',  // Ejemplo: 'midb'
    port: process.env.DB_PORT || 3306                   // Puerto estándar
};

let dbConnection;

/**
 * Intenta establecer la conexión a la base de datos MySQL.
 */
async function connectToDatabase() {
    try {
        dbConnection = await mysql.createConnection(dbConfig);
        console.log('? Conexión a MySQL (ProfeeHost) establecida con éxito.');
        // Un query de prueba simple para asegurar que funciona
        await dbConnection.execute('SELECT 1');
    } catch (error) {
        console.error('? Error al conectar a la base de datos MySQL:', error.message);
        // Si falla, el chat puede seguir funcionando, pero los mensajes no serán persistentes.
    }
}

connectToDatabase();

// --- Lógica del Chat con Socket.io ---

io.on('connection', (socket) => {
    // El 'userId' se envía desde el cliente (index.html) al conectarse
    const userId = socket.handshake.query.userId || 'usuario_anonimo';
    console.log(`Usuario conectado: ${userId} (Socket ID: ${socket.id})`);

    // El cliente Node.js (Render.com) se encargará de guardar y retransmitir los mensajes.

    socket.on('send_message', async (message) => {
        console.log(`[Mensaje Recibido de ${message.senderId}]: ${message.text}`);

        // ** 1. Lógica para guardar el mensaje en la base de datos MySQL **
        if (dbConnection) {
            try {
                // NOTA: 'chat_id' y 'receiver_id' son cruciales para el sistema tipo WhatsApp.
                // Aquí solo simulamos un chat general, pero luego usaremos un chat_id real.
                const [result] = await dbConnection.execute(
                    'INSERT INTO messages (chat_id, sender_id, text, timestamp) VALUES (?, ?, ?, NOW())',
                    [message.chatId, message.senderId, message.text]
                );
                console.log(`Mensaje guardado en DB con ID: ${result.insertId}`);
            } catch (error) {
                console.error('Error al guardar mensaje en DB:', error.message);
            }
        }

        // ** 2. Retransmitir el mensaje a la sala de chat (broadcast) **
        // En un chat real, se debe usar 'io.to(message.chatId).emit(...)'.
        // Aquí usamos 'broadcast' para simular que todos lo ven hasta implementar salas.

        // Retransmitimos solo a los clientes en la misma sala (chatId)
        io.to(message.chatId).emit('new_message', message);
        
        // Si es el primer mensaje, el sender también lo debe recibir (opcional, si se implementa un ack)
        // Por ahora, el cliente lo añade a la UI inmediatamente (optimización).
        
        // ** Importante: Se debe unir el socket a la sala al iniciar la conexión o al abrir el chat **
        socket.join(message.chatId); 
    });
    
    // Simulación: Unir al usuario a una sala al conectarse (por ejemplo, su ID de chat de negociación)
    // En un sistema real, esto se haría cuando el usuario abre una conversación específica.
    socket.on('join_chat_room', (chatId) => {
        socket.join(chatId);
        console.log(`${userId} se unió a la sala: ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${userId}`);
    });
});

// --- Inicio del Servidor ---
// Render asigna un puerto dinámico a través de la variable de entorno PORT
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`?? Servidor Socket.io ejecutándose en el puerto ${PORT}`);
    console.log('?? Esperando el primer tráfico. Render se apagará si no hay actividad.');
});