import authRoutes from './routers/authRoutes.js';
import userRoutes from './routers/userRoutes.js';
import chatRoutes from './routers/chatRoutes.js';
import messageRoutes from './routers/messageRouter.js';

export const serverRoutes = (app) => {
    app.get('/api/v3/health', (req, res) => {
        res.status(200).json({
            success: true,
            message: 'Server is running',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });

    app.use('/api/v3/auth', authRoutes);
    app.use('/api/v3/users', userRoutes);
    app.use('/api/v3/chat', chatRoutes);
    app.use('/api/v3/message', messageRoutes);

};