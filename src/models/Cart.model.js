const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    products: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'La cantidad debe ser mayor a 0'],
            default: 1
        }
    }]
}, {
    timestamps: true,
    versionKey: false
});

// Método para agregar producto al carrito
cartSchema.methods.addProduct = async function(productId, quantity = 1) {
    const Product = mongoose.model('Product');
    
    // Verificar que el producto existe
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error(`Producto con ID ${productId} no encontrado`);
    }

    // Verificar disponibilidad
    if (!product.status || product.stock < quantity) {
        throw new Error(`Producto no disponible. Stock disponible: ${product.stock}`);
    }

    // Buscar si el producto ya existe en el carrito
    const existingProductIndex = this.products.findIndex(
        item => item.product.toString() === productId.toString()
    );

    if (existingProductIndex !== -1) {
        // Si existe, actualizar cantidad
        const newQuantity = this.products[existingProductIndex].quantity + quantity;
        if (product.stock < newQuantity) {
            throw new Error(`Stock insuficiente. Disponible: ${product.stock}, solicitado: ${newQuantity}`);
        }
        this.products[existingProductIndex].quantity = newQuantity;
    } else {
        // Si no existe, agregarlo
        this.products.push({
            product: productId,
            quantity
        });
    }

    return await this.save();
};

// Método para eliminar producto del carrito
cartSchema.methods.removeProduct = async function(productId) {
    const productIndex = this.products.findIndex(
        item => item.product.toString() === productId.toString()
    );

    if (productIndex === -1) {
        throw new Error(`Producto con ID ${productId} no encontrado en el carrito`);
    }

    this.products.splice(productIndex, 1);
    return await this.save();
};

// Método para actualizar cantidad de un producto
cartSchema.methods.updateProductQuantity = async function(productId, quantity) {
    const Product = mongoose.model('Product');
    
    if (quantity < 1) {
        throw new Error('La cantidad debe ser mayor a 0');
    }

    const productIndex = this.products.findIndex(
        item => item.product.toString() === productId.toString()
    );

    if (productIndex === -1) {
        throw new Error(`Producto con ID ${productId} no encontrado en el carrito`);
    }

    // Verificar stock disponible
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error(`Producto con ID ${productId} no encontrado`);
    }

    if (!product.status || product.stock < quantity) {
        throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }

    this.products[productIndex].quantity = quantity;
    return await this.save();
};

// Método para actualizar el carrito completo
cartSchema.methods.updateCart = async function(productsArray) {
    const Product = mongoose.model('Product');

    // Validar que productsArray sea un array válido
    if (!Array.isArray(productsArray)) {
        throw new Error('El campo products debe ser un array');
    }

    // Validar estructura de cada producto
    for (const item of productsArray) {
        if (!item.product || !item.quantity) {
            throw new Error('Cada producto debe tener product y quantity');
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
            throw new Error('La cantidad debe ser un número mayor a 0');
        }

        // Verificar que el producto existe y tiene stock
        const product = await Product.findById(item.product);
        if (!product) {
            throw new Error(`Producto con ID ${item.product} no encontrado`);
        }
        if (!product.status || product.stock < item.quantity) {
            throw new Error(`Producto ${product.title} no disponible. Stock: ${product.stock}`);
        }
    }

    // Actualizar el carrito
    this.products = productsArray.map(item => ({
        product: item.product,
        quantity: item.quantity
    }));

    return await this.save();
};

// Método para vaciar el carrito
cartSchema.methods.clearCart = async function() {
    this.products = [];
    return await this.save();
};

// Virtual: Calcular total del carrito
cartSchema.virtual('total').get(function() {
    if (!this.populated('products.product')) {
        return 0;
    }
    return this.products.reduce((sum, item) => {
        if (item.product && item.product.price) {
            return sum + (item.product.price * item.quantity);
        }
        return sum;
    }, 0);
});

// Virtual: Cantidad total de productos
cartSchema.virtual('totalItems').get(function() {
    return this.products.reduce((sum, item) => sum + item.quantity, 0);
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;

