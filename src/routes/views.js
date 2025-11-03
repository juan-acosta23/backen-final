const express = require('express');
const router = express.Router();
const Product = require('../models/Product.model');
const Cart = require('../models/Cart.model');

// GET / - Redirigir a /products
router.get('/', (req, res) => {
    res.redirect('/products');
});

// GET /products - Vista de productos con paginación y filtros
router.get('/products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const sort = req.query.sort;
        const query = req.query.query;
        const category = req.query.category;
        const status = req.query.status;

        // Construir filtro
        const filter = {};
        
        // Filtro por categoría (prioridad a category si existe)
        if (category) {
            filter.category = category.trim();
        }

        // Filtro por disponibilidad (prioridad a status si existe)
        if (status !== undefined) {
            filter.status = status === 'true' || status === '1' || status === 'yes';
        }

        // Si hay query pero no category ni status, usar query como filtro
        // query puede ser una categoría o disponibilidad (true/false)
        if (query && !category && status === undefined) {
            const queryLower = query.trim().toLowerCase();
            
            // Verificar si es un valor de disponibilidad
            if (queryLower === 'true' || queryLower === 'false' || queryLower === 'disponible' || queryLower === 'no disponible') {
                filter.status = queryLower === 'true' || queryLower === 'disponible';
            } else {
                // Si no, asumir que es una categoría
                filter.category = query.trim();
            }
        }

        // Opciones de paginación
        const options = {
            page,
            limit,
            lean: true
        };

        // Ordenamiento
        if (sort === 'asc') {
            options.sort = { price: 1 };
        } else if (sort === 'desc') {
            options.sort = { price: -1 };
        }
        // Si no hay sort, no se ordena (según consignas)

        // Ejecutar paginación
        const result = await Product.paginate(filter, options);

        // Construir query params para los links
        const buildQueryParams = (pageNum) => {
            const params = new URLSearchParams();
            params.append('page', pageNum);
            if (limit !== 10) params.append('limit', limit);
            if (sort) params.append('sort', sort);
            if (query) params.append('query', query);
            if (category) params.append('category', category);
            if (status !== undefined) params.append('status', status);
            return params.toString();
        };

        const prevLink = result.hasPrevPage ? `/products?${buildQueryParams(result.prevPage)}` : null;
        const nextLink = result.hasNextPage ? `/products?${buildQueryParams(result.nextPage)}` : null;

        // Obtener todas las categorías únicas
        const categories = await Product.distinct('category');

        res.render('products', {
            title: 'Productos',
            products: result.docs,
            hasProducts: result.docs.length > 0,
            page: result.page,
            totalPages: result.totalPages,
            hasPrevPage: result.hasPrevPage,
            hasNextPage: result.hasNextPage,
            prevPage: result.prevPage,
            nextPage: result.nextPage,
            prevLink,
            nextLink,
            categories,
            currentCategory: category || '',
            currentSort: sort || '',
            currentStatus: status || '',
            currentQuery: query || '',
            limit
        });
    } catch (error) {
        console.error('Error cargando vista de productos:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Error al cargar los productos'
        });
    }
});

// GET /products/:pid - Vista de detalle de producto
router.get('/products/:pid', async (req, res) => {
    try {
        const { pid } = req.params;
        const product = await Product.findById(pid).lean();

        if (!product) {
            return res.status(404).render('error', {
                title: 'Producto no encontrado',
                message: `El producto con ID ${pid} no existe`
            });
        }

        res.render('productDetail', {
            title: product.title,
            product
        });
    } catch (error) {
        console.error('Error cargando detalle del producto:', error);

        if (error.name === 'CastError') {
            return res.status(400).render('error', {
                title: 'ID inválido',
                message: 'El ID del producto no es válido'
            });
        }

        res.status(500).render('error', {
            title: 'Error',
            message: 'Error al cargar el detalle del producto'
        });
    }
});

// GET /carts/:cid - Vista de carrito específico
router.get('/carts/:cid', async (req, res) => {
    try {
        const { cid } = req.params;

        const cart = await Cart.findById(cid).populate('products.product').lean();

        if (!cart) {
            return res.status(404).render('error', {
                title: 'Carrito no encontrado',
                message: `El carrito con ID ${cid} no existe`
            });
        }

        // Calcular subtotales y total
        const productsWithSubtotal = cart.products
            .filter(item => item.product) // Filtrar productos eliminados
            .map(item => ({
                ...item.product,
                _id: item.product._id,
                quantity: item.quantity,
                subtotal: (item.product.price * item.quantity).toFixed(2)
            }));

        const total = productsWithSubtotal.reduce(
            (sum, p) => sum + parseFloat(p.subtotal),
            0
        ).toFixed(2);

        res.render('cart', {
            title: `Carrito`,
            cartId: cid,
            products: productsWithSubtotal,
            hasProducts: productsWithSubtotal.length > 0,
            total
        });
    } catch (error) {
        console.error('Error cargando vista del carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).render('error', {
                title: 'ID inválido',
                message: 'El ID del carrito no es válido'
            });
        }

        res.status(500).render('error', {
            title: 'Error',
            message: 'Error al cargar el carrito'
        });
    }
});

// GET /realtimeproducts - Vista con actualización en tiempo real
router.get('/realtimeproducts', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }).lean();

        res.render('realTimeProducts', {
            title: 'Productos en Tiempo Real',
            products: products,
            hasProducts: products.length > 0
        });
    } catch (error) {
        console.error('Error cargando vista realTimeProducts:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Error al cargar los productos'
        });
    }
});

module.exports = router;