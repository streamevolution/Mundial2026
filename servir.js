const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// El servidor ahora buscará la llave en la "caja fuerte" de Railway
const API_TOKEN = process.env.API_TOKEN;

// Pequeña validación de seguridad para avisarte si falta la llave
if (!API_TOKEN) {
    console.error("¡ALERTA! No se encontró el API_TOKEN en las variables de entorno.");
}

// Nuestra Memoria Caché
let cachePartidos = { data: null, expiracion: 0 };
let cacheGrupos = { data: null, expiracion: 0 };
let cachePlantillas = {}; 

// Candados para evitar el "Efecto Estampida"
let peticionPartidosPendiente = null;

// 1. ENDPOINT PARTIDOS (60 segundos)
app.get('/api/partidos', async (req, res) => {
    const ahora = Date.now();
    
    // Si hay caché válido, lo entrega al instante
    if (cachePartidos.data && ahora < cachePartidos.expiracion) {
        return res.json(cachePartidos.data);
    }

    // Si ya hay una petición a la API en curso, espera esa misma respuesta (Candado)
    if (peticionPartidosPendiente) {
        const datos = await peticionPartidosPendiente;
        return res.json(datos);
    }

    // Si no hay caché ni petición, crea una nueva
    try {
        peticionPartidosPendiente = fetch('https://api.football-data.org/v4/competitions/WC/matches', {
            headers: { 'X-Auth-Token': API_TOKEN }
        }).then(r => r.json());

        const datos = await peticionPartidosPendiente;
        cachePartidos = { data: datos, expiracion: ahora + 60000 }; // 60 segundos
        peticionPartidosPendiente = null; // Quita el candado
        
        res.json(datos);
    } catch (error) {
        peticionPartidosPendiente = null;
        res.status(500).json({ error: 'Error al conectar con la API oficial' });
    }
});

// 2. ENDPOINT GRUPOS (10 minutos)
app.get('/api/grupos', async (req, res) => {
    const ahora = Date.now();
    if (cacheGrupos.data && ahora < cacheGrupos.expiracion) {
        return res.json(cacheGrupos.data);
    }

    try {
        const respuesta = await fetch('https://api.football-data.org/v4/competitions/WC/standings', {
            headers: { 'X-Auth-Token': API_TOKEN }
        });
        const datos = await respuesta.json();
        cacheGrupos = { data: datos, expiracion: ahora + 600000 }; // 10 minutos
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'Error en la tabla de grupos' });
    }
});

// 3. ENDPOINT JUGADORES (24 horas)
app.get('/api/equipo/:id', async (req, res) => {
    const idEquipo = req.params.id;
    const ahora = Date.now();

    // Revisa si existe la plantilla y si tiene menos de 24 horas (86,400,000 milisegundos)
    if (cachePlantillas[idEquipo] && ahora < cachePlantillas[idEquipo].expiracion) {
        return res.json(cachePlantillas[idEquipo].data);
    }

    try {
        const respuesta = await fetch(`https://api.football-data.org/v4/teams/${idEquipo}`, {
            headers: { 'X-Auth-Token': API_TOKEN }
        });
        const datos = await respuesta.json();
        
        // Guarda la plantilla con una caducidad de 24 horas
        cachePlantillas[idEquipo] = { data: datos, expiracion: ahora + 86400000 }; 
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener la plantilla' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor maestro corriendo en el puerto ${PORT}`);
});
