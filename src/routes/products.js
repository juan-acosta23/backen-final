const express = require('express');
const router = express.Router();
const Product = require('../models/Product.model');

// GET /api/products/ - Listar productos con paginación profesional
router.get('/', async (req, res) => {
    try {
        // Parámetros de query con valores por defecto
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const sort = req.query.sort;
        const query = req.query.query;
        const category = req.query.category;
        const status = req.query.status;

        // Construir filtro de búsqueda
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
            lean: true, // Retorna objetos planos JS (más rápido)
            customLabels: {
                docs: 'payload',
                totalDocs: 'totalDocs',
                limit: 'limit',
                page: 'page',
                totalPages: 'totalPages',
                pagingCounter: 'pagingCounter',
                hasPrevPage: 'hasPrevPage',
                hasNextPage: 'hasNextPage',
                prevPage: 'prevPage',
                nextPage: 'nextPage'
            }
        };

        // Ordenamiento por precio
        // Solo ordenar si se especifica sort (asc/desc)
        if (sort === 'asc') {
            options.sort = { price: 1 };
        } else if (sort === 'desc') {
            options.sort = { price: -1 };
        }
        // Si no hay sort, no se ordena (según consignas)

        // Ejecutar paginación
        const result = await Product.paginate(filter, options);

        // Construir query string para links de navegación
        const buildQueryString = (pageNum) => {
            const params = new URLSearchParams();
            params.append('page', pageNum);
            if (limit !== 10) params.append('limit', limit);
            if (sort) params.append('sort', sort);
            if (query) params.append('query', query);
            if (category) params.append('category', category);
            if (status !== undefined) params.append('status', status);
            return params.toString();
        };

        // Construir links de navegación
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
        const prevLink = result.hasPrevPage ? `${baseUrl}?${buildQueryString(result.prevPage)}` : null;
        const nextLink = result.hasNextPage ? `${baseUrl}?${buildQueryString(result.nextPage)}` : null;

        // Respuesta exitosa con estructura requerida
        res.json({
            status: 'success',
            payload: result.payload,
            totalPages: result.totalPages,
            prevPage: result.prevPage,
            nextPage: result.nextPage,
            page: result.page,
            hasPrevPage: result.hasPrevPage,
            hasNextPage: result.hasNextPage,
            prevLink,
            nextLink,
            totalDocs: result.totalDocs
        });
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al obtener productos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/products/:pid - Obtener producto por ID
router.get('/:pid', async (req, res) => {
    try {
        const { pid } = req.params;

        const product = await Product.findById(pid);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: `Producto con ID ${pid} no encontrado`
            });
        }

        res.json({
            status: 'success',
            payload: product,
            message: 'Producto obtenido exitosamente'
        });
    } catch (error) {
        console.error('Error obteniendo producto:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de producto inválido'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al obtener el producto'
        });
    }
});

// POST /api/products/ - Crear nuevo producto
router.post('/', async (req, res) => {
    try {
        const io = req.app.get('io');

        const newProduct = new Product(req.body);
        await newProduct.save();

        // Emitir actualización por WebSocket
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        io.emit('products', products);

        res.status(201).json({
            status: 'success',
            payload: newProduct,
            message: 'Producto creado exitosamente'
        });
    } catch (error) {
        console.error('Error creando producto:', error);

        // Errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                status: 'error',
                message: 'Datos de producto inválidos',
                errors
            });
        }

        // Error de código duplicado
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: `Ya existe un producto con el código ${req.body.code}`
            });
        }

        // Otros errores
        res.status(500).json({
            status: 'error',
            message: error.message || 'Error interno del servidor al crear el producto'
        });
    }
});

// PUT /api/products/:pid - Actualizar producto
router.put('/:pid', async (req, res) => {
    try {
        const { pid } = req.params;
        const io = req.app.get('io');

        // No permitir actualizar el ID ni timestamps
        delete req.body._id;
        delete req.body.createdAt;
        delete req.body.updatedAt;

        const updatedProduct = await Product.findByIdAndUpdate(
            pid,
            req.body,
            {
                new: true, // Retorna el documento actualizado
                runValidators: true // Ejecuta validaciones del esquema
            }
        );

        if (!updatedProduct) {
            return res.status(404).json({
                status: 'error',
                message: `Producto con ID ${pid} no encontrado`
            });
        }

        // Emitir actualización por WebSocket
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        io.emit('products', products);

        res.json({
            status: 'success',
            payload: updatedProduct,
            message: 'Producto actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error actualizando producto:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de producto inválido'
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                status: 'error',
                message: 'Datos de actualización inválidos',
                errors
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'El código de producto ya existe'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al actualizar el producto'
        });
    }
});

// DELETE /api/products/:pid - Eliminar producto
router.delete('/:pid', async (req, res) => {
    try {
        const { pid } = req.params;
        const io = req.app.get('io');

        const deletedProduct = await Product.findByIdAndDelete(pid);

        if (!deletedProduct) {
            return res.status(404).json({
                status: 'error',
                message: `Producto con ID ${pid} no encontrado`
            });
        }

        // Emitir actualización por WebSocket
        const products = await Product.find().sort({ createdAt: -1 }).lean();
        io.emit('products', products);

        res.json({
            status: 'success',
            payload: deletedProduct,
            message: 'Producto eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error eliminando producto:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de producto inválido'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al eliminar el producto'
        });
    }
});

module.exports = router;