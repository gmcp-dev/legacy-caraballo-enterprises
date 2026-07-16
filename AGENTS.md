# LEGACY Caraballo Enterprises

## Proyecto
Sistema de gestion interno para la empresa LEGACY Caraballo Enterprises en el servidor ROCKFORD de GTA V Roleplay.

## Stack
- **Frontend:** React 19 + Vite + React Router
- **Backend:** Express + better-sqlite3
- **Base de datos:** SQLite (server/legacy.db)

## Ejecucion
```bash
npm start          # Inicia backend (puerto 3001) y frontend (puerto 5173)
npm run server     # Solo backend
npm run dev        # Solo frontend
```

## Estructura
```
src/
├── components/     # Sidebar, Header
├── pages/          # Dashboard, Projects, ProjectDetail, GranjasEden, FarmDetail, Partners, Investors, Finance
├── styles/         # index.css (tema global)
server/
├── db.js           # Schema y conexion SQLite
├── routes.js       # API REST
├── index.js        # Servidor Express
```

## Tema visual
- Fondo negro oscuro (#0a0a0a), dorado (#c9a84c)
- Tipografia: Cinzel (titulos), Inter (cuerpo)
- Textura de ruido sutil en overlay
- user-select: none global, inputs son seleccionables
- Imagenes con user-drag: none

## Base de datos
- **projects** → id, name, description, status, created_at
- **partners** → id, project_id, name, role, since, status
- **transactions** → id, project_id, type (investment|earning|expense), amount, description, date
- **farms** → id, project_id, name, owner, logo, status, created_at
- **farm_inventory** → id, farm_id, product (milk|beef|pork|eggs|chicken), quantity
- **farm_transactions** → id, farm_id, type (sale|purchase|expense), product, quantity, amount, description, date

## API
Los endpoints usan slugs de nombre para proyectos: `/api/projects/granjas-eden`

## Convenciones
- No agregar dependencias innecesarias
- Colores CSS via variables en :root
- Componentes funcionales con hooks
- Formato de moneda: USD con Intl.NumberFormat
