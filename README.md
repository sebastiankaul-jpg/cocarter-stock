# Co.Carter Stock

Base real del proyecto para administrar stock, producción y ventas de una fábrica de ropa de bebés.

## Qué incluye
- Next.js 15
- Supabase para base de datos y tiempo real
- Roles: administrador, vendedor, depósito
- Login por usuario y contraseña (tabla propia de ejemplo)
- Módulos: stock, producción, ventas, movimientos, reportes
- Exportación CSV

## 1. Instalar dependencias
```bash
npm install
```

## 2. Configurar variables
Crear un archivo `.env.local` con:
```env
NEXT_PUBLIC_SUPABASE_URL=TU_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_KEY
```

## 3. Crear base de datos
En Supabase, abrir el SQL Editor y ejecutar el archivo `supabase/schema.sql`.

## 4. Ejecutar localmente
```bash
npm run dev
```
Abrir `http://localhost:3000`

## 5. Usuario inicial sugerido
Después de correr el SQL, insertar un usuario administrador en la tabla `users` o usar el script SQL opcional incluido.

## 6. Publicar
Subir el proyecto a Vercel y agregar las mismas variables de entorno.

## Importante
Esta es una base funcional para seguir implementando. Antes de usarlo en producción conviene:
- activar autenticación real de Supabase Auth
- revisar políticas RLS
- agregar backups automáticos
- probar permisos por rol
