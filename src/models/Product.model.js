const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'El título es requerido'],
        trim: true,
        minlength: [3, 'El título debe tener al menos 3 caracteres'],
        maxlength: [200, 'El título no puede exceder 200 caracteres']
    },
    description: {
        type: String,
        required: [true, 'La descripción es requerida'],
        trim: true,
        minlength: [10, 'La descripción debe tener al menos 10 caracteres'],
        maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
    },
    code: {
        type: String,
        required: [true, 'El código es requerido'],
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
        match: [/^[A-Z0-9-]+$/, 'El código solo puede contener letras mayúsculas, números y guiones']
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio debe ser mayor o igual a 0'],
        validate: {
            validator: function(value) {
                return !isNaN(value) && isFinite(value);
            },
            message: 'El precio debe ser un número válido'
        }
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    },
    stock: {
        type: Number,
        required: [true, 'El stock es requerido'],
        min: [0, 'El stock debe ser mayor o igual a 0'],
        validate: {
            validator: Number.isInteger,
            message: 'El stock debe ser un número entero'
        }
    },
    category: {
        type: String,
        required: [true, 'La categoría es requerida'],
        trim: true,
        index: true,
        minlength: [2, 'La categoría debe tener al menos 2 caracteres']
    },
    thumbnails: {
        type: [String],
        default: [],
        validate: {
            validator: function(arr) {
                return arr.every(item => typeof item === 'string');
            },
            message: 'Todos los thumbnails deben ser strings'
        }
    }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Plugin de paginación
productSchema.plugin(mongoosePaginate);

// Índices compuestos para optimizar consultas
productSchema.index({ category: 1, status: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1, status: 1 });
productSchema.index({ title: 'text', description: 'text' });

// Virtual: Verificar disponibilidad
productSchema.virtual('available').get(function() {
    return this.status && this.stock > 0;
});

// Virtual: Precio formateado
productSchema.virtual('priceFormatted').get(function() {
    return `$${this.price.toFixed(2)}`;
});

// Método de instancia: Decrementar stock
productSchema.methods.decrementStock = async function(quantity) {
    if (quantity <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
    }
    if (this.stock < quantity) {
        throw new Error(`Stock insuficiente. Disponible: ${this.stock}, solicitado: ${quantity}`);
    }
    this.stock -= quantity;
    return await this.save();
};

// Método de instancia: Incrementar stock
productSchema.methods.incrementStock = async function(quantity) {
    if (quantity <= 0) {
        throw new Error('La cantidad debe ser mayor a 0');
    }
    this.stock += quantity;
    return await this.save();
};

// Método de instancia: Verificar disponibilidad con cantidad
productSchema.methods.hasStock = function(quantity) {
    return this.status && this.stock >= quantity;
};

// Método estático: Buscar por código
productSchema.statics.findByCode = function(code) {
    return this.findOne({ code: code.toUpperCase() });
};

// Método estático: Productos disponibles
productSchema.statics.findAvailable = function() {
    return this.find({ status: true, stock: { $gt: 0 } });
};

// Método estático: Productos por categoría
productSchema.statics.findByCategory = function(category) {
    return this.find({ category: category });
};

// Middleware pre-save: Validar código único
productSchema.pre('save', async function(next) {
    if (this.isModified('code')) {
        const existingProduct = await this.constructor.findOne({
            code: this.code,
            _id: { $ne: this._id }
        });
        if (existingProduct) {
            throw new Error(`Ya existe un producto con el código ${this.code}`);
        }
    }
    next();
});

// Middleware pre-save: Normalizar datos
productSchema.pre('save', function(next) {
    // Normalizar código
    if (this.isModified('code')) {
        this.code = this.code.toUpperCase().trim();
    }
    // Normalizar categoría
    if (this.isModified('category')) {
        this.category = this.category.trim();
    }
    next();
});

// Middleware post-save: Log
productSchema.post('save', function(doc) {
    console.log(`✅ Producto guardado: ${doc.title} (${doc.code})`);
});

// Middleware pre-update: Validar stock no negativo
productSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update.stock !== undefined && update.stock < 0) {
        next(new Error('El stock no puede ser negativo'));
    }
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;

