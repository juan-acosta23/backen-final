const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

// POST /api/carts/ - Crear nuevo carrito
router.post('/', async (req, res) => {
    try {
        const newCart = new Cart();
        await newCart.save();

        res.status(201).json({
            status: 'success',
            payload: newCart,
            message: 'Carrito creado exitosamente'
        });
    } catch (error) {
        console.error('Error creando carrito:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al crear el carrito'
        });
    }
});

// GET /api/carts/:cid - Obtener carrito con populate de productos
router.get('/:cid', async (req, res) => {
    try {
        const { cid } = req.params;

        const cart = await Cart.findById(cid).populate('products.product');

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        res.json({
            status: 'success',
            payload: cart,
            message: cart.products.length > 0
                ? 'Productos del carrito obtenidos exitosamente'
                : 'El carrito está vacío'
        });
    } catch (error) {
        console.error('Error obteniendo carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito inválido'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al obtener el carrito'
        });
    }
});

// POST /api/carts/:cid/product/:pid - Agregar producto al carrito
router.post('/:cid/product/:pid', async (req, res) => {
    try {
        const { cid, pid } = req.params;
        const quantity = parseInt(req.body.quantity) || 1;

        // Validar quantity
        if (quantity < 1 || !Number.isInteger(quantity)) {
            return res.status(400).json({
                status: 'error',
                message: 'La cantidad debe ser un número entero mayor a 0'
            });
        }

        const cart = await Cart.findById(cid);

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        // Usar método del modelo
        await cart.addProduct(pid, quantity);

        // Populate para devolver el carrito con productos completos
        await cart.populate('products.product');

        res.json({
            status: 'success',
            payload: cart,
            message: 'Producto agregado al carrito exitosamente'
        });
    } catch (error) {
        console.error('Error agregando producto al carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito o producto inválido'
            });
        }

        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// DELETE /api/carts/:cid/products/:pid - Eliminar producto del carrito
router.delete('/:cid/products/:pid', async (req, res) => {
    try {
        const { cid, pid } = req.params;

        const cart = await Cart.findById(cid);

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        await cart.removeProduct(pid);
        await cart.populate('products.product');

        res.json({
            status: 'success',
            payload: cart,
            message: 'Producto eliminado del carrito exitosamente'
        });
    } catch (error) {
        console.error('Error eliminando producto del carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito o producto inválido'
            });
        }

        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// PUT /api/carts/:cid - Actualizar carrito completo
router.put('/:cid', async (req, res) => {
    try {
        const { cid } = req.params;
        const { products } = req.body;

        if (!Array.isArray(products)) {
            return res.status(400).json({
                status: 'error',
                message: 'El campo products debe ser un array'
            });
        }

        const cart = await Cart.findById(cid);

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        await cart.updateCart(products);
        await cart.populate('products.product');

        res.json({
            status: 'success',
            payload: cart,
            message: 'Carrito actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error actualizando carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito inválido'
            });
        }

        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// PUT /api/carts/:cid/products/:pid - Actualizar cantidad de producto
router.put('/:cid/products/:pid', async (req, res) => {
    try {
        const { cid, pid } = req.params;
        const { quantity } = req.body;

        if (quantity === undefined || !Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'La cantidad debe ser un número entero mayor a 0'
            });
        }

        const cart = await Cart.findById(cid);

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        await cart.updateProductQuantity(pid, quantity);
        await cart.populate('products.product');

        res.json({
            status: 'success',
            payload: cart,
            message: 'Cantidad de producto actualizada exitosamente'
        });
    } catch (error) {
        console.error('Error actualizando cantidad:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito o producto inválido'
            });
        }

        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// DELETE /api/carts/:cid - Vaciar carrito
router.delete('/:cid', async (req, res) => {
    try {
        const { cid } = req.params;

        const cart = await Cart.findById(cid);

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: `Carrito con ID ${cid} no encontrado`
            });
        }

        await cart.clearCart();

        res.json({
            status: 'success',
            payload: cart,
            message: 'Todos los productos fueron eliminados del carrito'
        });
    } catch (error) {
        console.error('Error vaciando carrito:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'error',
                message: 'ID de carrito inválido'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor al vaciar el carrito'
        });
    }
});

module.exports = router;