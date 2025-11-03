const mongoose = require('mongoose');

class Database {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Evitar múltiples conexiones
            if (this.isConnected) {
                console.log('📊 MongoDB ya está conectado');
                return this.connection;
            }

            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

            // Opciones de conexión
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            };

            await mongoose.connect(MONGODB_URI, options);

            this.connection = mongoose.connection;
            this.isConnected = true;

            // Event listeners
            this.connection.on('connected', () => {
                console.log('✅ MongoDB conectado exitosamente');
                console.log(`📍 Base de datos: ${this.connection.name}`);
            });

            this.connection.on('error', (err) => {
                console.error('❌ Error de conexión a MongoDB:', err.message);
                this.isConnected = false;
            });

            this.connection.on('disconnected', () => {
                console.log('⚠️  MongoDB desconectado');
                this.isConnected = false;
            });

            // Manejo de cierre graceful
            process.on('SIGINT', async () => {
                await this.disconnect();
                process.exit(0);
            });

            process.on('SIGTERM', async () => {
                await this.disconnect();
                process.exit(0);
            });

            return this.connection;
        } catch (error) {
            console.error('❌ Error fatal al conectar a MongoDB:', error.message);
            console.error('💡 Verifica que MongoDB esté ejecutándose');
            console.error(`💡 URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce'}`);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                console.log('🔌 MongoDB desconectado correctamente');
            }
        } catch (error) {
            console.error('❌ Error al desconectar MongoDB:', error.message);
            throw error;
        }
    }

    getConnection() {
        if (!this.isConnected || !this.connection) {
            throw new Error('No hay conexión activa a MongoDB. Ejecuta connect() primero.');
        }
        return this.connection;
    }

    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: 'No conectado a MongoDB' };
            }

            const adminDb = this.connection.db.admin();
            const status = await adminDb.ping();

            return {
                status: 'connected',
                message: 'MongoDB está funcionando correctamente',
                database: this.connection.name,
                host: this.connection.host,
                port: this.connection.port
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}

// Exportar instancia singleton
module.exports = new Database();