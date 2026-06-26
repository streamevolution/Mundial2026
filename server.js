const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// URL pública de la API de rezarahiminia/worldcup2026 (Sin límites de peticiones)
const API_BASE = 'https://worldcup26.ir/get';

// Nuestra Memoria Caché optimizada
let cachePartidos = { data: null, expiracion: 0 };
let cacheGrupos = { data: null, expiracion: 0 };
let cacheEquipos = { data: null, expiracion: 0 }; 

// Candados para evitar el "Efecto Estampida"
let peticionPartidosPendiente = null;

// 1. ENDPOINT PARTIDOS (60 segundos)
app.get('/api/partidos', async (req, res) => {
    const ahora = Date.now();
    
    if (cachePartidos.data && ahora < cachePartidos.expiracion) {
        return res.json(cachePartidos.data);
    }

    if (peticionPartidosPendiente) {
        const datos = await peticionPartidosPendiente;
        return res.json(datos);
    }

    try {
        peticionPartidosPendiente = fetch(`${API_BASE}/games`).then(r => r.json());
        const datos = await peticionPartidosPendiente;
        
        cachePartidos = { data: datos, expiracion: ahora + 60000 }; // 60 segundos
        peticionPartidosPendiente = null; 
        
        res.json(datos);
    } catch (error) {
        peticionPartidosPendiente = null;
        res.status(500).json({ error: 'Error al conectar con la API del Mundial' });
    }
});

// 2. ENDPOINT GRUPOS (10 minutos)
app.get('/api/grupos', async (req, res) => {
    const ahora = Date.now();
    if (cacheGrupos.data && ahora < cacheGrupos.expiracion) {
        return res.json(cacheGrupos.data);
    }

    try {
        const respuesta = await fetch(`${API_BASE}/groups`);
        const datos = await respuesta.json();
        cacheGrupos = { data: datos, expiracion: ahora + 600000 }; // 10 minutos
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'Error en la tabla de grupos' });
    }
});

// 3. ENDPOINT EQUIPOS (24 horas)
// La nueva API maneja los equipos globalmente, por lo que almacenamos todos y filtramos
app.get('/api/equipo/:id', async (req, res) => {
    const idEquipo = req.params.id;
    const ahora = Date.now();

    try {
        if (!cacheEquipos.data || ahora > cacheEquipos.expiracion) {
            const respuesta = await fetch(`${API_BASE}/teams`);
            const datos = await respuesta.json();
            // Adaptación por si la API devuelve el array directo o dentro de un objeto
            const teamsArray = Array.isArray(datos) ? datos : (datos.teams || datos.data || []);
            cacheEquipos = { data: teamsArray, expiracion: ahora + 86400000 }; // 24 horas
        }

        // Búsqueda flexible de ID
        const equipoEncontrado = cacheEquipos.data.find(eq => 
            String(eq.id) === String(idEquipo) || 
            String(eq._id) === String(idEquipo) || 
            String(eq.team_id) === String(idEquipo)
        );
        
        if (equipoEncontrado) {
            res.json(equipoEncontrado);
        } else {
            res.status(404).json({ error: 'Equipo no encontrado' });
        }

    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener la información del equipo' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor maestro corriendo en el puerto ${PORT}`);
});
