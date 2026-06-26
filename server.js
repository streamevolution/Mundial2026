const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// Conexión oficial a la API del Mundial 2026
const API_BASE = 'https://worldcup26.ir/get';

let cachePartidos = { data: null, expiracion: 0 };
let cacheGrupos = { data: null, expiracion: 0 };
let cacheEquipos = { data: null, expiracion: 0 }; 

// 1. ENDPOINT PARTIDOS (60 segundos)
app.get('/api/partidos', async (req, res) => {
    const ahora = Date.now();
    if (cachePartidos.data && ahora < cachePartidos.expiracion) return res.json(cachePartidos.data);

    try {
        const respuesta = await fetch(`${API_BASE}/games`);
        const datos = await respuesta.json();
        cachePartidos = { data: datos, expiracion: ahora + 60000 }; 
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'Error al conectar con partidos' });
    }
});

// 2. ENDPOINT GRUPOS (10 minutos)
app.get('/api/grupos', async (req, res) => {
    const ahora = Date.now();
    if (cacheGrupos.data && ahora < cacheGrupos.expiracion) return res.json(cacheGrupos.data);

    try {
        const respuesta = await fetch(`${API_BASE}/groups`);
        const datos = await respuesta.json();
        cacheGrupos = { data: datos, expiracion: ahora + 600000 }; 
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'Error en grupos' });
    }
});

// 3. NUEVO: ENDPOINT MAESTRO DE EQUIPOS (24 Horas)
// Indispensable para traducir los "Eq. 1" a nombres y banderas reales
app.get('/api/equipos', async (req, res) => {
    const ahora = Date.now();
    if (cacheEquipos.data && ahora < cacheEquipos.expiracion) return res.json(cacheEquipos.data);

    try {
        const respuesta = await fetch(`${API_BASE}/teams`);
        const datos = await respuesta.json();
        cacheEquipos = { data: datos, expiracion: ahora + 86400000 }; 
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: 'Error en diccionario de equipos' });
    }
});

// 4. ENDPOINT INDIVIDUAL (Por compatibilidad con el modal)
app.get('/api/equipo/:id', async (req, res) => {
    const idEquipo = req.params.id;
    const ahora = Date.now();
    try {
        if (!cacheEquipos.data || ahora > cacheEquipos.expiracion) {
            const respuesta = await fetch(`${API_BASE}/teams`);
            const datos = await respuesta.json();
            cacheEquipos = { data: datos, expiracion: ahora + 86400000 }; 
        }
        const dataArray = Array.isArray(cacheEquipos.data) ? cacheEquipos.data : (cacheEquipos.data.data || []);
        const eqInfo = dataArray.find(eq => String(eq.id) === String(idEquipo) || String(eq._id) === String(idEquipo) || String(eq.team_id) === String(idEquipo));
        
        res.json(eqInfo || { error: 'No encontrado' });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
