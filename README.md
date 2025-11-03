# E-commerce API con MongoDB

Proyecto final de backend usando Node.js, Express, MongoDB y Handlebars. Es una API para gestionar productos y carritos de compras con paginación, filtros y vistas web.

## Cómo instalar y ejecutar

1. Clonar el repositorio:
```
git clone https://github.com/juan-acosta23/backen-final.git
cd backen-final
```

2. Instalar las dependencias:
```
npm install
```

3. Crear archivo `.env` en la raíz:
```
MONGODB_URI=mongodb://localhost:27017/ecommerce
PORT=8080
NODE_ENV=development
```

Si usas MongoDB Atlas, la URI sería algo como:
```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/ecommerce
```

4. Ejecutar el servidor:
```
npm run dev    # Para desarrollo (con nodemon)
npm start      # Para producción
```

## Endpoints de la API

### Productos

**GET /api/products**
Lista productos con paginación y filtros.

Query parameters:
- `limit`: cantidad de productos por página (default: 10)
- `page`: número de página (default: 1)
- `sort`: ordenamiento por precio - `asc` o `desc`
- `query`: filtro por categoría o disponibilidad
- `category`: filtrar por categoría específica
- `status`: filtrar por disponibilidad (true/false)

Ejemplos:
```
GET /api/products?page=1&limit=5&sort=asc
GET /api/products?category=Laptops&sort=desc
GET /api/products?query=true&page=2
```

La respuesta tiene esta estructura:
```json
{
  "status": "success",
  "payload": [...],
  "totalPages": 5,
  "prevPage": null,
  "nextPage": 2,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevLink": null,
  "nextLink": "/api/products?page=2&limit=10"
}
```

**GET /api/products/:pid**
Obtiene un producto por su ID.

**POST /api/products**
Crea un nuevo producto.

**PUT /api/products/:pid**
Actualiza un producto.

**DELETE /api/products/:pid**
Elimina un producto.

### Carritos

**GET /api/carts/:cid**
Obtiene un carrito con todos sus productos (usa populate para traer los datos completos de cada producto).

**POST /api/carts**
Crea un carrito vacío.

**POST /api/carts/:cid/product/:pid**
Agrega un producto al carrito.

**DELETE /api/carts/:cid/products/:pid**
Elimina un producto específico del carrito.

**PUT /api/carts/:cid**
Actualiza todos los productos del carrito. Hay que enviar un array de productos en el body:
```json
{
  "products": [
    { "product": "productId1", "quantity": 2 },
    { "product": "productId2", "quantity": 1 }
  ]
}
```

**PUT /api/carts/:cid/products/:pid**
Actualiza solo la cantidad de un producto específico:
```json
{
  "quantity": 5
}
```

**DELETE /api/carts/:cid**
Vacía el carrito (elimina todos los productos).

## Vistas Web

**/products**
Vista principal donde se muestran todos los productos con paginación. Permite filtrar por categoría o disponibilidad, ordenar por precio, agregar productos al carrito y ver el detalle de cada producto.

**/products/:pid**
Vista de detalle de un producto específico. Muestra toda la información, precio, stock, categoría, y tiene un botón para agregar al carrito con selección de cantidad.

**/carts/:cid**
Vista del carrito que muestra todos los productos que tiene ese carrito específico, con sus cantidades, subtotales y el total. Permite eliminar productos individuales o vaciar todo el carrito.

**/realtimeproducts**
Vista que usa WebSockets para actualizar los productos en tiempo real cuando se agregan o eliminan.

## Requisitos cumplidos

### Productos
- GET /api/products con paginación
- Query params: limit, page, sort (asc/desc), query
- Búsqueda por categoría y disponibilidad
- Ordenamiento por precio
- Respuesta con toda la estructura requerida (status, payload, totalPages, prevPage, nextPage, hasPrevPage, hasNextPage, prevLink, nextLink)

### Carritos
- DELETE /api/carts/:cid/products/:pid - Elimina un producto del carrito
- PUT /api/carts/:cid - Actualiza todos los productos del carrito
- PUT /api/carts/:cid/products/:pid - Actualiza solo la cantidad de un producto
- DELETE /api/carts/:cid - Vacía el carrito
- Modelo Carts con referencia a Products usando populate
- GET /api/carts/:cid trae los productos completos con populate

### Vistas
- Vista /products con paginación y filtros
- Vista /products/:pid con detalle completo y botón para agregar al carrito
- Botón "agregar al carrito" directamente en la lista de productos
- Vista /carts/:cid que muestra solo los productos de ese carrito

## Scripts

```
npm start      # Inicia el servidor
npm run dev    # Modo desarrollo con nodemon
npm test       # Tests (aún no implementados)
```

## Notas

- El proyecto puede usar MongoDB Atlas o MongoDB local según lo que pongas en el .env
- Los carritos guardan referencias a los productos, no copias de los datos
- Al iniciar el servidor por primera vez, se cargan algunos productos de ejemplo
- El carrito se guarda en localStorage del navegador

## Autor

Juan Acosta
GitHub: juan-acosta23

---
Proyecto Final - Backend con MongoDB
