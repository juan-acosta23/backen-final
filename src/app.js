require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const handlebars = require('express-handlebars');
const path = require('path');

const database = require('./config/database');
const Product = require('./models/Product.model');
const Cart = require('./models/Cart.model');

const productsRouter = require('./routes/products');
const cartsRouter = require('./routes/carts');
const viewsRouter = require('./routes/views');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 8080;

// Configurar Handlebars con helpers personalizados
const hbs = handlebars.create({
    helpers: {
        eq: function(a, b) {
            return a === b;
        },
        gt: function(a, b) {
            return a > b;
        },
        lt: function(a, b) {
            return a < b;
        },
        multiply: function(a, b) {
            return (a * b).toFixed(2);
        },
        json: function(context) {
            return JSON.stringify(context);
        }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Hacer disponible io en toda la app
app.set('io', io);

// Rutas principales
app.use('/api/products', productsRouter);
app.use('/api/carts', cartsRouter);
app.use('/', viewsRouter);

// Ruta de status
app.get('/api/status', async (req, res) => {
    try {
        const productsCount = await Product.countDocuments();
        const cartsCount = await Cart.countDocuments();
        const dbHealth = await database.healthCheck();

        res.json({
            status: 'success',
            payload: {
                server: 'running',
                database: dbHealth.status,
                timestamp: new Date().toISOString(),
                productsCount,
                cartsCount,
                endpoints: {
                    products: '/api/products',
                    carts: '/api/carts',
                    productsView: '/products',
                    cartView: '/carts/:cid',
                    productDetail: '/products/:pid',
                    realtime: '/realtimeproducts',
                    status: '/api/status'
                }
            },
            message: `Servidor funcionando correctamente. ${productsCount} productos y ${cartsCount} carritos en la base de datos.`
        });
    } catch (error) {
        console.error('Error en /api/status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error verificando estado del servidor'
        });
    }
});

// WebSocket
io.on('connection', async (socket) => {
    console.log('🔌 Nuevo cliente conectado:', socket.id);

    // Enviar lista inicial de productos al conectarse
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        socket.emit('products', products);
    } catch (error) {
        console.error('Error enviando productos iniciales:', error);
    }

    // Escuchar evento para agregar producto
    socket.on('addProduct', async (productData) => {
        try {
            const newProduct = new Product(productData);
            await newProduct.save();

            // Emitir a todos los clientes la lista actualizada
            const products = await Product.find().sort({ createdAt: -1 }).lean();
            io.emit('products', products);

            socket.emit('productAdded', {
                success: true,
                message: 'Producto agregado exitosamente',
                product: newProduct
            });
        } catch (error) {
            const errorMessage = error.name === 'ValidationError'
                ? Object.values(error.errors).map(err => err.message).join(', ')
                : error.message || 'Error al agregar producto';

            socket.emit('productError', {
                success: false,
                message: errorMessage
            });
        }
    });

    // Escuchar evento para eliminar producto
    socket.on('deleteProduct', async (productId) => {
        try {
            const deletedProduct = await Product.findByIdAndDelete(productId);

            if (!deletedProduct) {
                socket.emit('productError', {
                    success: false,
                    message: 'Producto no encontrado'
                });
                return;
            }

            // Emitir a todos los clientes la lista actualizada
            const products = await Product.find().sort({ createdAt: -1 }).lean();
            io.emit('products', products);

            socket.emit('productDeleted', {
                success: true,
                message: 'Producto eliminado exitosamente',
                product: deletedProduct
            });
        } catch (error) {
            socket.emit('productError', {
                success: false,
                message: error.message || 'Error al eliminar producto'
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Ruta ${req.originalUrl} no encontrada`
    });
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error('❌ Error no manejado:', error);
    res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Datos de ejemplo para inicializar la BD
const SAMPLE_PRODUCTS = [
    {
        title: "MacBook Pro 16",
        description: "Laptop profesional Apple con chip M3 Pro, 18GB RAM, 512GB SSD. Perfecta para desarrollo y diseño profesional.",
        code: "APPLE-MBP-001",
        price: 2499.99,
        status: true,
        stock: 15,
        category: "Laptops",
        thumbnails: ["macbook-pro-space-black.jpg", "macbook-pro-silver.jpg"]
    },
    {
        title: "Samsung Galaxy S24 Ultra",
        description: "Smartphone Android premium con cámara de 200MP, S Pen incluido y pantalla Dynamic AMOLED 2X.",
        code: "SAMSUNG-S24-ULTRA",
        price: 1299.99,
        status: true,
        stock: 25,
        category: "Smartphones",
        thumbnails: ["galaxy-s24-ultra-titanium.jpg"]
    },
    {
        title: "Sony WH-1000XM5",
        description: "Auriculares inalámbricos premium con cancelación de ruido adaptativa y hasta 30 horas de batería.",
        code: "SONY-WH-1000XM5",
        price: 349.99,
        status: true,
        stock: 40,
        category: "Audio",
        thumbnails: ["sony-wh1000xm5-black.jpg"]
    },
    {
        title: "iPad Air M2",
        description: "Tablet Apple con chip M2, pantalla Liquid Retina de 10.9 pulgadas. Ideal para creativos.",
        code: "APPLE-IPAD-AIR-M2",
        price: 699.99,
        status: true,
        stock: 30,
        category: "Tablets",
        thumbnails: ["ipad-air-blue.jpg"]
    },
    {
        title: "Nintendo Switch OLED",
        description: "Consola de videojuegos híbrida con pantalla OLED de 7 pulgadas y audio mejorado.",
        code: "NINTENDO-SWITCH-OLED",
        price: 349.99,
        status: true,
        stock: 50,
        category: "Gaming",
        thumbnails: ["switch-oled-white.jpg"]
    },
    {
        title: "Dell XPS 13",
        description: "Ultrabook premium con Intel Core i7 de 13ª generación, 16GB RAM y pantalla InfinityEdge.",
        code: "DELL-XPS-13-2024",
        price: 1199.99,
        status: true,
        stock: 20,
        category: "Laptops",
        thumbnails: ["dell-xps13-platinum.jpg"]
    },
    {
        title: "AirPods Pro 2",
        description: "Auriculares inalámbricos Apple con cancelación activa de ruido y audio espacial adaptativo.",
        code: "APPLE-AIRPODS-PRO-2",
        price: 249.99,
        status: true,
        stock: 60,
        category: "Audio",
        thumbnails: ["airpods-pro-2.jpg"]
    },
    {
        title: "Google Pixel 8 Pro",
        description: "Smartphone con cámara avanzada impulsada por IA, pantalla OLED de 6.7 pulgadas y 120Hz.",
        code: "GOOGLE-PIXEL-8-PRO",
        price: 999.99,
        status: true,
        stock: 35,
        category: "Smartphones",
        thumbnails: ["pixel-8-pro-black.jpg"]
    },
    {
        title: "Logitech MX Master 3S",
        description: "Mouse ergonómico profesional con 8K DPI, desplazamiento silencioso y hasta 70 días de batería.",
        code: "LOGITECH-MX-MASTER-3S",
        price: 99.99,
        status: true,
        stock: 45,
        category: "Accesorios",
        thumbnails: ["mx-master-3s-black.jpg"]
    },
    {
        title: "Samsung 49\" Odyssey G9",
        description: "Monitor gaming curvo ultrawide QLED de 49 pulgadas, 240Hz, 1ms y resolución 5K.",
        code: "SAMSUNG-ODYSSEY-G9",
        price: 1499.99,
        status: true,
        stock: 10,
        category: "Monitores",
        thumbnails: ["odyssey-g9.jpg"]
    }
];

// Inicializar datos de ejemplo
async function initializeSampleData() {
    try {
        const productsCount = await Product.countDocuments();

        if (productsCount === 0) {
            await Product.insertMany(SAMPLE_PRODUCTS);
            console.log('📦 Productos de ejemplo cargados en MongoDB');
        }

        const cartsCount = await Cart.countDocuments();
        if (cartsCount === 0) {
            const cart = new Cart();
            await cart.save();
            console.log('🛒 Carrito de ejemplo creado en MongoDB');
            console.log(`   ID del carrito: ${cart._id}`);
        }
    } catch (error) {
        console.error('❌ Error inicializando datos:', error.message);
    }
}

// Iniciar servidor
async function startServer() {
    try {
        // Conectar a MongoDB
        await database.connect();

        // Inicializar datos de ejemplo
        await initializeSampleData();

        httpServer.listen(PORT, () => {
            console.log('\n' + '='.repeat(60));
            console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
            console.log('='.repeat(60));
            console.log('\n📍 ENDPOINTS DISPONIBLES:');
            console.log(`   • API Productos: http://localhost:${PORT}/api/products`);
            console.log(`   • API Carritos:  http://localhost:${PORT}/api/carts`);
            console.log(`   • Status:        http://localhost:${PORT}/api/status`);
            console.log('\n🌐 VISTAS WEB:');
            console.log(`   • Productos:     http://localhost:${PORT}/products`);
            console.log(`   • Tiempo Real:   http://localhost:${PORT}/realtimeproducts`);
            console.log(`   • Carrito:       http://localhost:${PORT}/carts/[ID]`);
            console.log('\n💡 EJEMPLOS DE USO:');
            console.log(`   • Paginación:    http://localhost:${PORT}/api/products?page=1&limit=5`);
            console.log(`   • Filtros:       http://localhost:${PORT}/api/products?category=Laptops&sort=asc`);
            console.log(`   • Búsqueda:      http://localhost:${PORT}/api/products?query=apple`);
            console.log('\n' + '='.repeat(60) + '\n');
        });
    } catch (error) {
        console.error('❌ Error fatal iniciando servidor:', error.message);
        console.error('\n💡 Posibles soluciones:');
        console.error('   1. Verifica que MongoDB esté ejecutándose');
        console.error('   2. Revisa la variable MONGODB_URI en .env');
        console.error('   3. Si usas MongoDB Atlas, verifica las credenciales\n');
        process.exit(1);
    }
}

startServer();